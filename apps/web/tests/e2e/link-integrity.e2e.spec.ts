import { test, expect } from '@playwright/test'

/**
 * Link integrity: every internal href rendered on a published page must
 * resolve. The site-sweep asserts routes and subresources, but never follows
 * anchors — a `<Link href="/dead-route">` in the page body was invisible to
 * the whole suite (that is exactly how the broken full-catalogue link
 * shipped). This spec closes that gap.
 *
 * Product links get one extra check: a stale Payload mirror row keeps
 * `/products/<slug>/` returning 200 while the Vendure lookup fails, so the
 * page renders "Product not found" — a broken page hiding behind a good
 * status code.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:7773'
const PORT = new URL(BASE).port || '7773'

// Same tenant→origin mapping as site-sweep: legacy owner keeps the bare
// origin, other brands resolve on their *.localhost subdomain.
const ORIGIN_BY_TENANT: Record<string, string> = {
  tlr: BASE,
  tgp: `http://tgp.localhost:${PORT}`,
  snm: `http://snm.localhost:${PORT}`,
}

const INTERNAL_ORIGINS = new Set(Object.values(ORIGIN_BY_TENANT))

function publicUrl(slug: string): string {
  const [first, ...rest] = slug.split('/')
  const origin = ORIGIN_BY_TENANT[first]
  if (!origin) return `${BASE}/${slug}/`
  const path = rest.join('/')
  return path === 'home' || path === '' ? `${origin}/` : `${origin}/${path}/`
}

test.describe('Link integrity', () => {
  test('every internal href on every published page resolves', async ({ page, request }) => {
    test.setTimeout(240_000)

    const listed = await request.get('/api/pages?depth=0&limit=100')
    expect(listed.ok(), 'could not list pages').toBe(true)
    const pages = (await listed.json()).docs as { slug: string; _status: string }[]
    const routes = pages.filter(p => p._status === 'published').map(p => publicUrl(p.slug))
    expect(routes.length, 'no published pages found to crawl').toBeGreaterThan(0)

    // target URL -> pages that link to it
    const linkedFrom = new Map<string, Set<string>>()

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' })
      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href),
      )
      for (const href of hrefs) {
        let url: URL
        try {
          url = new URL(href)
        } catch {
          continue
        }
        if (!['http:', 'https:'].includes(url.protocol)) continue
        if (!INTERNAL_ORIGINS.has(url.origin)) continue
        const target = url.origin + url.pathname + url.search
        if (!linkedFrom.has(target)) linkedFrom.set(target, new Set())
        linkedFrom.get(target)!.add(route)
      }
    }

    expect(linkedFrom.size, 'no internal links collected — crawl is broken').toBeGreaterThan(0)

    const failures: string[] = []
    for (const [target, sources] of linkedFrom) {
      const from = `linked from: ${[...sources].join(', ')}`
      const response = await request.get(target, { maxRedirects: 5 })
      if (response.status() >= 400) {
        failures.push(`${response.status()} ${target}\n    ${from}`)
        continue
      }
      // Product pages render client-side: a stale Payload mirror row keeps the
      // route at 200 while the Vendure lookup fails after hydration, so the
      // error state is only visible in a real browser.
      if (/\/products\//.test(target)) {
        await page.goto(target, { waitUntil: 'networkidle' })
        const broken = await page
          .getByText(/Product not found/i)
          .isVisible()
          .catch(() => false)
        if (broken) {
          failures.push(`stale product page (200 but "Product not found") ${target}\n    ${from}`)
        }
      }
    }

    expect(failures, `broken internal links:\n${failures.join('\n')}`).toEqual([])
  })
})
