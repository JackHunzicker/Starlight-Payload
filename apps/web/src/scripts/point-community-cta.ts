/**
 * Points the TLR Community page's CTAs at the actual community instance.
 *
 * The stored href was `/community` — the page's own URL, so "Join the
 * discussion" self-linked and never reached Sharkey. Rewrites it to the
 * `{community}` token, which PlatformHeroBlock resolves per environment from
 * NEXT_PUBLIC_COMMUNITY_URL (localhost:7777 in dev, community.<domain> in
 * production). See src/lib/externalDestinations.ts.
 *
 * REST-only against a RUNNING server; idempotent.
 *   pnpm --filter web fix:community-cta
 * Env: SEED_BASE_URL, PAYLOAD_ADMIN_EMAIL, PAYLOAD_ADMIN_PASSWORD.
 */

// A file with no imports/exports is a global script to TypeScript, so its
// consts would collide with the other seed scripts. This makes it a module.
export {}

const BASE = process.env.SEED_BASE_URL || 'http://localhost:7773'
const EMAIL = process.env.PAYLOAD_ADMIN_EMAIL
const PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD

type Json = Record<string, any>

/** Hrefs that should point at the community instance instead of a local page. */
const SELF_LINKS = new Set(['/community', '/community/'])

async function main() {
    if (!EMAIL || !PASSWORD) throw new Error('PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD are required')

    const login = await fetch(`${BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const { token } = (await login.json()) as Json
    if (!token) throw new Error('Payload admin login failed')

    const api = async (path: string, init: RequestInit = {}): Promise<Json> => {
        const response = await fetch(`${BASE}/api${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `JWT ${token}`,
                ...(init.headers ?? {}),
            },
        })
        const body = (await response.json()) as Json
        if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body).slice(0, 300)}`)
        return body
    }

    const found = await api('/pages/?where[slug][equals]=tlr%2Fcommunity&limit=1&draft=false&depth=0')
    const page = found.docs?.[0]
    if (!page) throw new Error('tlr/community page not found')

    const puckData = page.puckData as Json
    let changes = 0
    for (const node of puckData?.content ?? []) {
        if (node?.type !== 'PlatformHeroBlock') continue
        for (const key of ['ctaHref', 'secHref']) {
            const value = node.props?.[key]
            if (typeof value === 'string' && SELF_LINKS.has(value)) {
                node.props[key] = '{community}'
                changes += 1
                console.log(`  ${key}: '${value}' -> '{community}'`)
            }
        }
    }

    if (changes === 0) {
        console.log('Community CTAs already point at {community} — nothing to do.')
        return
    }

    await api(`/pages/${page.id}/?draft=false`, {
        method: 'PATCH',
        body: JSON.stringify({ puckData, _status: 'published' }),
    })
    console.log(`Updated tlr/community (id ${page.id}): ${changes} CTA(s) now resolve to the community instance.`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
