import type { Payload } from 'payload'

/**
 * Vendure is the storefront identity; the Payload user is derived from it.
 *
 * The browser never talks to Vendure directly — `/api/shop` proxies it
 * server-side and stores Vendure's session token in a FIRST-PARTY httpOnly
 * cookie on the storefront origin. That is what makes this pattern simple:
 * there is no cross-origin cookie, no SameSite negotiation and no CORS, because
 * as far as the browser is concerned only example.com exists.
 */
export const VENDURE_TOKEN_COOKIE = 'vendure-auth-token'

export interface VendureCustomer {
  id: string
  emailAddress: string
  firstName?: string | null
  lastName?: string | null
}

const ACTIVE_CUSTOMER_QUERY = `
  query ActiveCustomer {
    activeCustomer { id emailAddress firstName lastName }
  }
`

export interface CustomerOverview extends VendureCustomer {
  addresses?: Array<{
    id: string
    streetLine1: string
    streetLine2?: string | null
    city?: string | null
    postalCode?: string | null
    country: { name: string }
  }> | null
  orders: {
    totalItems: number
    items: Array<{
      id: string
      code: string
      state: string
      orderPlacedAt?: string | null
      totalWithTax: number
      currencyCode: string
      lines: Array<{ quantity: number; productVariant: { name: string } }>
    }>
  }
}

const OVERVIEW_QUERY = `
  query CustomerOverview {
    activeCustomer {
      id emailAddress firstName lastName
      addresses { id streetLine1 streetLine2 city postalCode country { name } }
      orders(options: { take: 20, sort: { createdAt: DESC } }) {
        totalItems
        items {
          id code state orderPlacedAt totalWithTax currencyCode
          lines { quantity productVariant { name } }
        }
      }
    }
  }
`

/**
 * Everything the account page needs in one round-trip: who they are, where they
 * ship, and what they have bought. This is the whole point of moving identity to
 * Vendure — the previous session could answer the first question and neither of
 * the other two.
 */
export async function fetchCustomerOverview(
  token: string,
  channelToken: string,
): Promise<CustomerOverview | null> {
  const endpoint = process.env.VENDURE_INTERNAL_URL || 'http://localhost:7774/shop-api'
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'vendure-token': channelToken,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: OVERVIEW_QUERY }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { data?: { activeCustomer?: CustomerOverview | null } }
    return body?.data?.activeCustomer ?? null
  } catch (error) {
    console.error('[vendureIdentity] customer overview failed:', error)
    return null
  }
}

/** Pull the Vendure session token out of a raw Cookie header. */
export function readVendureToken(headers: Headers): string | undefined {
  const cookie = headers.get('cookie')
  if (!cookie) return undefined
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === VENDURE_TOKEN_COOKIE) return rest.join('=') || undefined
  }
  return undefined
}

/**
 * Ask Vendure who this token belongs to. Server-to-server over the internal
 * network, so the channel token has to be supplied explicitly — a tokenless
 * request answers from the DEFAULT channel, which is the same trap `/api/shop`
 * guards against.
 */
export async function fetchVendureCustomer(
  token: string,
  channelToken: string,
): Promise<VendureCustomer | null> {
  const endpoint = process.env.VENDURE_INTERNAL_URL || 'http://localhost:7774/shop-api'
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'vendure-token': channelToken,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: ACTIVE_CUSTOMER_QUERY }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { data?: { activeCustomer?: VendureCustomer | null } }
    return body?.data?.activeCustomer ?? null
  } catch (error) {
    // Never throw out of an auth path: a Vendure blip must read as "not signed
    // in", not as a 500 on every page that calls `auth()`.
    console.error('[vendureIdentity] activeCustomer lookup failed:', error)
    return null
  }
}

/**
 * Find — or create on first sight — the Payload user that mirrors a Vendure
 * customer.
 *
 * Keyed on the Vendure customer id, never the email: an email change in Vendure
 * is a supported, verified flow, and keying on it would silently fork the
 * account into two rows the next time someone used it.
 *
 * Always writes `roles: ['customer']` on create and never on update. Roles are
 * authorization, and authorization does not come from the storefront — an
 * upgrade to admin/editor is a deliberate act in the admin panel, protected by
 * the field-level access rules on the collection.
 */
export async function resolvePayloadUser(payload: Payload, customer: VendureCustomer) {
  const existing = await payload.find({
    collection: 'users',
    where: { vendureCustomerId: { equals: customer.id } },
    limit: 1,
    overrideAccess: true,
  })

  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()

  if (existing.docs.length > 0) {
    const user = existing.docs[0]
    // Mirror profile drift from Vendure, but touch nothing else.
    if (user.email !== customer.emailAddress || (displayName && user.name !== displayName)) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          email: customer.emailAddress,
          ...(displayName ? { name: displayName } : {}),
        },
        overrideAccess: true,
      })
    }
    return user
  }

  const created = await payload.create({
    collection: 'users',
    data: {
      email: customer.emailAddress,
      vendureCustomerId: customer.id,
      ...(displayName ? { name: displayName } : {}),
      roles: ['customer'],
      accountType: 'b2c',
      hasLibraryAccess: false,
      // Payload's auth collection requires a password. This account is never
      // signed into with one — Vendure holds the credential — so it gets an
      // unguessable value that is deliberately never stored anywhere.
      password: crypto.randomUUID() + crypto.randomUUID(),
    },
    overrideAccess: true,
  })
  return created
}
