/**
 * Sharkey → Acme Community: the OVERLAY rebrand.
 *
 * Never a fork (standing policy): every change here is
 * instance STATE applied through Sharkey's own admin API, so the pinned image
 * (2025.4.7) upgrades cleanly and nothing has to be re-patched. Re-runnable —
 * it reads current meta, applies the overlay, and reports what changed.
 *
 * What it sets:
 *   - identity: instance name/short name/description, maintainer, theme colour
 *   - branding: TLR mark as icon/app icon, served from the storefront origin
 *   - policy: federation OFF (private instance — the owner: "there is no federation
 *     for sharkey", it is a private rebranded instance), closed registration,
 *     no public timelines for anonymous visitors
 *   - Sharkey identity surfaces removed from the UI via customCss (the
 *     supported injection point) using the TLR deep-space tokens
 *   - policy links pointed at the real TLR pages
 *
 * Usage (against a RUNNING Sharkey):
 *   node apps/sharkey/rebrand.mjs
 * Env: SHARKEY_URL (default http://localhost:7777),
 *      SHARKEY_ADMIN_USERNAME, SHARKEY_ADMIN_PASSWORD,
 *      TLR_PUBLIC_URL (default http://localhost:7773) — where the marks and
 *      policy pages are served from.
 */

const BASE = (process.env.SHARKEY_URL || 'http://localhost:7777').replace(/\/+$/, '')
const TLR = (process.env.TLR_PUBLIC_URL || 'http://localhost:7773').replace(/\/+$/, '')
const USERNAME = process.env.SHARKEY_ADMIN_USERNAME
const PASSWORD = process.env.SHARKEY_ADMIN_PASSWORD

if (!USERNAME || !PASSWORD) {
    console.error('SHARKEY_ADMIN_USERNAME and SHARKEY_ADMIN_PASSWORD are required')
    process.exit(1)
}

/**
 * House tokens, verbatim from apps/web/src/app/(frontend)/styles.css.
 *
 * Accent is the TLR BLUE (`--tlr-day-action` / `--tlr-bright`), not the
 * purple `--tlr-cart-badge` (the owner 2026-07-29: the purple theme is out) and not
 * Orbit's aqua — the standing ruling reserves teal as SNM's signature, so
 * it must not become another brand's chrome. Blue on deep space is the shared
 * TLR/SNM family ground and reads as the same house as the storefronts.
 */
const TOKENS = {
    space0: '#070b16', // --space-0
    space1: '#0b1224', // --space-1
    space2: '#111a32', // --space-2
    space3: '#1b2540', // --space-3
    spaceInk: '#eef4ff', // --space-ink
    spaceInk2: '#8ea2c4', // --space-ink-2
    // the owner 2026-07-29: darker space blue, not the bright one. --tlr-bright
    // is the deep step; --tlr-night-action is the near-navy used for the
    // big enacme shapes so the splash reads as deep space, not a colour field.
    accent: '#2a55c9', // --tlr-bright
    accentDeep: '#16224a', // --tlr-night-action
    link: '#6f9dff', // readable step above the accent on dark ground
    green: '#3fd9a8', // hairline green — success/renote only
}

/**
 * Instance themes, in Sharkey's own theme format.
 *
 * NOTE for the next session: this Sharkey version (2025.4.7) has NO
 * `customCss` column — the meta table exposes `defaultDarkTheme` /
 * `defaultLightTheme` instead. That is the better overlay hook anyway: it is
 * the platform's native theming mechanism, so it survives upgrades without a
 * single patched file. `:darken<n<@x` / `:alpha<n<@x` are Sharkey's own
 * colour functions and `@name` references another prop.
 */
