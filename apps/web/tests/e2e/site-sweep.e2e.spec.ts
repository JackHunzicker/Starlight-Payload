import { test, expect } from '@playwright/test'

/**
 * Whole-site console sweep.
 *
 * Every published route is loaded at desktop and mobile and must produce zero
 * page errors, zero console errors, and no horizontal overflow. This is the
 * broad net that catches problems no per-component test is looking for.
 */

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  // The blueprint artboards are fixed-width (1440 SNM, 1280 TLR/TGP); above
  // them the layoutShell cap must keep text centred at the artboard span.
  { name: 'ultrawide', width: 2560, height: 1440 },
]

/** Max content span per tenant: the artboard width. Text outside the centred
 *  span at ultrawide means a band escaped the cap. */
const ARTBOARD_BY_TENANT: Record<string, number> = { snm: 1440, tlr: 1280, tgp: 1280 }

// Known-benign noise that is not a defect in our code.
const IGNORED = [/WebGL context lost/i, /Download the React DevTools/i]

/**
 * Third-party origins whose failures we handle gracefully rather than cause.
 * Recorded explicitly (and logged) instead of silently ignored — the app must
 * still degrade cleanly, which is asserted by the block's own fallback test.
 *
 * Sharkey's media proxy rejects http:// sources ("unsupported protocol http:"),
 * so avatars 500 on a local http instance while the direct file serves fine.
 * ExternalFeedBlock falls back to initials; see the avatar-fallback E2E test.
 */
const EXTERNAL_ORIGINS = ['http://localhost:7777']

/**
 * Stored slugs are tenant-prefixed (`snm/platform`); public URLs are not
 * (`https://orbitlabs.example/platform/`). Sweeping `/snm/platform/` tested a path
 * that should not resolve at all, so the sweep was green while never visiting the
 * real public surface of two of the three brands.
 *
 * Each brand is reached on its own origin. Next.js resolves `*.localhost`
 * natively, so `http://tgp.localhost:7773` needs no hosts-file entry, and the
 * page component maps that hostname to the tenant exactly as production does.
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:7773'
const PORT = new URL(BASE).port || '7773'

/** Legacy owner keeps the bare origin; other brands get their subdomain. */
const ORIGIN_BY_TENANT: Record<string, string> = {
  tlr: BASE,
  tgp: `http://tgp.localhost:${PORT}`,
  snm: `http://snm.localhost:${PORT}`,
}

function publicUrl(slug: string): string {
  const [first, ...rest] = slug.split('/')
  const origin = ORIGIN_BY_TENANT[first]
  // Not tenant-prefixed: pre-tenancy content, served from the legacy owner.
  if (!origin) return `${BASE}/${slug}/`
  const path = rest.join('/')
  // A brand's `home` is its root, not `/home/`.
  return path === 'home' || path === '' ? `${origin}/` : `${origin}/${path}/`
}

