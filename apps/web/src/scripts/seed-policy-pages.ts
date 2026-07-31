/**
 * Seeds/updates the four TLR policy pages as PUBLISHED minimal MVP boilerplate
 * (the owner ruling 2026-07-29, §7b: "MINIMAL MVP boilerplate — no counsel gate, no
 * entity-detail collection; use the brand names and the info@ addresses").
 *
 * Content principles: short, honest, no invented legal claims — states what
 * the platform verifiably does (BTCPay bitcoin checkout, $10/$20 flat
 * shipping, research-use products, Authentik SSO accounts). A counsel pass
 * can replace any section later without structural change.
 *
 * REST-only against a RUNNING server, same as every seed script:
 *   pnpm --filter web seed:policies
 * Env: SEED_BASE_URL (default http://localhost:7773),
 *      PAYLOAD_ADMIN_EMAIL, PAYLOAD_ADMIN_PASSWORD.
 * Idempotent: existing pages are UPDATED in place (content + publish state).
 */

// A file with no imports/exports is a global script to TypeScript, so its
// consts would collide with the other seed scripts. This makes it a module.
export {}

const BASE = process.env.SEED_BASE_URL || 'http://localhost:7773'
const EMAIL = process.env.PAYLOAD_ADMIN_EMAIL
const PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD

const CONTACT = 'info@example.com'
const BRAND = 'Acme Commerce'

type Json = Record<string, any>

let blockCounter = 0
const heading = (text: string, level: 'h1' | 'h2' | 'h3' = 'h2') => ({
    type: 'Heading',
    props: { id: `Heading-policy-${++blockCounter}`, text, level },
})
const text = (content: string) => ({
    type: 'Text',
    props: { id: `Text-policy-${++blockCounter}`, content, size: 'base' },
})

const POLICIES: Array<{ slug: string; segment: string; title: string; sections: Array<[string, string]> }> = [
    {
        slug: 'tlr/privacy-policy',
        segment: 'privacy-policy',
        title: 'Privacy Policy',
        sections: [
            ['What We Collect', `Account details you provide at sign-in (name and email, via our single sign-on service), order details you enter at checkout (contact and shipping information), and the contents of your orders. Payments are processed by our self-hosted BTCPay Server — we never receive or store card numbers or bank details. Community posts you publish on our community space are visible to other visitors by design.`],
            ['How We Use It', `To fulfil and ship orders, run your account, send transactional email (order confirmations, verification, password resets), and operate the site. We do not sell personal information, and we do not run third-party advertising or tracking.`],
            ['Who We Share With', `Only the services that make the store work: our hosting provider, our email provider (for transactional mail from ${CONTACT}), and the shipping carrier handling your delivery. Nothing else.`],
            ['Retention', `Order records are kept as long as required for accounting and warranty purposes. You may request deletion of your account data at any time.`],
            ['Your Choices', `Email ${CONTACT} to access, correct, or delete your information.`],
            ['Contact', `${BRAND} — ${CONTACT}`],
        ],
    },
    {
        slug: 'tlr/terms-of-service',
        segment: 'terms-of-service',
        title: 'Terms of Service',
        sections: [
            ['Agreement', `By using this site, creating an account, or placing an order, you agree to these terms.`],
            ['Products', `Products sold on this site are supplied for research and laboratory use. Product descriptions and specifications are provided in good faith; where a specification sheet is offered, it describes the tested batch.`],
            ['Accounts', `Accounts are provided through our single sign-on service. Keep your credentials private; you are responsible for activity under your account. We may suspend accounts that abuse the platform.`],
            ['Orders and Payment', `Payment is made in Bitcoin through our BTCPay Server checkout. An order is confirmed when the payment settles on the invoice. Displayed prices are in USD; the Bitcoin amount is fixed by the invoice at checkout time.`],
            ['Shipping', `See the Shipping Policy for methods, rates, and handling times.`],
            ['Returns', `See the Returns & Refunds policy.`],
            ['Content', `Course materials, product imagery, and site content belong to ${BRAND} or its licensors and may not be reproduced commercially without permission.`],
            ['Liability', `The site and its products are provided as described. To the maximum extent permitted by law, ${BRAND} is not liable for indirect or consequential damages arising from use of the site or products.`],
            ['Contact', `Questions about these terms: ${CONTACT}`],
        ],
    },
    {
        slug: 'tlr/shipping-policy',
        segment: 'shipping-policy',
        title: 'Shipping Policy',
        sections: [
            ['Methods and Rates', `Two flat-rate methods are available at checkout: Priority Shipping at $10.00 and Express Shipping at $20.00. Rates are per order.`],
            ['Handling Time', `Orders ship after payment settles on the Bitcoin invoice. Orders are typically dispatched within 2–3 business days of settlement.`],
            ['Destinations', `We currently ship within the United States.`],
            ['Tracking', `A tracking number is emailed from ${CONTACT} once your order ships.`],
            ['Issues', `If a shipment is delayed, lost, or arrives damaged, contact ${CONTACT} and we will make it right.`],
        ],
    },
    {
        slug: 'tlr/returns-policy',
        segment: 'returns-policy',
        title: 'Returns & Refunds',
        sections: [
            ['Damaged, Defective, or Incorrect Orders', `Contact ${CONTACT} within 14 days of delivery with your order number and photos of the issue. We will replace the item or refund the order.`],
            ['Opened Consumables', `For product integrity reasons, opened consumable research products cannot be returned unless defective.`],
            ['How Refunds Are Paid', `Refunds are issued in Bitcoin via a BTCPay pull payment to an address you provide, for the USD value of the refunded items at the time the refund is approved.`],
            ['Cancellations', `An order can be cancelled any time before payment settles. After settlement, contact ${CONTACT} before the order ships.`],
            ['Contact', `${BRAND} — ${CONTACT}`],
        ],
    },
]