const darkTheme = {
    // Theme ids MUST be real UUIDs — the client validates them and a
    // malformed id kills the whole boot with SOMETHING_HAPPENED_IN_PROMISE
    // (a hand-written 'pretty' id did exactly that on 2026-07-29).
    // They are also CACHE KEYS: Sharkey stores the resolved theme in the
    // client's localStorage under this id, so changing colours while keeping
    // the id leaves every returning visitor on the OLD palette forever.
    // Bump the id whenever the palette changes.
    id: 'f21029f2-efe2-4a71-8904-27aacc7e7182',
    base: 'dark',
    name: 'Acme Commerce Deep Space',
    author: 'Acme Commerce',
    desc: 'The house deep-space palette.',
    props: {
        bg: TOKENS.space0,
        fg: TOKENS.spaceInk,
        panel: TOKENS.space1,
        popup: TOKENS.space2,
        accent: TOKENS.accent,
        link: TOKENS.link,
        navBg: TOKENS.space1,
        navFg: '@fg',
        header: ':alpha<0.7<@panel',
        divider: 'rgba(142, 162, 196, 0.16)',
        indicator: '@accent',
        mention: '@accent',
        mentionMe: '@mention',
        hashtag: TOKENS.link,
        renote: TOKENS.green,
        success: TOKENS.green,
        error: '#eb6f92',
        warn: '#f6c177',
        badge: TOKENS.link,
        focus: ':alpha<0.3<@accent',
        shadow: 'rgba(0, 0, 0, 0.4)',
        modalBg: 'rgba(7, 11, 22, 0.6)',
        panelHighlight: TOKENS.space2,
        panelHeaderBg: TOKENS.space2,
        panelHeaderFg: '@fg',
        panelBorder: '" solid 1px var(--MI_THEME-divider)',
        buttonBg: 'rgba(255, 255, 255, 0.05)',
        buttonHoverBg: 'rgba(255, 255, 255, 0.1)',
        inputBorder: 'rgba(142, 162, 196, 0.2)',
        inputBorderHover: 'rgba(142, 162, 196, 0.35)',
        switchBg: 'rgba(255, 255, 255, 0.15)',
        accentedBg: ':alpha<0.15<@accent',
        accentDarken: TOKENS.accentDeep,
        accentLighten: TOKENS.link,
        fgOnAccent: '#ffffff',
        fgHighlighted: ':lighten<3<@fg',
        fgTransparent: ':alpha<0.5<@fg',
        fgTransparentWeak: TOKENS.spaceInk2,
        dateLabelFg: '@fg',
        infoBg: TOKENS.space3,
        infoFg: '@fg',
        infoWarnBg: TOKENS.space3,
        infoWarnFg: '#f6c177',
        listItemHoverBg: 'rgba(255, 255, 255, 0.03)',
        scrollbarHandle: 'rgba(142, 162, 196, 0.25)',
        scrollbarHandleHover: 'rgba(142, 162, 196, 0.45)',
        htmlThemeColor: '@bg',
        buttonGradateA: '@accent',
        buttonGradateB: TOKENS.accentDeep,
        driveFolderBg: ':alpha<0.3<@accent',
        acrylicBg: ':alpha<0.5<@bg',
        acrylicPanel: ':alpha<0.5<@panel',
        navActive: '@accent',
        navIndicator: '@indicator',
        navHoverFg: ':lighten<17<@fg',
        messageBg: '@bg',
        cwBg: TOKENS.space2,
        cwFg: '#f6c177',
        cwHoverBg: TOKENS.space3,
    },
}

const lightTheme = {
    id: '3cc27ad6-6133-4a4e-b43d-2aee0be7c77d',
    base: 'light',
    name: 'Acme Commerce Light',
    author: 'Acme Commerce',
    desc: 'The house palette on the storefront ground.',
    props: {
        bg: '#ffffff',
        fg: '#0f172a',
        panel: '#ffffff',
        popup: '#ffffff',
        accent: TOKENS.accent,
        link: TOKENS.accentDeep,
        navBg: '@panel',
        navFg: '@fg',
        header: ':alpha<0.7<@panel',
        divider: '#e2e8f0',
        indicator: '@accent',
        mention: '@accent',
        mentionMe: '@mention',
        hashtag: TOKENS.accentDeep,
        renote: '#0f8f6b', // DEMO-free green, light ground
        success: '#0f8f6b',
        error: '#d1435b',
        warn: '#b8860b',
        badge: '@accent',
        focus: ':alpha<0.3<@accent',
        shadow: 'rgba(15, 23, 42, 0.12)',
        modalBg: 'rgba(15, 23, 42, 0.4)',
        panelHighlight: '#f6f8fc',
        panelHeaderBg: '#f6f8fc',
        panelHeaderFg: '@fg',
        panelBorder: '" solid 1px var(--MI_THEME-divider)',
        buttonBg: 'rgba(15, 23, 42, 0.05)',
        buttonHoverBg: 'rgba(15, 23, 42, 0.1)',
        inputBorder: '#cmpa5e1',
        inputBorderHover: '#94a3b8',
        switchBg: 'rgba(15, 23, 42, 0.15)',
        accentedBg: ':alpha<0.12<@accent',
        accentDarken: ':darken<10<@accent',
        accentLighten: ':lighten<10<@accent',
        fgOnAccent: '#ffffff',
        fgHighlighted: ':darken<3<@fg',
        fgTransparent: ':alpha<0.5<@fg',
        fgTransparentWeak: '#64748b',
        dateLabelFg: '@fg',
        infoBg: '#eef2ff',
        infoFg: '#0f172a',
        infoWarnBg: '#fef3c7',
        infoWarnFg: '#92400e',
        listItemHoverBg: 'rgba(15, 23, 42, 0.03)',
        scrollbarHandle: 'rgba(100, 116, 139, 0.3)',
        scrollbarHandleHover: 'rgba(100, 116, 139, 0.5)',
        htmlThemeColor: '@bg',
        buttonGradateA: '@accent',
        buttonGradateB: TOKENS.accentDeep,
        driveFolderBg: ':alpha<0.2<@accent',
        acrylicBg: ':alpha<0.5<@bg',
        acrylicPanel: ':alpha<0.5<@panel',
        navActive: '@accent',
        navIndicator: '@indicator',
        navHoverFg: ':darken<17<@fg',
        messageBg: '@bg',
        cwBg: '#e2e8f0',
        cwFg: '#92400e',
        cwHoverBg: '#cmpa5e1',
    },
}

