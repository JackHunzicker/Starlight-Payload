import { headers as nextHeaders, cookies as nextCookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantStrict, tenantHasCommerce } from '@/lib/tenants'
import {
  VENDURE_TOKEN_COOKIE,
  fetchVendureCustomer,
  resolvePayloadUser,
  type VendureCustomer,
} from '@/lib/vendureIdentity'

/**
 * The one place anything server-side asks "who is this?".
 *
 * Replaces the next-auth `auth()` helper. The identity is the Vendure customer;
 * the Payload user is derived from it, so a signed-in visitor is simultaneously
 * someone with orders (Vendure) and someone with enrollments (Payload) — which
 * the previous Authentik-backed session could never be, because it had no link
 * to commerce at all.
 */
export interface CurrentSession {
  customer: VendureCustomer
  user: Awaited<ReturnType<typeof resolvePayloadUser>>
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await nextCookies()
  const token = cookieStore.get(VENDURE_TOKEN_COOKIE)?.value
  if (!token) return null

  // The channel must come from the request host for the same reason `/api/shop`
  // insists on it: a tokenless lookup answers from Vendure's DEFAULT channel.
  const headerList = await nextHeaders()
  const tenant = resolveTenantStrict(headerList.get('host'))
  if (!tenant || !tenantHasCommerce(tenant) || !tenant.vendureChannelToken) return null

  const customer = await fetchVendureCustomer(token, tenant.vendureChannelToken)
  if (!customer) return null

  const payload = await getPayload({ config })
  const user = await resolvePayloadUser(payload, customer)
  return { customer, user }
}

/** Convenience for callers that only need the Payload user. */
export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null
}
