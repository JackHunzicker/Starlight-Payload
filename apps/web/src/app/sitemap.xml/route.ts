import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantStrict } from '@/lib/tenants'

export const dynamic = 'force-dynamic'

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  )

/**
 * Per-brand sitemap from the published Puck pages of the request host's
 * tenant. Respects the editor's per-page `excludeFromSitemap`/`noindex` root
 * props. A holding-page brand exposes only its root. Product detail URLs are
 * discovered by crawlers through the shop grid; adding them here is a later
 * enhancement once the mirror carries per-channel visibility.
 */
export async function GET(request: Request) {
  const host = request.headers.get('host')
  const tenant = resolveTenantStrict(host)
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  if (!tenant || !host) return new Response('Not found', { status: 404 })

  const base = `${proto}://${host}`
  const urls: string[] = []

  if (tenant.holdingPageSlug) {
    urls.push(`${base}/`)
  } else {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'pages',
      where: {
        and: [
          // Payload's `like` is a contains match (no % syntax); the loop below
          // enforces the real folder-prefix check.
          { slug: { like: `${tenant.pageFolder}/` } },
          { _status: { equals: 'published' } },
        ],
      },
      draft: false,
      pagination: false,
      overrideAccess: false,
      depth: 0,
    })

    for (const doc of docs) {
      const rootProps = ((doc.puckData as any)?.root?.props ?? {}) as Record<string, unknown>
      if (rootProps.excludeFromSitemap === true || rootProps.noindex === true) continue
      const slug = String(doc.slug ?? '')
      if (!slug.startsWith(`${tenant.pageFolder}/`)) continue
      const path = slug.slice(tenant.pageFolder.length + 1)
      urls.push(path === 'home' ? `${base}/` : `${base}/${path}/`)
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