test.describe('Site-wide console sweep', () => {
  for (const viewport of VIEWPORTS) {
    test(`all published routes are clean at ${viewport.name}`, async ({ page, request }) => {
      const listed = await request.get('/api/pages?depth=0&limit=100')
      expect(listed.ok(), 'could not list pages').toBe(true)
      const pages = (await listed.json()).docs as { slug: string; _status: string }[]
      const routes = pages.filter(p => p._status === 'published').map(p => publicUrl(p.slug))
      expect(routes.length, 'no published pages found to sweep').toBeGreaterThan(0)

      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      const failures: string[] = []
      for (const route of routes) {
        const problems: string[] = []
        const onPageError = (error: Error) => problems.push(`pageerror: ${error.message}`)
        const onConsole = (message: { type: () => string; text: () => string }) => {
          if (message.type() !== 'error') return
          const text = message.text()
          // Browser-generated "failed to load resource" noise for a third-party
          // asset is covered by the response handler above.
          if (/Failed to load resource/i.test(text)) return
          problems.push(`console: ${text}`)
        }
        const external: string[] = []
        const onResponse = (r: { status: () => number; url: () => string }) => {
          if (r.status() < 400) return
          const url = r.url()
          if (EXTERNAL_ORIGINS.some(origin => url.startsWith(origin))) {
            external.push(`${r.status()} ${url}`)
            return
          }
          problems.push(`request ${r.status()}: ${url}`)
        }
        page.on('pageerror', onPageError)
        page.on('console', onConsole)
        page.on('response', onResponse)

        const response = await page.goto(route, { waitUntil: 'networkidle' })
        if (response && response.status() >= 400) problems.push(`http ${response.status()}`)

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        )
        if (overflow) problems.push('horizontal overflow')

        // Text colliding with the element below it. A 60px heading renders with
        // line-height 1, so a descender ("p", "g", "y") sits below its line box;
        // with no bottom margin it lands on top of the next paragraph. That is a
        // rendering defect no status code or console listener can see.
        const collisions = await page.evaluate(() => {
          // Screen-reader-only text (the homepage's SEO <h1>, which the blueprint
          // renders as h2s visually) is clipped to a 1x1 box parked at a corner.
          // It paints nothing, so no geometry rule applies to it.
          const isVisuallyHidden = (el: Element) => {
            const r = el.getBoundingClientRect()
            if (r.width <= 1 || r.height <= 1) return true
            const style = getComputedStyle(el)
            return style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)'
          }
          const found: string[] = []
          const blocks = [...document.querySelectorAll('h1, h2, h3, h4, p')]
          for (const el of blocks) {
            const next = el.nextElementSibling
            if (!next) continue
            if (isVisuallyHidden(el) || isVisuallyHidden(next)) continue
            const a = el.getBoundingClientRect()
            const b = next.getBoundingClientRect()
            if (a.height === 0 || b.height === 0) continue
            // Same column, and the next element starts above this one's baseline box.
            const sameColumn = Math.abs(a.left - b.left) < 2
            if (sameColumn && b.top < a.bottom - 1) {
              found.push(
                `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 30)}" ` +
                  `overlaps <${next.tagName.toLowerCase()}> by ${Math.round(a.bottom - b.top)}px`,
              )
            }
          }
          return found
        })
        for (const collision of collisions) problems.push(`overlap: ${collision}`)

        // Above the artboard width, every text element must sit inside the
        // centred artboard span — outside it means a band escaped the cap.
        const tenant = route.includes('snm.localhost') ? 'snm' : route.includes('tgp.localhost') ? 'tgp' : 'tlr'
        const artboard = ARTBOARD_BY_TENANT[tenant]
        if (viewport.width > artboard) {
          const escapes = await page.evaluate((span) => {
            const found: string[] = []
            const vw = document.documentElement.clientWidth
            const lo = (vw - span) / 2 - 2
            const hi = vw - (vw - span) / 2 + 2
            for (const el of document.querySelectorAll('h1, h2, h3, h4, p, a, button')) {
              const r = el.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) continue
              // Screen-reader-only text is clipped to a 1x1 box at a corner and
              // paints nothing — the width cap governs visible content only.
              if (r.width <= 1 || r.height <= 1) continue
              const style = getComputedStyle(el)
              if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') continue
              if (r.left < lo || r.right > hi) {
                found.push(
                  `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 30)}" ` +
                    `at [${Math.round(r.left)}, ${Math.round(r.right)}] outside [${Math.round(lo)}, ${Math.round(hi)}]`,
                )
              }
            }
            return found
          }, artboard)
          for (const escape of escapes) problems.push(`uncapped: ${escape}`)
        }

        page.off('pageerror', onPageError)
        page.off('console', onConsole)
        page.off('response', onResponse)

        const real = problems.filter(p => !IGNORED.some(pattern => pattern.test(p)))
        if (real.length) failures.push(`${route}\n    ${real.join('\n    ')}`)
      }

      expect(failures, `routes with problems at ${viewport.name}:\n${failures.join('\n')}`).toEqual([])
    })
  }
})

test.describe('Third-party degradation', () => {
  test('a failing avatar host degrades to initials, never a broken image', async ({ page, request }) => {
    // Force every Sharkey avatar request to fail, then assert the feed still
    // renders readable author identity instead of a broken <img>.
    await page.route('**/proxy/avatar**', route => route.fulfill({ status: 500, body: '' }))

    const listed = await request.get('/api/pages?depth=0&limit=100&where[slug][equals]=community')
    const doc = (await listed.json()).docs?.[0]
    test.skip(!doc, 'community page not present')

    await page.goto(`/${doc.slug}/`)
    await expect(page.getByText('Join the Conversation')).toBeVisible({ timeout: 30_000 })

    // No <img> may remain in a broken state (naturalWidth 0 once loading settles).
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).length,
          ),
        { timeout: 20_000, message: 'a broken image is still rendered after the avatar host failed' },
      )
      .toBe(0)
  })
})
