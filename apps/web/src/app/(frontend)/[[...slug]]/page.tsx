import { ClientPageRenderer } from '@/components/puck/ClientPageRenderer'
import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { Metadata } from 'next'
import { SiteChromeHeader, SiteChromeFooter } from '@/components/layout/SiteChrome'
import { resolveTenantStrict, tenantPageSlug } from '@/lib/tenants'

// CMS-driven route: without this, Next prerenders `/` at image-build time and
// serves a permanently stale 404 for pages created after the build.
export const dynamic = 'force-dynamic'

/**
 * One fetch per request, shared by generateMetadata and the page render
 * (React cache dedupes within the RSC pass).
 */
const getPublishedPage = cache(async (pageSlug: string) => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { slug: { equals: pageSlug } },
                { _status: { equals: 'published' } },
            ],
        },
        draft: false,
        limit: 1,
        overrideAccess: false,
    })
    return docs[0] ?? null
})

async function resolveRequest(params: Promise<{ slug?: string[] }>) {
    const { slug } = await params
    // Brand is resolved here rather than in middleware — see src/lib/tenants.ts.
    // Strict in production: an unknown Host means a misconfigured edge, not TLR.
    const host = (await headers()).get('host')
    const tenant = resolveTenantStrict(host)
    if (!tenant) return null
    return { slug, host, tenant, pageSlug: tenantPageSlug(tenant, slug) }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
    const request = await resolveRequest(params)
    if (!request) return {}
    const page = await getPublishedPage(request.pageSlug)
    if (!page) return {}

    const rootProps = ((page.puckData as any)?.root?.props ?? {}) as Record<string, unknown>
    const path = request.slug?.length ? `/${request.slug.join('/')}/` : '/'
    const proto = (await headers()).get('x-forwarded-proto') ?? 'http'
    const canonical = request.host ? `${proto}://${request.host}${path}` : undefined

    const title = (rootProps.metaTitle as string) || `${page.title} — ${request.tenant.name}`
    const description = (rootProps.metaDescription as string) || undefined

    return {
        title,
        description,
        ...(canonical ? { alternates: { canonical } } : {}),
        robots: {
            index: rootProps.noindex !== true,
            follow: rootProps.nofollow !== true,
        },
        openGraph: {
            title,
            description,
            siteName: request.tenant.name,
            type: 'website',
            ...(canonical ? { url: canonical } : {}),
        },
        twitter: { card: 'summary' },
    }
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
    const request = await resolveRequest(params)
    if (!request) notFound()

    // Every route resolves to a tenant-prefixed storage slug. The pre-tenancy
    // bare-slug fallback is gone: the blueprint set gave the last legacy routes
    // (`community`, `courses`) their tlr/ replacements on 2026-07-28.
    const page = await getPublishedPage(request.pageSlug)
    if (!page) notFound()

    const puckData = page.puckData as any

    if (page.editorVersion === 'puck' && puckData?.content?.length > 0) {
        // Chrome ownership, decided on the server from the page we just read.
        // A migrated page carries showHeader/showFooter: 'hide' and renders
        // SiteHeaderBlock/SiteFooterBlock itself; anything else (a plain
        // content page like the policy pages) gets the shared chrome here.
        // This replaced an injected `[data-site-chrome]{display:none}` rule
        // that hid a header the layout had already mounted.
        const rootProps = puckData?.root?.props ?? {}
        const ownsHeader = rootProps.showHeader === 'hide'
        const ownsFooter = rootProps.showFooter === 'hide'
        // SEO: the split hero renders h2s per blueprint (a tracked divergence —
        // never "fix" the visuals toward it). The homepage still needs exactly
        // one h1, so it gets a visually-hidden one carrying the brand identity.
        const isHomepage = !request.slug?.length
        return (
            <>
                {ownsHeader ? null : <SiteChromeHeader tenant={request.tenant} />}
                <main className="flex-1">
                    {isHomepage ? <h1 className="sr-only">{request.tenant.name}</h1> : null}
                    <ClientPageRenderer data={puckData} />
                </main>
                {ownsFooter ? null : <SiteChromeFooter tenant={request.tenant} />}
            </>
        )
    }

    return <div>No content available</div>
}
