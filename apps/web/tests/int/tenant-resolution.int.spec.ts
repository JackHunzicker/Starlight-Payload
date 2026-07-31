import { describe, it, expect, beforeAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  TENANTS,
  DEFAULT_TENANT_CODE,
  getTenantByCode,
  normaliseHost,
  resolveTenant,
  tenantPageSlug,
  tenantHasCommerce,
  type Tenant,
} from '@/lib/tenants'

/**
 * Hostname → brand resolution.
 *
 * This layer decides both which page tree a visitor sees and which Vendure
 * channel their cart talks to, so a mistake here shows the wrong brand's
 * catalogue at the wrong brand's prices.
 */

describe('tenant resolution', () => {
  it('maps each production hostname to its brand', () => {
    expect(resolveTenant('example.com').code).toBe('tlr')
    expect(resolveTenant('vertexsupply.example').code).toBe('tgp')
    expect(resolveTenant('orbitlabs.example').code).toBe('snm')
  })

  it('ignores port, case and a leading www', () => {
    expect(normaliseHost('WWW.Vertexreagents.com:443')).toBe('vertexsupply.example')
    expect(resolveTenant('www.orbitlabs.example:7773').code).toBe('snm')
    expect(resolveTenant('ACME COMMERCE.COM').code).toBe('tlr')
  })

  it('keeps subdomains with their parent brand', () => {
    expect(resolveTenant('staging.vertexsupply.example').code).toBe('tgp')
    expect(resolveTenant('preview.orbitlabs.example').code).toBe('snm')
  })

  it('honours the alternate domains recorded in the internal notes', () => {
    // `vertexreagent.com` (singular) and `vertexsupply-alt.example` are both owned.
    expect(resolveTenant('vertexreagent.com').code).toBe('tgp')
    expect(resolveTenant('vertexsupply-alt.example').code).toBe('tgp')
  })

  it('supports <code>.localhost for local development', () => {
    expect(resolveTenant('tgp.localhost:7773').code).toBe('tgp')
    expect(resolveTenant('snm.localhost:7773').code).toBe('snm')
    expect(resolveTenant('localhost:7773').code).toBe(DEFAULT_TENANT_CODE)
  })

  it('falls back to the default brand for unknown or missing hosts', () => {
    expect(resolveTenant(undefined).code).toBe(DEFAULT_TENANT_CODE)
    expect(resolveTenant(null).code).toBe(DEFAULT_TENANT_CODE)
    expect(resolveTenant('some-random-host.example').code).toBe(DEFAULT_TENANT_CODE)
  })

  it('prefixes storage slugs and keeps public paths bare', () => {
    // Uses a brand that is NOT behind a holding page — see the holding-page test.
    const tlr = getTenantByCode('tlr')!
    expect(tenantPageSlug(tlr, undefined)).toBe('tlr/home')
    expect(tenantPageSlug(tlr, [])).toBe('tlr/home')
    expect(tenantPageSlug(tlr, ['about'])).toBe('tlr/about')
    expect(tenantPageSlug(tlr, ['a', 'b'])).toBe('tlr/a/b')
  })

  it('collapses every path to the holding page for a brand under construction', () => {
    // The MECHANISM is asserted on an explicit tenant so it holds regardless of
    // which brands actually use it — today, none do by default.
    const held: Tenant = { ...getTenantByCode('tgp')!, holdingPageSlug: 'holding' }
    expect(tenantPageSlug(held, undefined)).toBe('tgp/holding')
    expect(tenantPageSlug(held, ['about'])).toBe('tgp/holding')
    expect(tenantPageSlug(held, ['products'])).toBe('tgp/holding')
    expect(tenantPageSlug(held, ['anything', 'deep'])).toBe('tgp/holding')
    expect(tenantHasCommerce(held)).toBe(false)

    // the owner 2026-07-31: TGP is live. The env switch is inverted and now only an
    // emergency lever — TGP_HOLDING=on puts the site back behind the holding page.
    const tgp = getTenantByCode('tgp')!
    if (process.env.TGP_HOLDING === 'on') {
      expect(tgp.holdingPageSlug).toBe('holding')
      expect(tenantHasCommerce(tgp)).toBe(false)
    } else {
      expect(tgp.holdingPageSlug).toBeUndefined()
      expect(tenantPageSlug(tgp, ['about'])).toBe('tgp/about')
      expect(tenantHasCommerce(tgp)).toBe(true)
    }
  })

  it('keeps commerce rules per brand', () => {
    // The tgp channel, its Seller and its products all still exist — a site
    // under construction simply must not be able to take an order.
    expect(tenantHasCommerce(getTenantByCode('snm')!)).toBe(false)
    expect(tenantHasCommerce(getTenantByCode('tlr')!)).toBe(true)
    // The channel is retained, so restoring the holding flag never loses the shop.
    expect(getTenantByCode('tgp')!.vendureChannelToken).toBe('tgp-storefront')
  })

  it('gives Orbit no commerce channel', () => {
    // the owner 2026-07-25: Orbit is informational, B2B by contact only, no
    // storefront. The shop proxy refuses requests for a tenant with no channel
    // rather than letting Vendure answer from its default channel — which is
    // exactly what leaked the full catalogue onto orbitlabs.example in testing.
    expect(getTenantByCode('snm')!.vendureChannelToken).toBeNull()
    expect(getTenantByCode('tlr')!.vendureChannelToken).toBe('tlr-storefront')
    expect(getTenantByCode('tgp')!.vendureChannelToken).toBe('tgp-storefront')
  })

  it('gives every tenant a distinct page folder and hostname set', () => {
    const folders = TENANTS.map((t) => t.pageFolder)
    expect(new Set(folders).size).toBe(folders.length)

    const allHosts = TENANTS.flatMap((t) => t.hostnames)
    expect(new Set(allHosts).size, 'a hostname must map to only one brand').toBe(allHosts.length)
  })
})