/**
 * Refuse to ship a theme the client will reject.
 *
 * Sharkey validates the theme `id` as a UUID and a malformed one takes the
 * whole app down at boot with SOMETHING_HAPPENED_IN_PROMISE — a blank error
 * page, not a graceful fallback. A hand-written "readable" id did exactly
 * that on 2026-07-29. Failing here costs a re-run; failing there costs the
 * instance.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function assertTheme(theme, label) {
    if (!UUID_RE.test(theme.id)) {
        throw new Error(
            `${label} theme id is not a valid UUID: "${theme.id}". Sharkey rejects it and ` +
                'the client fails to boot. Generate one with `crypto.randomUUID()`.',
        )
    }
    if (!theme.props || Object.keys(theme.props).length === 0) {
        throw new Error(`${label} theme has no props`)
    }
}

async function api(endpoint, body, token) {
    const response = await fetch(`${BASE}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { ...body, i: token } : body),
    })
    const text = await response.text()
    let parsed
    try {
        parsed = text ? JSON.parse(text) : {}
    } catch {
        parsed = { raw: text }
    }
    if (!response.ok) {
        throw new Error(`${endpoint} -> ${response.status}: ${JSON.stringify(parsed).slice(0, 300)}`)
    }
    return parsed
}

async function main() {
    assertTheme(darkTheme, 'dark')
    assertTheme(lightTheme, 'light')

    const signin = await api('signin-flow', { username: USERNAME, password: PASSWORD })
    const token = signin.i
    if (!token) throw new Error(`signin did not return a token: ${JSON.stringify(signin).slice(0, 200)}`)

    const before = await api('meta', { detail: true })

    const overlay = {
        name: 'Acme Community',
        shortName: 'Acme Commerce',
        description:
            'The private community space for Acme Commerce — orbitlabs, research reagents, and the people working with them.',
        maintainerName: 'Acme Commerce',
        maintainerEmail: 'info@example.com',
        themeColor: TOKENS.accent,
        iconUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        app192IconUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        app512IconUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        sidebarLogoUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        logoImageUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        // Sharkey's mascot/info art is the most visible upstream identity
        // surface. Clearing it works for info/404/error — but NOT for the
        // mascot: null makes Sharkey fall back to its bundled `/assets/ai.png`
        // character, which is exactly what we are trying to be rid of. Verified
        // on the live instance 2026-07-31, where meta still reported
        // `/assets/ai.png` long after this script had "cleared" it. Point it at
        // the TLR mark instead so there is nothing to fall back to.
        mascotImageUrl: `${TLR}/brand/tlr/mark-dark.svg`,
        infoImageUrl: null,
        notFoundImageUrl: null,
        serverErrorImageUrl: null,
        bannerUrl: `${TLR}/brand/tlr/community-bg.svg`,
        // NOT null: the welcome page interpolates this straight into
        // `background-image: url(...)` with no guard, so an unset value
        // literally requests "/null".
        backgroundImageUrl: `${TLR}/brand/tlr/community-bg.svg`,
        // Private instance: no federation, no open registration.
        federation: 'none',
        disableRegistration: true,
        privacyPolicyUrl: `${TLR}/privacy-policy/`,
        // `tosUrl` is the API PARAMETER; it lands in the `termsOfServiceUrl`
        // column. Sending the column name instead is silently ignored — it is
        // not in the endpoint's schema — which is why the signup dialog's
        // "important notes" kept falling through to Sharkey's own page.
        tosUrl: `${TLR}/terms-of-service/`,
        feedbackUrl: 'mailto:info@example.com',
        inquiryUrl: 'mailto:info@example.com',
        // NEVER null on these. A null does not mean "no link" — Sharkey falls
        // back to its own project URLs, so nulling them is exactly how
        // activitypub.software/TransFem-org ends up on the instance.
        //
        // repositoryUrl deliberately stays upstream: AGPL-3.0 §13 obliges us to
        // offer network users the Corresponding Source, and this instance runs
        // unmodified upstream code (our changes are admin settings and
        // bind-mounted assets, not patches). Pointing it at example.com
        // would break that offer. It surfaces on /about, in the licence
        // context, which is where it belongs — not on a signup dialog.
        repositoryUrl: 'https://activitypub.software/TransFem-org/Sharkey',
        impressumUrl: `${TLR}/terms-of-service/`,
        donationUrl: '',
        defaultDarkTheme: JSON.stringify(darkTheme),
        defaultLightTheme: JSON.stringify(lightTheme),
    }

    await api('admin/update-meta', overlay, token)

    const after = await api('meta', { detail: true })
    const changed = []
    for (const key of ['name', 'shortName', 'description', 'themeColor', 'iconUrl', 'privacyPolicyUrl', 'mascotImageUrl']) {
        if (before[key] !== after[key]) changed.push(`${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`)
    }

    const themeName = (() => {
        try {
            return JSON.parse(after.defaultDarkTheme || '{}').name
        } catch {
            return undefined
        }
    })()

    console.log('Acme Community overlay applied.')
    for (const line of changed) console.log(`  ${line}`)
    if (!changed.length) console.log('  (identity already applied — idempotent re-run)')
    console.log(`  federation: ${after.federation ?? 'n/a'} · registration disabled: ${after.disableRegistration}`)
    console.log(`  default dark theme: ${themeName ?? '(unset)'}`)

    await verify(after)
}

/**
 * Read the instance back and fail if anything upstream survived.
 *
 * This exists because every rebrand miss so far has been SILENT, and each one
 * looked fine from the apply side:
 *
 *   - `tosUrl` was sent under its column name, so the endpoint dropped it and
 *     the signup dialog kept linking to Sharkey's own notes.
 *   - The mascot/404/error art was "cleared" to null, and null means Sharkey
 *     serves its bundled cartoon instead of nothing.
 *   - `repositoryUrl: null` put activitypub.software on the About page.
 *
 * Applying settings proves nothing. Reading them back is the only check that
 * catches a field the API quietly ignored, and it keeps working after an
 * upgrade renames or drops one.
 */
