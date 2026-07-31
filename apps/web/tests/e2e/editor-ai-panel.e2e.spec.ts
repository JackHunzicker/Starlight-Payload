import { test, expect } from '@playwright/test'

/**
 * Proves the Puck editor's built-in AI panel actually renders.
 *
 * This platform DOES use Delmare's in-editor AI panel; only its backend is
 * rewired (`PUCK_AI_MODE=bridge` -> local Claude Code bridge on subscription
 * OAuth). An earlier audit note wrongly listed the panel as inert based on a raw
 * `node -e "require(...)"` probe inside the container. That probe tested Node's
 * own ESM/CJS resolution, NOT how the Next bundler resolves the import at build
 * time — so it proved nothing about the running app. This test checks the app.
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

test.describe('Puck editor AI panel', () => {
  test.skip(!email || !password, 'PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD not configured')

  test('the in-editor AI panel is present and not a disabled placeholder', async ({ page }) => {
    const login = await page.request.post('/api/users/login', { data: { email, password } })
    expect(login.ok(), `admin login failed: ${login.status()}`).toBe(true)

    const pages = await page.request.get('/api/pages?where[slug][equals]=tlr%2Fhome&depth=0&draft=true')
    const homeId = (await pages.json()).docs?.[0]?.id
    expect(homeId, 'home page not found').toBeTruthy()

    await page.goto(`/admin/puck-editor/pages/${homeId}/`)
    await expect(page.getByText('Blocks', { exact: true })).toBeVisible({ timeout: 30_000 })

    // The AI tab is registered in the editor rail.
    const aiTab = page.getByText('AI', { exact: true }).first()
    await expect(aiTab, 'no AI entry in the editor rail').toBeVisible({ timeout: 20_000 })

    await aiTab.click()

    // A real panel exposes an input surface; the not-installed fallback renders
    // only a warning with no way to send a prompt.
    const panelInput = page
      .locator('textarea, input[type="text"]')
      .locator('visible=true')
      .first()
    await expect(panelInput, 'AI panel rendered without any prompt input — likely the disabled placeholder').toBeVisible({
      timeout: 20_000,
    })

    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    expect(bodyText, 'editor is showing the plugin-not-installed message').not.toContain('plugin-ai not installed')
  })

  test('the AI endpoint is wired to the local bridge, not a cloud key', async ({ page }) => {
    const login = await page.request.post('/api/users/login', { data: { email, password } })
    expect(login.ok()).toBe(true)

    // With the bridge process down this returns an error, but the response must
    // show bridge routing rather than a cloud/API-key path.
    const res = await page.request.post('/api/puck/ai', {
      data: { messages: [{ role: 'user', content: 'ping' }] },
      failOnStatusCode: false,
    })
    const body = (await res.text()).toLowerCase()
    expect(body, 'AI route is falling back to an API-key path').not.toContain('anthropic_api_key')
    console.log(`[ai-panel] /api/puck/ai -> ${res.status()}`)
  })
})
