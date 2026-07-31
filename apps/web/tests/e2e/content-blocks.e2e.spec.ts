import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { publicPath, storeTestContext } from './storeTestContext'

/**
 * Typography / interactive block audit on a self-created, self-deleted fixture.
 *
 * Accordion gets real interaction coverage here: it is the component at the
 * centre of the 2026-02-02 override incident and has never had a current-version
 * browser check.
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

const TITLE = 'Puck Audit Content Blocks'

const fixtureData = {
  root: { props: {} },
  content: [
    { type: 'Heading', props: { id: 'cb-heading', text: 'Content Block Audit', level: 'h2', alignment: 'center' } },
    { type: 'Text', props: { id: 'cb-text', content: 'Body copy under audit.', alignment: 'center' } },
    { type: 'Button', props: { id: 'cb-button', text: 'Audit Link', link: '/about', variant: 'default', openInNewTab: 'no' } },
    { type: 'Divider', props: { id: 'cb-divider', style: 'solid' } },
    {
      type: 'Accordion',
      props: {
        id: 'cb-accordion',
        allowMultiple: false,
        items: [
          { title: 'First question', content: 'First answer body.', defaultOpen: false },
          { title: 'Second question', content: 'Second answer body.', defaultOpen: false },
        ],
      },
    },
  ],
}

/** Collapsed Accordion panels are clipped (max-height:0), not removed. */
async function panelMaxHeight(page: Page, answerText: string): Promise<string | null> {
  return page.evaluate(text => {
    const node = Array.from(document.querySelectorAll('div')).find(
      el => el.textContent?.trim() === text && el.children.length === 0,
    )
    const panel = node?.parentElement
    return panel ? getComputedStyle(panel).maxHeight : null
  }, answerText)
}

async function loginToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/users/login', { data: { email, password } })
  expect(res.ok(), `admin login failed: ${res.status()}`).toBe(true)
  return (await res.json()).token
}

async function deleteFixtures(request: APIRequestContext, token: string) {
  const found = await request.get(`/api/pages?where[title][equals]=${encodeURIComponent(TITLE)}&depth=0&draft=true`, {
    headers: { Authorization: `JWT ${token}` },
  })
  if (!found.ok()) return
  for (const doc of (await found.json()).docs ?? []) {
    await request.delete(`/api/pages/${doc.id}`, { headers: { Authorization: `JWT ${token}` } })
  }
}

