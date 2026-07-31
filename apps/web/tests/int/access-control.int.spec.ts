import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { hasRole, isStaff, isAdmin, publishedOrStaff, isSelfOrStaff } from '@/access'
import { PAYLOAD_INTERNAL_COLLECTIONS } from '@/access/hardenPluginAccess'

import { describe, it, beforeAll, expect } from 'vitest'

/**
 * Standing guard on the authorization boundary.
 *
 * The 2026-07-25 audit found that `users` is one `auth: true` collection shared by
 * CMS staff and public SSO customers, while every content collection gated writes on
 * `Boolean(req.user)`. Any customer who signed in could publish or delete any page,
 * and four collections shipped with no `access` block at all.
 *
 * These tests assert the *class* of bug is gone, not just the instances: every
 * collection must declare explicit write access, and no write gate may be satisfied
 * by a bare customer.
 */

let payload: Payload

/** A storefront customer — the exact shape SSO sign-in mints in `src/auth.ts`. */
const customer = { id: 999, email: 'customer@example.com', roles: ['customer'] }
const editor = { id: 998, email: 'editor@example.com', roles: ['editor'] }
const admin = { id: 997, email: 'admin@example.com', roles: ['admin'] }

const req = (user: unknown) => ({ req: { user } }) as never

describe('access control: role helpers', () => {
  it('denies when roles are absent, malformed, or the user is anonymous', () => {
    expect(hasRole(null, 'admin')).toBe(false)
    expect(hasRole(undefined, 'admin')).toBe(false)
    expect(hasRole({}, 'admin')).toBe(false)
    expect(hasRole({ roles: undefined }, 'admin')).toBe(false)
    // A pre-roles user document, or a failed relationship load, must not grant.
    expect(hasRole({ roles: null }, 'admin')).toBe(false)
    expect(hasRole({ roles: 'admin' }, 'admin')).toBe(false)
    expect(hasRole({ roles: [] }, 'admin')).toBe(false)
  })

  it('does not let a customer satisfy a staff or admin gate', () => {
    expect(hasRole(customer, 'admin')).toBe(false)
    expect(hasRole(customer, 'admin', 'editor')).toBe(false)
    expect(isStaff(req(customer))).toBe(false)
    expect(isAdmin(req(customer))).toBe(false)
  })

  it('grants staff to editors and admins, but delete only to admins', () => {
    expect(isStaff(req(editor))).toBe(true)
    expect(isStaff(req(admin))).toBe(true)
    expect(isAdmin(req(editor))).toBe(false)
    expect(isAdmin(req(admin))).toBe(true)
  })

  it('constrains public reads to published rather than refusing outright', () => {
    expect(publishedOrStaff('_status')(req(null))).toEqual({ _status: { equals: 'published' } })
    expect(publishedOrStaff('_status')(req(customer))).toEqual({ _status: { equals: 'published' } })
    expect(publishedOrStaff('_status')(req(editor))).toBe(true)
  })

  it('scopes self-service reads to the requesting user', () => {
    expect(isSelfOrStaff('user')(req(customer))).toEqual({ user: { equals: 999 } })
    expect(isSelfOrStaff('user')(req(null))).toBe(false)
    expect(isSelfOrStaff('user')(req(admin))).toBe(true)
  })
})

describe('access control: collection contract', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('every collection declares explicit create, update and delete access', () => {
    const missing = payload.config.collections
      .filter((c) => !c.access?.create || !c.access?.update || !c.access?.delete)
      .map((c) => c.slug)
    expect(
      missing,
      `collections relying on Payload's default (any authenticated user) access: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('no collection lets a bare customer create, update or delete', async () => {
    const offenders: string[] = []
    for (const collection of payload.config.collections) {
      // Payload's own bookkeeping collections are excluded deliberately and on
      // evidence — see PAYLOAD_INTERNAL_COLLECTIONS for the per-collection
      // justification. Anything else appearing here is a real finding: add it to
      // PLUGIN_COLLECTIONS_TO_HARDEN rather than widening this exclusion.
      if ((PAYLOAD_INTERNAL_COLLECTIONS as readonly string[]).includes(collection.slug)) continue
      for (const op of ['create', 'update', 'delete'] as const) {
        const fn = collection.access?.[op]
        if (!fn) continue
        // `true` means unconditionally allowed; a query constraint still scopes the write.
        const result = await fn(req(customer))
        if (result === true) offenders.push(`${collection.slug}.${op}`)
      }
    }
    expect(
      offenders,
      `a storefront customer can perform these writes: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('gates the Admin Panel so customers cannot open it', async () => {
    const users = payload.config.collections.find((c) => c.slug === 'users')
    expect(users?.access?.admin, 'users collection must declare access.admin').toBeTypeOf('function')
    expect(await users!.access!.admin!(req(customer))).toBe(false)
    expect(await users!.access!.admin!(req(null))).toBe(false)
    expect(await users!.access!.admin!(req(editor))).toBe(true)
    expect(await users!.access!.admin!(req(admin))).toBe(true)
  })

  it('protects the roles field itself against privilege escalation', () => {
    const users = payload.config.collections.find((c) => c.slug === 'users')
    const roles = users?.fields.find((f) => 'name' in f && f.name === 'roles')
    expect(roles, 'users.roles field must exist').toBeDefined()
    const access = (roles as { access?: Record<string, unknown> }).access
    // Without field-level access a user with `update` on their own record could
    // simply append 'admin' to their own roles array.
    expect(access?.create, 'roles.access.create must be admin-only').toBeTypeOf('function')
    expect(access?.update, 'roles.access.update must be admin-only').toBeTypeOf('function')
    expect((access!.update as (a: unknown) => boolean)(req(customer))).toBe(false)
    expect((access!.update as (a: unknown) => boolean)(req(editor))).toBe(false)
    expect((access!.update as (a: unknown) => boolean)(req(admin))).toBe(true)
  })
})

describe('access control: enforced through the Payload API', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('refuses a page create performed as a customer', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        overrideAccess: false,
        user: customer as never,
        data: { title: 'Customer should not be able to publish this' } as never,
      }),
    ).rejects.toThrow()
  })

  it('refuses a course delete performed as a customer', async () => {
    await expect(
      payload.delete({
        collection: 'courses',
        overrideAccess: false,
        user: customer as never,
        where: {},
      }),
    ).rejects.toThrow()
  })

  it('refuses a self-granted enrollment', async () => {
    await expect(
      payload.create({
        collection: 'enrollments',
        overrideAccess: false,
        user: customer as never,
        data: { user: 999, course: 1, role: 'student' } as never,
      }),
    ).rejects.toThrow()
  })
})
