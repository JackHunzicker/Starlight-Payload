import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/session'
import { createInviteCode } from '@/lib/sharkeyInvite'

export const dynamic = 'force-dynamic'

/**
 * POST → the caller's community invite code.
 *
 * Idempotent by design: a customer gets ONE code, stored against their account,
 * and asking again returns the same one. Minting a fresh code per request would
 * turn a signed-in customer into an invite generator for a private community.
 *
 * Requires a session, which now means a Vendure customer — so "who may join the
 * community" is answered by the store, with no second register to keep in sync.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Sign in to request an invite.' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  // Re-read rather than trusting the session copy: two tabs posting at once
  // would otherwise both see "no code" and mint two.
  const fresh = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    depth: 0,
  })
  if (fresh?.sharkeyInviteCode) {
    return Response.json({ code: fresh.sharkeyInviteCode, existing: true })
  }

  let invite
  try {
    invite = await createInviteCode()
  } catch (error) {
    console.error('[community/invite] could not mint an invite:', error)
    return Response.json(
      { error: 'The community service is not responding. Try again shortly.' },
      { status: 503 },
    )
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      sharkeyInviteCode: invite.code,
      sharkeyInviteIssuedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  return Response.json({ code: invite.code, expiresAt: invite.expiresAt, existing: false })
}