async function verify(meta) {
    const problems = []

    // A null here is never "blank" — it is "fall back to upstream".
    const mustBeSet = [
        'name', 'shortName', 'description', 'iconUrl', 'themeColor',
        'privacyPolicyUrl', 'tosUrl', 'repositoryUrl', 'feedbackUrl',
        'mascotImageUrl', 'bannerUrl', 'backgroundImageUrl',
    ]
    for (const key of mustBeSet) {
        const value = meta[key]
        if (value === null || value === undefined || value === '') {
            problems.push(`${key} is ${JSON.stringify(value)} — Sharkey will substitute its own`)
        }
    }

    // Upstream identity must not appear anywhere a member can read, with the
    // single deliberate exception of repositoryUrl (the AGPL source offer).
    const UPSTREAM = /transfem|joinsharkey|activitypub\.software|misskey/i
    for (const [key, value] of Object.entries(meta)) {
        if (key === 'repositoryUrl' || typeof value !== 'string') continue
        if (UPSTREAM.test(value)) problems.push(`${key} still carries upstream branding: ${value.slice(0, 80)}`)
    }

    if (meta.federation !== 'none') problems.push(`federation is "${meta.federation}", expected "none"`)
    if (meta.disableRegistration !== true) problems.push('registration is OPEN')

    // The bind-mounted empty-state art. Upstream ships 6578 / 26966 / 36452
    // bytes; ours are ~4 KB. If an upgrade moves these paths the mount goes
    // stale silently and the cartoons come back, so check the bytes served.
    for (const asset of ['status/missingpage.webp', 'status/error.png', 'status/nothinghere.png']) {
        try {
            const response = await fetch(`${BASE}/client-assets/${asset}`)
            const size = (await response.arrayBuffer()).byteLength
            if (size > 8000) problems.push(`${asset} is ${size} bytes — upstream art is being served, the bind-mount is not in effect`)
        } catch (error) {
            problems.push(`${asset} could not be fetched: ${error.message}`)
        }
    }

    if (problems.length) {
        console.error('\nVERIFY FAILED — upstream branding is still reachable:')
        for (const problem of problems) console.error(`  - ${problem}`)
        process.exit(1)
    }
    console.log('  verify: no upstream branding reachable (settings + empty-state art)')
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
})
