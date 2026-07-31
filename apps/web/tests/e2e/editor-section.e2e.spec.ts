import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { publicPath, storeTestContext } from './storeTestContext'

/**
 * Section editor audit on a self-created, self-deleted fixture page.
 *
 * Section is the semantic-landmark primitive the platform relies on, so unlike
 * Container its live parity is fully checkable: the chosen element always renders.
 *
 * Auth note: Payload rejects cookie-only REST writes (403); writes use the login
 * token as an `Authorization: JWT` header. baseURL must match payload's csrf
 * origin (see playwright.config.ts).
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

const TITLE = 'Puck Audit Section'

const EXPECTED_FIELD_LABELS = [
  'Visibility',
  'HTML Element',
  'Section ID',
  'Section Background',
  'Section Border',
  'Section Padding',
  'Section Margin',
  'Content Dimensions',
  'Content Background',
  'Content Border',
  'Content Padding',
  'Animation',
]

const fixtureData = {
  root: { props: {} },
  content: [
    {
      type: 'Section',
      props: {
        id: 'audit-section-1',
        semanticElement: 'section',
        contentDimensions: {
          xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 1200, unit: 'px', enabled: true } },
        },
        content: [
          { type: 'Heading', props: { id: 'audit-heading-1', text: 'Section Audit Surface', level: 'h2', alignment: 'center' } },
          { type: 'Text', props: { id: 'audit-text-1', content: 'Deterministic fixture for GUI verification.', alignment: 'center' } },
        ],
      },
    },
  ],
}

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

async function openEditorAndSelectSection(page: Page, pageId: number | string) {
  await page.goto(`/admin/puck-editor/pages/${pageId}/`)
  await expect(page.getByText('Blocks', { exact: true })).toBeVisible({ timeout: 30_000 })
  const preview = page.frameLocator('iframe').first()
  await expect(preview.getByRole('heading', { name: 'Section Audit Surface' })).toBeVisible({ timeout: 30_000 })

  await page.getByText('Outline', { exact: true }).click()
  await page.locator('[class*="Layer-clickable"]').filter({ hasText: 'Section' }).first().click()
  await expect(visibleText(page, 'HTML Element')).toBeVisible({ timeout: 10_000 })
  return preview
}

test.describe('Puck editor: Section audit', () => {
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

  test('editor exposes every declared Section field', async ({ page }) => {
    await openEditorAndSelectSection(page, pageId)
    for (const label of EXPECTED_FIELD_LABELS) {
      await expect(visibleText(page, label), `missing control: ${label}`).toBeVisible()
    }
  })

  test('HTML Element edit persists AND renders on the live page', async ({ page }) => {
    const preview = await openEditorAndSelectSection(page, pageId)
    await expect(preview.locator('section')).toHaveCount(1)

    await visibleSelectWithOption(page, 'article').selectOption({ label: 'Article' })

    // Unlike Container, the editor preview reflects the element change immediately.
    await expect(preview.locator('article')).toHaveCount(1, { timeout: 10_000 })
    await expect(preview.locator('section')).toHaveCount(0)

    await page.getByRole('button', { name: 'Publish' }).locator('visible=true').first().click()
    await expect
      .poll(
        async () => {
          const saved = await page.request.get(`/api/pages/${pageId}?depth=0&draft=true`, {
            headers: { Authorization: `JWT ${token}` },
          })
          if (!saved.ok()) return `http ${saved.status()}`
          return (await saved.json()).puckData?.content?.[0]?.props?.semanticElement
        },
        { timeout: 20_000, message: 'editor never persisted semanticElement=article' },
      )
      .toBe('article')

    // Live parity: the published page renders the chosen landmark.
    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Section Audit Surface' })).toBeVisible({ timeout: 20_000 })
    expect(await page.locator('article').count()).toBe(1)

    // Persistence: reopening the editor shows the saved value.
    await openEditorAndSelectSection(page, pageId)
    expect(await visibleSelectWithOption(page, 'article').inputValue()).toContain('article')
  })

  test('content stays constrained and centered while the landmark is full-bleed', async ({ page }) => {
    const pub = await page.request.patch(`/api/pages/${pageId}`, {
      headers: { Authorization: `JWT ${token}` },
      data: { _status: 'published' },
    })
    expect(pub.ok(), `publish failed: ${pub.status()}`).toBe(true)

    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Section Audit Surface' })).toBeVisible({ timeout: 20_000 })

    const geometry = await page.evaluate(() => {
      const outer = document.querySelector('section[class*="puck-section-"]') as HTMLElement | null
      const inner = outer?.querySelector('[class*="puck-section-content-"]') as HTMLElement | null
      const o = outer?.getBoundingClientRect()
      const i = inner?.getBoundingClientRect()
      return {
        hasOuter: !!outer,
        hasInner: !!inner,
        outerWidth: Math.round(o?.width ?? 0),
        innerWidth: Math.round(i?.width ?? 0),
        innerLeft: Math.round(i?.left ?? 0),
        innerRight: Math.round((o?.right ?? 0) - (i?.right ?? 0)),
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })

    expect(geometry.hasOuter, 'no puck-section element on the live page').toBe(true)
    expect(geometry.hasInner, 'no puck-section-content layer').toBe(true)
    // Landmark spans the viewport; content is capped at the configured 1200px.
    expect(geometry.outerWidth).toBe(geometry.viewport)
    expect(geometry.innerWidth).toBeLessThanOrEqual(1200)
    // Content is centered inside the landmark.
    expect(Math.abs(geometry.innerLeft - geometry.innerRight)).toBeLessThanOrEqual(1)
    expect(geometry.overflow).toBe(false)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(publicPath(slug))
    await expect(page.getByRole('heading', { name: 'Section Audit Surface' })).toBeVisible({ timeout: 20_000 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)

    expect(errors).toEqual([])
  })
})