test.describe('Puck: typography and interactive blocks', () => {
  test.skip(!email || !password, 'PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD not configured')

  let token: string
  let pageId: number | string
  let slug: string

  test.beforeEach(async ({ page }) => {
    token = await loginToken(page.request)
    const tlr = await storeTestContext(page.request, token)
    await deleteFixtures(page.request, token)
    const created = await page.request.post('/api/pages', {
      headers: { Authorization: `JWT ${token}` },
      data: { title: TITLE, puckData: fixtureData, _status: 'published', tenant: tlr.tenantId, folder: tlr.folderId },
    })
    expect(created.ok(), `page create failed: ${created.status()} ${await created.text()}`).toBe(true)
    const doc = (await created.json()).doc
    pageId = doc.id
    slug = doc.slug
  })

  test.afterEach(async ({ page }) => {
    await deleteFixtures(page.request, token)
  })

  test('all blocks render on the published page with correct semantics', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Content Block Audit', level: 2 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Body copy under audit.')).toBeVisible()

    const link = page.getByRole('link', { name: 'Audit Link' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/about')

    // Accordion titles are present; answers start collapsed. Collapse is done
    // with max-height/opacity (content stays in the DOM), so assert the panel
    // geometry rather than Playwright visibility.
    await expect(page.getByText('First question')).toBeVisible()
    expect(await panelMaxHeight(page, 'First answer body.')).toBe('0px')

    expect(errors).toEqual([])
  })

  test('Accordion expands and collapses, honouring single-open mode', async ({ page }) => {
    await page.goto(publicPath(slug))
    await expect(page.getByText('First question')).toBeVisible({ timeout: 20_000 })

    await page.getByText('First question').click()
    await expect.poll(() => panelMaxHeight(page, 'First answer body.')).not.toBe('0px')

    // allowMultiple:false means opening the second closes the first.
    await page.getByText('Second question').click()
    await expect.poll(() => panelMaxHeight(page, 'Second answer body.')).not.toBe('0px')
    await expect.poll(() => panelMaxHeight(page, 'First answer body.')).toBe('0px')

    // Clicking an open item collapses it again.
    await page.getByText('Second question').click()
    await expect.poll(() => panelMaxHeight(page, 'Second answer body.')).toBe('0px')
  })

  test('Accordion is keyboard operable', async ({ page }) => {
    await page.goto(publicPath(slug))
    await expect(page.getByText('First question')).toBeVisible({ timeout: 20_000 })

    const trigger = page.getByRole('button', { name: /First question/ })
    const triggerCount = await trigger.count()
    expect(triggerCount, 'accordion trigger is not exposed as a button — keyboard/AT users cannot operate it').toBeGreaterThan(0)

    await trigger.first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('First answer body.')).toBeVisible()
  })

  test('A11Y DEFECT: Accordion exposes no aria state to assistive tech', async ({ page }) => {
    await page.goto(publicPath(slug))
    await expect(page.getByText('First question')).toBeVisible({ timeout: 20_000 })

    const trigger = page.getByRole('button', { name: /First question/ }).first()
    // Characterizes CURRENT upstream behaviour (payload-puck 0.6.30 ships the
    // Accordion with zero aria attributes). If either assertion starts failing,
    // upstream has fixed it — update this test and the manifest.
    expect(await trigger.getAttribute('aria-expanded'), 'upstream added aria-expanded?').toBeNull()
    expect(await trigger.getAttribute('aria-controls'), 'upstream added aria-controls?').toBeNull()

    // Collapsed panels are only clipped, so their text stays in the a11y tree:
    // screen readers announce every answer regardless of open/closed state.
    await trigger.click()
    await expect.poll(() => panelMaxHeight(page, 'First answer body.')).not.toBe('0px')
    await trigger.click()
    await expect.poll(() => panelMaxHeight(page, 'First answer body.')).toBe('0px')
    const stillReadable = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(n => n.textContent?.trim() === 'First answer body.')
      return !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none'
    })
    expect(stillReadable, 'collapsed answer is correctly removed from the a11y tree — upstream fixed?').toBe(true)
  })

  test('Heading level edit persists and renders live', async ({ page }) => {
    await page.goto(`/admin/puck-editor/pages/${pageId}/`)
    await expect(page.getByText('Blocks', { exact: true })).toBeVisible({ timeout: 30_000 })
    const preview = page.frameLocator('iframe').first()
    await expect(preview.getByRole('heading', { name: 'Content Block Audit' })).toBeVisible({ timeout: 30_000 })

    await page.getByText('Outline', { exact: true }).click()
    await page.locator('[class*="Layer-clickable"]').filter({ hasText: 'Heading' }).first().click()

    const levelSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value*="h3"]') })
      .locator('visible=true')
      .first()
    await levelSelect.selectOption({ label: 'H3' })
    // Scope to the fixture heading: the preview renders the whole page shell,
    // whose header/footer contain their own h3s.
    await expect(preview.getByRole('heading', { name: 'Content Block Audit', level: 3 })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Publish' }).locator('visible=true').first().click()
    await expect
      .poll(
        async () => {
          const saved = await page.request.get(`/api/pages/${pageId}?depth=0&draft=true`, {
            headers: { Authorization: `JWT ${token}` },
          })
          if (!saved.ok()) return `http ${saved.status()}`
          return (await saved.json()).puckData?.content?.[0]?.props?.level
        },
        { timeout: 20_000, message: 'heading level never persisted' },
      )
      .toBe('h3')

    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Content Block Audit', level: 3 })).toBeVisible({ timeout: 20_000 })
  })
})
