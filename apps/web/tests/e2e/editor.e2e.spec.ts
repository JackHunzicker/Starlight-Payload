import { test, expect } from '@playwright/test'

/**
 * Authenticated Puck editor smoke test in a fresh browser profile.
 *
 * Regression guard for the 2026-07-23 incident where the editor preview iframe
 * received raw (uncompiled) Tailwind source in production: a fresh profile has
 * no cached stylesheet, so this catches CSS-pipeline breakage that warm
 * browsers mask via the mtime-based ETag.
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

test.describe('Puck editor (authenticated)', () => {
  test.skip(!email || !password, 'PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD not configured')

  test('editor loads the homepage with a fully styled preview iframe', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    // Programmatic login shares the cookie jar with the page context.
    const login = await page.request.post('/api/users/login', { data: { email, password } })
    expect(login.ok(), `admin login failed: ${login.status()}`).toBe(true)

    // The editor stylesheet endpoint must serve compiled CSS, not Tailwind source.
    const styles = await page.request.get('/api/puck/styles')
    expect(styles.ok()).toBe(true)
    const css = await styles.text()
    expect(css).not.toContain('@import "tailwindcss"')
    expect(css).toContain('.flex')

    // Resolve the homepage id instead of hardcoding it. Slugs are
    // tenant-prefixed since the legacy fallback was removed.
    const pages = await page.request.get('/api/pages?where[slug][equals]=tlr%2Fhome&depth=0&draft=true')
    expect(pages.ok()).toBe(true)
    const homeId = (await pages.json()).docs?.[0]?.id
    expect(homeId, 'home page not found').toBeTruthy()

    await page.goto(`/admin/puck-editor/pages/${homeId}/`)

    // Editor shell is up (block palette + preview iframe).
    await expect(page.getByText('Blocks', { exact: true })).toBeVisible({ timeout: 20_000 })
    const preview = page.frameLocator('iframe').first()
    await expect(
        preview.getByRole('heading', { name: 'Real orbitlabs research, not marketing hype.' }),
    ).toBeVisible({ timeout: 20_000 })

    // Compiled utilities actually apply inside the iframe: at least one
    // `.flex` element computes to display:flex (raw-CSS regression renders
    // them all as block). Not `.first()` — since the granular swap the first
    // match is the header's md:hidden mobile cluster, correctly display:none
    // at desktop.
    const anyFlex = await preview
        .locator('.flex')
        .first()
        .evaluate(() =>
            Array.from(document.querySelectorAll('.flex')).some(el => getComputedStyle(el).display === 'flex'),
        )
    expect(anyFlex).toBe(true)

    expect(errors).toEqual([])
  })
})
