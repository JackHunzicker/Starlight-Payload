/**
 * Community access, keyed off the Vendure customer.
 *
 * Sharkey cannot consume OIDC — upstream misskey-dev#9132 is still open — so
 * there is no SSO to build, with any identity provider. What Sharkey does
 * support is invite codes, and its registration is closed except by invite,
 * which makes an issued code the exact equivalent of "this store customer may
 * join". That is what "accounts tied to the store" means in practice here.
 *
 * The alternative people reach for — writing users straight into Sharkey's
 * database — is a trap: a user spans 14+ tables and needs a generated RSA
 * keypair in `user_keypair` for its ActivityPub identity, against a pinned
 * build with a large Misskey rebase queued upstream.
 */

const SHARKEY_URL = process.env.SHARKEY_INTERNAL_URL || process.env.SHARKEY_URL
const USERNAME = process.env.SHARKEY_ADMIN_USERNAME
const PASSWORD = process.env.SHARKEY_ADMIN_PASSWORD

export interface InviteCode {
  code: string
  expiresAt: string | null
}

async function sharkeyApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!SHARKEY_URL) throw new Error('SHARKEY_URL is not configured')
  const response = await fetch(`${SHARKEY_URL.replace(/\/+$/, '')}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`sharkey ${endpoint} responded ${response.status}`)
  }
  return (await response.json()) as T
}

/**
 * Mint one invite code.
 *
 * Admin credentials live only on the server and are used per request rather
 * than held in a long-lived token — this runs rarely (once per customer), so
 * the extra sign-in costs nothing worth optimising away.
 *
 * Codes expire. An invite that never expires is a bearer credential to a
 * private community, and one pasted into a forum three years from now should
 * not still work.
 */
export async function createInviteCode(expiryDays = 30): Promise<InviteCode> {
  if (!USERNAME || !PASSWORD) {
    throw new Error('SHARKEY_ADMIN_USERNAME and SHARKEY_ADMIN_PASSWORD are required')
  }
  const signin = await sharkeyApi<{ i?: string }>('signin-flow', {
    username: USERNAME,
    password: PASSWORD,
  })
  if (!signin.i) throw new Error('sharkey admin sign-in returned no token')

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
  const tickets = await sharkeyApi<Array<{ code: string; expiresAt: string | null }>>(
    'admin/invite/create',
    { i: signin.i, count: 1, expiresAt },
  )
  const ticket = tickets?.[0]
  if (!ticket?.code) throw new Error('sharkey returned no invite code')
  return { code: ticket.code, expiresAt: ticket.expiresAt }
}
