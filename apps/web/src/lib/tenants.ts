/**
 * Three brands, one platform.
 *
 * Implements `docs/10-architecture/Multi-Brand Architecture Decision`:
 * one Next app, one Payload, one Vendure. The brand is resolved from the request
 * hostname inside the page component — deliberately NOT in middleware, which runs
 * on every asset request in the Edge runtime for no gain here.
 *
 * Public URLs stay bare: a visitor sees `/about`, while storage uses the
 * tenant-prefixed slug `tlr/about`. The prefix exists so Payload's global unique
 * slug index is satisfied by construction rather than fought.
 */

export type TenantCode = 'tlr' | 'tgp' | 'snm'

export type Tenant = {
  code: TenantCode
  name: string
  /**
   * An array, not a single `domain`, so parked/vanity/country domains are data
   * entry later rather than a migration. Hostnames are compared lowercased and
   * without port or leading `www.`.
   */
  hostnames: string[]
  /**
   * Vendure channel token, or null for a brand that sells nothing.
   * SNM is informational and B2B-by-contact only — it has no channel by design
   * (the owner, 2026-07-25). Acme Commerce is Orbit's exclusive retail partner.
   */
  vendureChannelToken: string | null
  /** Page-tree folder that owns this brand's pages. */
  pageFolder: string
  /**
   * When set, EVERY path on this brand's domain serves this one page and the
   * brand's commerce is treated as switched off.
   *
   * This is how a brand goes "under construction" without deleting anything: its
   * other pages, its Vendure channel, its Seller and its products all stay
   * exactly where they are, simply unreachable. Removing this line brings the
   * whole site back.
   */
  holdingPageSlug?: string
}

export const TENANTS: readonly Tenant[] = [
  {
    code: 'tlr',
    name: 'Acme Commerce',
    hostnames: ['example.com', 'acmecommerce.com'],
    vendureChannelToken: 'tlr-storefront',
    pageFolder: 'tlr',
  },
  {
    code: 'tgp',
    name: 'Vertex Supply',
    // vertexreagent.com (singular) and vertexsupply-alt.example are recorded as owned in
    // the internal `Vertex Supply` canonical note.
    hostnames: ['vertexsupply.example', 'vertexreagent.com', 'vertexsupply-alt.example'],
    vendureChannelToken: 'tgp-storefront',
    pageFolder: 'tgp',
    // the owner, 2026-07-31: TGP is LIVE. The 2026-07-27 holding posture is retired —
    // pricing and stock exist, and TGP sells through its own Vendure channel so
    // its takings stay separately accountable from TLR's.
    // The switch is kept, inverted, as an emergency lever: TGP_HOLDING=on
    // (server env) puts the site back behind `tgp/holding` without a rebuild.
    ...(process.env.TGP_HOLDING === 'on' ? { holdingPageSlug: 'holding' } : {}),
  },
  {
    code: 'snm',
    name: 'Orbit Labs',
    // the owner 2026-07-24: lead with orbitlabs.example for the generic-word ownership;
    // orbitlabs-alt.example is owned but parked and can be added here without a migration.
    hostnames: ['orbitlabs.example'],
    vendureChannelToken: null,
    pageFolder: 'snm',
  },
] as const

/** Used for localhost and for any host we do not recognise. */
export const DEFAULT_TENANT_CODE: TenantCode = 'tlr'

/**
 * Production posture (TENANT_STRICT_HOSTS=true): Caddy only routes the known
 * hostnames, so a request with an unrecognised Host header means a
 * misconfigured edge or a direct hit — serve 404, never a brand fallback.
 * Dev keeps the TLR fallback (plain localhost, tailnet addresses, previews).
 */
const STRICT_TENANT_HOSTS = process.env.TENANT_STRICT_HOSTS === 'true'

export const getTenantByCode = (code: string): Tenant | undefined =>
  TENANTS.find((tenant) => tenant.code === code)

/** Strips port, lowercases, and drops a leading `www.`. */
export const normaliseHost = (host: string): string =>
  host.trim().toLowerCase().split(':')[0].replace(/^www\./, '')

/**
 * Maps a request hostname to a brand.
 *
 * Local development: `tgp.localhost:7773` and `snm.localhost:7773` select those
 * brands, and plain `localhost` falls through to the default. Next.js serves
 * `*.localhost` without any hosts-file entry, so all three sites are reachable
 * on one dev server.
 */
export function resolveTenant(host?: string | null): Tenant {
  return matchTenant(host) ?? getTenantByCode(DEFAULT_TENANT_CODE)!
}

/**
 * Strict variant for request-serving surfaces (the catch-all page, the shop
 * proxy): under TENANT_STRICT_HOSTS an unknown host resolves to `null` and the
 * caller must 404. Elsewhere (the layout shell around an error page) the
 * forgiving `resolveTenant` stays appropriate.
 */
export function resolveTenantStrict(host?: string | null): Tenant | null {
  const match = matchTenant(host)
  if (match) return match
  return STRICT_TENANT_HOSTS ? null : getTenantByCode(DEFAULT_TENANT_CODE)!
}

function matchTenant(host?: string | null): Tenant | null {
  if (!host) return null

  const normalised = normaliseHost(host)

  const exact = TENANTS.find((tenant) => tenant.hostnames.includes(normalised))
  if (exact) return exact

  // Subdomains of a brand domain (e.g. `staging.vertexsupply.example`) stay with
  // that brand.
  const parent = TENANTS.find((tenant) =>
    tenant.hostnames.some((hostname) => normalised.endsWith(`.${hostname}`)),
  )
  if (parent) return parent

  // Development convenience: `<code>.localhost`, `<code>.local`, `<code>.test`.
  const [label, ...rest] = normalised.split('.')
  if (rest.length && ['localhost', 'local', 'test'].includes(rest[rest.length - 1])) {
    const byLabel = getTenantByCode(label)
    if (byLabel) return byLabel
  }

  return null
}

/**
 * Storage slug for a public path.
 *
 * `/` becomes `<folder>/home`; `/about` becomes `<folder>/about`. The public URL
 * never contains the prefix — the resolver adds it on lookup and nothing else in
 * the app needs to know.
 */
export function tenantPageSlug(tenant: Tenant, segments?: string[]): string {
  // Under construction: every path collapses to the holding page, so no deep link
  // or stale index entry can reach content that is not ready to be seen.
  if (tenant.holdingPageSlug) return `${tenant.pageFolder}/${tenant.holdingPageSlug}`
  const path = segments?.filter(Boolean).join('/') || 'home'
  return `${tenant.pageFolder}/${path}`
}

/**
 * Whether this brand should expose a cart, a checkout and the Shop API.
 *
 * False for a brand with no channel (Orbit) AND for one behind a holding page
 * — a site under construction must not offer to sell anything, even though its
 * channel and products still exist behind the scenes.
 */
export function tenantHasCommerce(tenant: Tenant): boolean {
  return Boolean(tenant.vendureChannelToken) && !tenant.holdingPageSlug
}

/**
 * REMOVED 2026-07-28: `legacyPageSlug` — the pre-tenancy bare-slug fallback.
 * Every live route now has a tenant-prefixed page (the blueprint set gave
 * `community` and `courses` their `tlr/` replacements, the last holdouts), so
 * the fallback — and the cross-brand-leak guard it needed — is gone. The old
 * bare-slug pages are preserved unpublished as TEST pattern references.
 */