/**
 * Content lives inside a width-capped, centred Container.
 *
 * Bare Heading/Text blocks are full-bleed: they stretch to the viewport at any
 * width, which the site-sweep correctly flags as escaping the artboard cap
 * (every other page constrains its bands). 820px is a comfortable reading
 * measure for legal copy and sits inside the artboard span at every viewport.
 */
function buildContent(title: string, sections: Array<[string, string]>) {
    // Every page needs exactly one h1. These are documents, so it is the
    // visible document title rather than a screen-reader-only one.
    const inner: Json[] = [heading(title, 'h1')]
    for (const [sectionTitle, sectionBody] of sections) {
        inner.push(heading(sectionTitle))
        inner.push(text(sectionBody))
    }
    return [
        {
            type: 'Container',
            props: {
                id: `Container-policy-${++blockCounter}`,
                content: inner,
                semanticElement: 'div',
                dimensions: {
                    mode: 'contained',
                    maxWidth: { enabled: true, value: 820, unit: 'px' },
                    alignment: 'center',
                },
                // Container's own prop is `padding` (custom blocks use
                // `customPadding` — the shapes are NOT interchangeable and a
                // wrong key fails silently).
                padding: {
                    top: 48,
                    right: 24,
                    bottom: 64,
                    left: 24,
                    unit: 'px',
                },
            },
        },
    ]
}

function rootProps(slug: string, segment: string, title: string) {
    return {
        slug,
        title: `${title} (TLR)`,
        folder: null,
        noindex: false,
        nofollow: false,
        metaTitle: `${title} — ${BRAND}`,
        metaDescription: `${title} for ${BRAND}.`,
        isHomepage: false,
        pageLayout: 'default',
        // Layout chrome (header/footer) renders for these pages — they
        // deliberately do NOT own chrome blocks.
        showHeader: 'show',
        showFooter: 'show',
        pageSegment: segment,
        pageMaxWidth: 'default',
        conversionType: null,
        pageBackground: null,
        conversionValue: 0,
        isConversionPage: false,
        excludeFromSitemap: false,
    }
}

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

    // Publishing validates the multi-tenant assignment (drafts skip it).
    const tenants = await api('/tenants/?limit=10')
    const tlrTenant = tenants.docs?.find(
        (doc: Json) => doc.slug === 'tlr' || doc.code === 'tlr' || /acme/i.test(doc.name ?? ''),
    )
    if (!tlrTenant) throw new Error('TLR tenant not found in /tenants')

    // page-tree computes `<folder>/<segment>` ON CREATE — a bare top-level
    // `slug` is overwritten (the 2026-07-29 first pass produced
    // `privacy-policy-tlr` orphans this way). Take the TLR folder id from a
    // canonical page.
    const aboutPage = await api(`/pages/?where[slug][equals]=${encodeURIComponent('tlr/about')}&limit=1&depth=0`)
    const tlrFolder = aboutPage.docs?.[0]?.folder
    if (!tlrFolder) throw new Error('Could not resolve the TLR page-tree folder from tlr/about')

    for (const policy of POLICIES) {
        blockCounter = 0
        // Remove the misnamed first-pass draft if it is still around.
        const orphanSlug = `${policy.segment}-tlr`
        const orphan = await api(`/pages/?where[slug][equals]=${encodeURIComponent(orphanSlug)}&limit=1&draft=true`)
        if (orphan.docs?.length) {
            await api(`/pages/${orphan.docs[0].id}/`, { method: 'DELETE' })
            console.log(`deleted misnamed draft ${orphanSlug} (id ${orphan.docs[0].id})`)
        }

        const data = {
            title: `${policy.title} (TLR)`,
            folder: tlrFolder,
            pageSegment: policy.segment,
            tenant: tlrTenant.id,
            editorVersion: 'puck',
            _status: 'published',
            puckData: {
                root: { props: rootProps(policy.slug, policy.segment, policy.title) },
                content: buildContent(policy.title, policy.sections),
                zones: {},
            },
        }
        const existing = await api(`/pages/?where[slug][equals]=${encodeURIComponent(policy.slug)}&limit=1&draft=true`)
        if (existing.docs?.length) {
            const id = existing.docs[0].id
            await api(`/pages/${id}/?draft=false`, { method: 'PATCH', body: JSON.stringify(data) })
            console.log(`updated + published ${policy.slug} (id ${id})`)
        } else {
            const created = await api('/pages/?draft=false', { method: 'POST', body: JSON.stringify(data) })
            console.log(`created PUBLISHED ${policy.slug} (id ${created.doc?.id ?? created.id})`)
        }
    }
    console.log('Policy pages live: minimal MVP boilerplate (the owner ruling §7b — no counsel gate).')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
