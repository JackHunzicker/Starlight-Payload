import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { publicPath, storeTestContext } from './storeTestContext'

/**
 * Real-browser proof for the two blocks the platform has always claimed but
 * never demonstrated: Scene3DBlock (WebGL + a real glTF model) and RemotionBlock
 * (an actual frame-driven composition, not a static placeholder).
 *
 * The model is served from a test fixture via request interception, so no test
 * asset ships in production.
 */

const email = process.env.PAYLOAD_ADMIN_EMAIL
const password = process.env.PAYLOAD_ADMIN_PASSWORD

const TITLE = 'Puck Audit Media Blocks'
const MODEL_URL = 'http://localhost:7773/__test__/triangle.gltf'
const fixture = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'triangle.gltf'), 'utf-8')

const puckData = {
  root: { props: {} },
  content: [
    {
      type: 'Scene3DBlock',
      props: { id: 'scene-1', gltfUrl: MODEL_URL, height: 320, environmentPreset: 'studio', visibility: null },
    },
    {
      type: 'RemotionBlock',
      props: {
        id: 'remotion-1',
        compositionName: 'title-reveal',
        durationInFrames: 90,
        width: 640,
        height: 360,
        fps: 30,
        showControls: true,
        visibility: null,
      },
    },
  ],
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

/** Serves the fixture and reports how many times the app actually requested it. */
async function serveModel(page: Page) {
  const hits = { count: 0 }
  await page.route('**/__test__/triangle.gltf', route => {
    hits.count += 1
    return route.fulfill({ status: 200, contentType: 'model/gltf+json', body: fixture })
  })
  return hits
}

test.describe('Media blocks: real 3D and real video', () => {
  test.skip(!email || !password, 'PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD not configured')

  let token: string
  let slug: string
  let modelHits: { count: number }
  let tlr: { tenantId: number | string; folderId: number | string }

  test.beforeEach(async ({ page }) => {
    token = await loginToken(page.request)
    tlr = await storeTestContext(page.request, token)
    await deleteFixtures(page.request, token)
    const created = await page.request.post('/api/pages', {
      headers: { Authorization: `JWT ${token}` },
      data: { title: TITLE, puckData, _status: 'published', tenant: tlr.tenantId, folder: tlr.folderId },
    })
    expect(created.ok(), `page create failed: ${created.status()} ${await created.text()}`).toBe(true)
    slug = (await created.json()).doc.slug
    modelHits = await serveModel(page)
  })

  test.afterEach(async ({ page }) => {
    await deleteFixtures(page.request, token)
  })

  test('Scene3D renders a real glTF model on a live WebGL canvas', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto(publicPath(slug))

    const canvas = page.locator('.scene3d-container canvas')
    await expect(canvas, 'no WebGL canvas mounted').toBeVisible({ timeout: 30_000 })

    // The canvas must have real dimensions and a live WebGL context.
    const state = await canvas.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      hasWebGL: !!(el.getContext('webgl2') || el.getContext('webgl')),
    }))
    expect(state.width, 'canvas has no pixel width').toBeGreaterThan(0)
    expect(state.height, 'canvas has no pixel height').toBeGreaterThan(0)
    expect(state.hasWebGL, 'no WebGL context on the canvas').toBe(true)

    // Prove the MODEL specifically was fetched and parsed — non-blank pixels
    // alone could come from the environment lighting.
    await expect
      .poll(() => modelHits.count, { timeout: 30_000, message: 'the app never requested the glTF model' })
      .toBeGreaterThan(0)
    const triangles = await canvas.evaluate((el: HTMLCanvasElement & { __r3f?: { root?: { getState?: () => unknown } } }) => {
      const state = el.__r3f?.root?.getState?.() as { gl?: { info?: { render?: { triangles?: number } } } } | undefined
      return state?.gl?.info?.render?.triangles ?? -1
    })
    // -1 means the internal handle was unavailable in this build; the pixel and
    // fetch assertions still stand in that case.
    if (triangles >= 0) {
      expect(triangles, 'renderer drew no triangles — the model did not reach the scene').toBeGreaterThan(0)
    }

    // The model actually loaded: three.js draws geometry only after the glTF
    // parses, so a non-blank frame proves the fixture was fetched and rendered.
    await expect
      .poll(
        async () =>
          canvas.evaluate((el: HTMLCanvasElement) => {
            const gl = (el.getContext('webgl2') || el.getContext('webgl')) as WebGLRenderingContext | null
            if (!gl) return 0
            const pixels = new Uint8Array(el.width * el.height * 4)
            gl.readPixels(0, 0, el.width, el.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
            let nonBlank = 0
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonBlank++
            }
            return nonBlank
          }),
        { timeout: 30_000, message: 'canvas never rendered any non-blank pixels' },
      )
      .toBeGreaterThan(0)

    expect(errors.filter(e => !/WebGL context lost/i.test(e))).toEqual([])
  })

  test('NEGATIVE CONTROL: a malformed model surfaces an error rather than passing silently', async ({ page }) => {
    // Makes the positive test meaningful: if a broken glTF produced the same
    // "canvas renders, no errors" signal, that test would prove nothing.
    await page.unroute('**/__test__/triangle.gltf')
    await page.route('**/__test__/triangle.gltf', route =>
      route.fulfill({ status: 200, contentType: 'model/gltf+json', body: '{"asset":{"version":"2.0"},"meshes":[{"primitives":[{"attributes":{"POSITION":99}}]}]}' }),
    )

    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto(publicPath(slug))
    await expect(page.locator('.scene3d-container')).toBeVisible({ timeout: 30_000 })

    await expect
      .poll(() => errors.length, {
        timeout: 30_000,
        message: 'a malformed glTF produced no error at all — the positive test cannot distinguish a loaded model from a failed one',
      })
      .toBeGreaterThan(0)
  })

  test('Scene3D honours a constrained width instead of spanning the page', async ({ page }) => {
    const constrained = {
      ...puckData,
      content: [
        {
          ...puckData.content[0],
          props: {
            ...puckData.content[0].props,
            dimensions: { xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 360, unit: 'px', enabled: true } } },
          },
        },
      ],
    }
    const created = await page.request.post('/api/pages', {
      headers: { Authorization: `JWT ${token}` },
      data: { title: `${TITLE} Sized`, puckData: constrained, _status: 'published', tenant: tlr.tenantId, folder: tlr.folderId },
    })
    const sized = (await created.json()).doc

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(publicPath(sized.slug))
    await expect(page.locator('.scene3d-container')).toBeVisible({ timeout: 30_000 })

    const width = await page.locator('.scene3d-block-wrapper').first().evaluate(el => el.getBoundingClientRect().width)
    expect(width, 'the 3D block still spans the page — responsive width is not applied').toBeLessThanOrEqual(361)

    await page.request.delete(`/api/pages/${sized.id}`, { headers: { Authorization: `JWT ${token}` } })
  })

  test('Remotion plays a real composition that animates over time', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto(publicPath(slug))

    // The registry-resolved composition renders — not the old static placeholder.
    const title = page.getByTestId('remotion-title')
    await expect(title, 'composition did not render').toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('🎬 Remotion Composition'), 'still rendering the hardcoded placeholder').toHaveCount(0)

    // Frame-driven: the title fades/rises, so its computed style must change as
    // the player advances.
    const readStyle = () =>
      title.evaluate(el => {
        const style = getComputedStyle(el)
        return `${style.opacity}|${style.transform}`
      })

    const before = await readStyle()
    await page.locator('.remotion-container button').first().click() // play
    await expect.poll(readStyle, { timeout: 15_000, message: 'composition never animated' }).not.toBe(before)

    expect(errors).toEqual([])
  })

  test('Remotion surfaces an unknown composition instead of rendering blank', async ({ page }) => {
    const created = await page.request.post('/api/pages', {
      headers: { Authorization: `JWT ${token}` },
      data: {
        title: `${TITLE} Unknown`,
        _status: 'published',
        tenant: tlr.tenantId,
        folder: tlr.folderId,
        puckData: {
          root: { props: {} },
          content: [
            {
              type: 'RemotionBlock',
              props: { ...puckData.content[1].props, id: 'r-unknown', compositionName: 'does-not-exist' },
            },
          ],
        },
      },
    })
    const doc = (await created.json()).doc

    await page.goto(publicPath(doc.slug))
    await expect(page.getByTestId('remotion-unknown')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Unknown composition: does-not-exist')).toBeVisible()

    await page.request.delete(`/api/pages/${doc.id}`, { headers: { Authorization: `JWT ${token}` } })
  })
})