/**
 * The routing map and the Tenants collection are two records of the same fact.
 *
 * Routing stays in code deliberately — it runs on every page render, so reading
 * hostnames from the database would add a query to every request and make the
 * whole site depend on that lookup. The cost of that choice is exactly this risk:
 * the two can drift. These tests are what makes the choice safe.
 */
describe('routing map agrees with the Tenants collection', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('has a tenant row for every routed brand, and no orphans either way', async () => {
    const { docs } = await payload.find({ collection: 'tenants', limit: 100, pagination: false })
    const inDatabase = new Set<string>(docs.map((d) => String(d.code)))
    const inCode = new Set<string>(TENANTS.map((t) => String(t.code)))

    const missingRows = [...inCode].filter((c) => !inDatabase.has(c))
    const orphanRows = [...inDatabase].filter((c) => !inCode.has(c))

    expect(missingRows, `routed brands with no tenant row: ${missingRows.join(', ')}`).toEqual([])
    expect(
      orphanRows,
      `tenant rows nothing routes to — content saved against these is unreachable: ${orphanRows.join(', ')}`,
    ).toEqual([])
  })

  it('gives every brand exactly one brand-settings row', async () => {
    // A brand with no settings row falls back to its own name, but a brand with
    // two would render nondeterministically.
    const { docs } = await payload.find({
      collection: 'brand-settings',
      limit: 100,
      pagination: false,
      depth: 1,
    })
    const byTenant = new Map<string, number>()
    for (const doc of docs) {
      const tenant = doc.tenant as { code?: string } | number | null
      const code = typeof tenant === 'object' && tenant ? String(tenant.code) : String(tenant)
      byTenant.set(code, (byTenant.get(code) ?? 0) + 1)
    }
    for (const tenant of TENANTS) {
      expect(byTenant.get(tenant.code), `${tenant.code} should have exactly one settings row`).toBe(1)
    }
  })

  it('does not leave any page unassigned to a brand', async () => {
    // The multi-tenant plugin filters by tenant; a page with none is invisible in
    // the admin and unreachable by a tenant-scoped query.
    const { docs } = await payload.find({
      collection: 'pages',
      limit: 500,
      pagination: false,
      draft: true,
    })
    const orphans = docs.filter((d) => !d.tenant).map((d) => d.slug)
    expect(orphans, `pages belonging to no brand: ${orphans.join(', ')}`).toEqual([])
  })
})
