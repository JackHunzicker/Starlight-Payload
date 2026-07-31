import { NextRequest } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { invokeCloudAi } from './core/cloud-handler'
import { invokeBridgeAi } from './core/bridge-handler'
import { hasRole } from '@/access'

// Claude can take minutes on a complex page; never cut the stream short.
export const maxDuration = 600

/**
 * Puck AI traffic controller.
 *
 * Single Payload auth gate in front of BOTH branches (the Cloud handler
 * re-checks internally, which is harmless), then:
 *   PUCK_AI_MODE=bridge → local Claude Code bridge (subscription OAuth, no API key)
 *   otherwise           → official Puck Cloud proxy (PUCK_API_KEY)
 */
export async function POST(req: NextRequest) {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: req.headers, canSetHeaders: false })
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Authenticated is not sufficient: storefront customers live in the same
    // `users` collection. Driving the page-building AI is a staff capability,
    // and on the bridge path it also spends the operator Claude subscription quota.
    if (!hasRole(user, 'admin', 'editor')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (process.env.PUCK_AI_MODE === 'bridge') {
        console.log('[Puck AI] Routing to local Claude Code bridge')
        return invokeBridgeAi(req)
    }
    console.log('[Puck AI] Routing to OFFICIAL Puck Cloud proxy')
    return invokeCloudAi(req)
}
