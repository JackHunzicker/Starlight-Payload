import { timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { createInviteCode } from '@/lib/sharkeyInvite'

export const dynamic = 'force-dynamic'

/** Constant-time compare so the secret cannot be recovered by timing. */
function secretMatches(provided: string | null): boolean {
    const expected = process.env.VENDURE_WEBHOOK_SECRET
    if (!expected || !provided) return false
    const a = Buffer.from(provided, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Called by Vendure's community-invite job when an order reaches PaymentSettled.
 *
 * Issues the invite the customer would otherwise have to request, and emails it.
 * Service-to-service only — never reachable from a browser session, because
 * "has paid" is a claim only Vendure can make.
 */
export async function POST(request: Request) {
    if (!secretMatches(request.headers.get('x-webhook-secret'))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let customerId: string | undefined
    let orderCode: string | undefined
    try {
        const body = await request.json()
        customerId = body?.customerId ? String(body.customerId) : undefined
        orderCode = body?.orderCode ? String(body.orderCode) : undefined
    } catch {
        return Response.json({ error: 'Expected JSON.' }, { status: 400 })
    }
    if (!customerId) {
        return Response.json({ error: 'customerId is required.' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const found = await payload.find({
        collection: 'users',
        where: { vendureCustomerId: { equals: customerId } },
        limit: 1,
        overrideAccess: true,
    })
    const user = found.docs[0]
    if (!user) {
        // The Payload user is created when the customer first authenticates on
        // the storefront. Someone can pay without ever having done that, and
        // that is not an error — they will be given the invite the moment they
        // sign in, by the account page. 200 so the job does not retry forever.
        return Response.json({ skipped: 'no account for this customer yet' })
    }
    if (user.sharkeyInviteCode) {
        return Response.json({ code: user.sharkeyInviteCode, existing: true })
    }

    const invite = await createInviteCode()
    await payload.update({
        collection: 'users',
        id: user.id,
        data: {
            sharkeyInviteCode: invite.code,
            sharkeyInviteIssuedAt: new Date().toISOString(),
        },
        overrideAccess: true,
    })

    const communityUrl = process.env.NEXT_PUBLIC_COMMUNITY_URL || 'https://community.example.com'
    try {
        await payload.sendEmail({
            to: user.email,
            subject: 'Your Acme Commerce community invite',
            html: `
                <p>Thank you for your order${orderCode ? ` (${orderCode})` : ''}.</p>
                <p>Your invite to the Acme Commerce community:</p>
                <p style="font-family:monospace;font-size:18px"><strong>${invite.code}</strong></p>
                <p>Enter it when you sign up at <a href="${communityUrl}">${communityUrl}</a>.
                   The code is valid for 30 days and is tied to your account.</p>
            `,
        })
    } catch (error) {
        // The code is already stored and shown on the account page, so a mail
        // failure must not fail the job and mint a second one on retry.
        console.error('[community/auto-invite] invite email failed:', error)
    }

    return Response.json({ code: invite.code, existing: false })
}
