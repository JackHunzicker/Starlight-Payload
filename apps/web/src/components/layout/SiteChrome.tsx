import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { tenantHasCommerce, type Tenant } from '@/lib/tenants'

/**
 * Brand chrome, rendered by whoever OWNS it for a given route.
 *
 * Ownership is decided on the server, not patched afterwards:
 *   - Infrastructure routes (cart, checkout, login, account, products,
 *     courses) live under the `(chrome)` route group, whose layout renders
 *     this.
 *   - Puck pages render their own chrome as SiteHeaderBlock/SiteFooterBlock
 *     in content, and the catch-all route renders this only for a page whose
 *     root props do NOT say `showHeader/showFooter: 'hide'`.
 *
 * Before this split, the `(frontend)` layout rendered chrome unconditionally
 * and a page that owned its own chrome suppressed the layout's copy with an
 * injected `[data-site-chrome]{display:none}` rule — so a hidden header still
 * mounted on every page view. Deciding on the server removes both the hack
 * and the wasted mount.
 */

async function getBrandSettings(tenant: Tenant) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'brand-settings',
    where: { 'tenant.code': { equals: tenant.code } },
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

export async function SiteChromeHeader({ tenant }: { tenant: Tenant }) {
  // No session fetch here: SiteHeader takes the prop but never reads it, and
  // resolving one costs a Vendure round-trip plus a Payload query on EVERY
  // page render. Header state that depends on sign-in should ask for it where
  // it is actually rendered.
  const settings = await getBrandSettings(tenant)
  return (
    <SiteHeader
      settings={settings ?? { siteName: tenant.name }}
      // A brand with no Vendure channel, or one behind a holding page, must
      // not render a cart or poll the Shop API.
      hasCommerce={tenantHasCommerce(tenant)}
      brand={tenant.code}
    />
  )
}

export async function SiteChromeFooter({ tenant }: { tenant: Tenant }) {
  const settings = await getBrandSettings(tenant)
  return <SiteFooter settings={settings ?? { siteName: tenant.name }} brand={tenant.code} />
}

export { getBrandSettings }
