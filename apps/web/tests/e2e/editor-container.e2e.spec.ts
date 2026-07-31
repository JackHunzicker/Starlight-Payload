import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { publicPath, storeTestContext } from './storeTestContext'

/**
 * Container editor audit on a self-created, self-deleted fixture page.
 * Covers the manifest's required surfaces for one component: config/GUI parity,
 * editor control edits, publish persistence, live parity, and responsive geometry.
 *
 * Auth note: Payload rejects cookie-only REST writes (403); writes use the login
 * token as an `Authorization: JWT` header, while the cookie from the same login
 * authenticates admin-UI navigation.
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

const TITLE = 'Puck Audit Container'

// Container's editable fields per the installed package config (excluding the
// `content` slot and the `_reset` control, which render no labelled input).
const EXPECTED_FIELD_LABELS = ['Visibility', 'HTML Element', 'Dimensions', 'Background', 'Border', 'Padding', 'Margin', 'Animation']

const fixtureData = {
  root: { props: {} },
  content: [
    {
      type: 'Container',
      props: {
        id: 'audit-container-1',
        semanticElement: 'div',
        content: [
          { type: 'Heading', props: { id: 'audit-heading-1', text: 'Container Audit Surface', level: 'h2', alignment: 'center' } },
          { type: 'Text', props: { id: 'audit-text-1', content: 'Deterministic fixture for GUI verification.', alignment: 'center' } },
        ],
      },
    },
  ],
}

async function loginToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/users/login', { data: { email, password } })
  expect(res.ok(), `admin login failed: ${res.status()}`).toBe(true)
  const token = (await res.json()).token
  expect(token, 'login returned no token').toBeTruthy()
  return token
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

/** Puck renders the fields panel in several DOM shells; only one is visible. */
function visibleText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).locator('visible=true').first()
}

function visibleSelectWithOption(page: Page, optionFragment: string) {
  return page
    .locator('select')
    .filter({ has: page.locator(`option[value*="${optionFragment}"]`) })
    .locator('visible=true')
    .first()
}

async function openEditorAndSelectContainer(page: Page, pageId: number | string) {
  await page.goto(`/admin/puck-editor/pages/${pageId}/`)
  await expect(page.getByText('Blocks', { exact: true })).toBeVisible({ timeout: 30_000 })
  const preview = page.frameLocator('iframe').first()
  await expect(preview.getByRole('heading', { name: 'Container Audit Surface' })).toBeVisible({ timeout: 30_000 })

  // The preview click-target selects the innermost child; the Outline layer tree
  // is how a parent layout component gets selected.
  await page.getByText('Outline', { exact: true }).click()
  await page.locator('[class*="Layer-clickable"]').filter({ hasText: 'Container' }).first().click()
  // Puck renders the fields panel in more than one DOM node (responsive shells),
  // so every control matches multiple times — always scope to the first.
  await expect(visibleText(page, 'HTML Element')).toBeVisible({ timeout: 10_000 })
  return preview
}

test.describe('Puck editor: Container audit', () => {
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
      data: { title: TITLE, puckData: fixtureData, _status: 'draft', tenant: tlr.tenantId, folder: tlr.folderId },
    })
    expect(created.ok(), `page create failed: ${created.status()} ${await created.text()}`).toBe(true)
    const doc = (await created.json()).doc
    pageId = doc.id
    slug = doc.slug
  })

  test.afterEach(async ({ page }) => {
    await deleteFixtures(page.request, token)
  })

  test('editor exposes every declared Container field', async ({ page }) => {
    await openEditorAndSelectContainer(page, pageId)
    for (const label of EXPECTED_FIELD_LABELS) {
      await expect(visibleText(page, label), `missing control: ${label}`).toBeVisible()
    }
  })

  test('HTML Element edit is written to saved data and survives editor reload', async ({ page }) => {
    await openEditorAndSelectContainer(page, pageId)

    const elementSelect = visibleSelectWithOption(page, 'article')
    await elementSelect.selectOption({ label: 'Section' })

    await page.getByRole('button', { name: 'Publish' }).locator('visible=true').first().click()

    // The GUI control writes the chosen element into stored Puck data.
    await expect
      .poll(
        async () => {
          const saved = await page.request.get(`/api/pages/${pageId}?depth=0&draft=true`, {
            headers: { Authorization: `JWT ${token}` },
          })
          if (!saved.ok()) return `http ${saved.status()}`
          return (await saved.json()).puckData?.content?.[0]?.props?.semanticElement
        },
        { timeout: 20_000, message: 'editor never persisted semanticElement=section' },
      )
      .toBe('section')

    // Persistence: reopening the editor shows the saved value selected.
    await openEditorAndSelectContainer(page, pageId)
    expect(await visibleSelectWithOption(page, 'article').inputValue()).toContain('section')
  })

  test('published Container is centered at desktop and overflow-free on mobile', async ({ page }) => {
    // Publish deterministically via the API, then measure the live client render.
    const pub = await page.request.patch(`/api/pages/${pageId}`, {
      headers: { Authorization: `JWT ${token}` },
      data: { _status: 'published' },
    })
    expect(pub.ok(), `publish failed: ${pub.status()}`).toBe(true)

    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Container Audit Surface' })).toBeVisible({ timeout: 20_000 })

    const desktop = await page.evaluate(() => {
      const el = document.querySelector('[class*="puck-container-"]') as HTMLElement | null
      const box = el?.getBoundingClientRect()
      return {
        found: !!el,
        left: Math.round(box?.left ?? 0),
        right: Math.round(window.innerWidth - (box?.right ?? 0)),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })
    expect(desktop.found, 'no puck-container element on the live page').toBe(true)
    // Equal gutters => the container is centered (allow 1px rounding).
    expect(Math.abs(desktop.left - desktop.right)).toBeLessThanOrEqual(1)
    expect(desktop.overflow).toBe(false)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Container Audit Surface' })).toBeVisible({ timeout: 20_000 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)

    expect(errors).toEqual([])
  })
})
