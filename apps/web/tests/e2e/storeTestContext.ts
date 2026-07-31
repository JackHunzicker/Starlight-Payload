import type { APIRequestContext } from '@playwright/test'

/**
 * Fixture context for e2e specs that create pages.
 *
 * Since the multi-tenant plugin, `pages` requires an assigned tenant; and
 * since the legacy bare-slug fallback was removed (2026-07-28), a page is only
 * routable when it lives in a tenant folder — payload-page-tree stores its
 * slug as `<folder>/<title-slug>` and the resolver prefixes every public path
 * the same way. Test pages therefore go into the TLR folder.
 */
export async function storeTestContext(request: APIRequestContext, token: string) {
    const auth = { headers: { Authorization: `JWT ${token}` } }
    const tenants = await request.get('/api/tenants?where[code][equals]=tlr&limit=1', auth)
    const tenantId = (await tenants.json()).docs?.[0]?.id
    const folders = await request.get('/api/payload-folders?where[name][equals]=tlr&limit=1', auth)
    const folderId = (await folders.json()).docs?.[0]?.id
    if (!tenantId || !folderId) {
        throw new Error('tlr tenant/folder rows not found — seed the brand page tree first')
    }
    return { tenantId, folderId }
}

/** Stored slugs are tenant-prefixed (`tlr/…`); the public URL never carries the prefix. */
export const publicPath = (slug: string) => `/${slug.replace(/^[^/]+\//, '')}/`
