import { resolveTenantStrict } from '@/lib/tenants'

export const dynamic = 'force-dynamic'

/**
 * Host-aware robots.txt (Next's static app/robots.ts cannot see the request
 * host, and this one app serves three brands). Infrastructure and account
 * surfaces are disallowed; a brand behind a holding page or an unknown host
 * discourages crawling entirely.
 */
export async function GET(request: Request) {
  const host = request.headers.get('host')
  const tenant = resolveTenantStrict(host)
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'

  const body =
    !tenant || tenant.holdingPageSlug
      ? ['User-agent: *', 'Disallow: /', ''].join('\n')
      : [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /admin/',
          'Disallow: /account/',
          'Disallow: /cart/',
          'Disallow: /checkout/',
          'Disallow: /login/',
          '',
          `Sitemap: ${proto}://${host}/sitemap.xml`,
          '',
        ].join('\n')

  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}
