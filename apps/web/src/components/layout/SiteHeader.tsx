'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'
import { SNM_CAP_48, TLR_CAP_40 } from '@/components/brand/layoutShell'
import { SnmEmblem, TgpMark, TlrMark } from '@/components/brand/marks'

export type BrandCode = 'snm' | 'tlr' | 'tgp'

export interface SiteHeaderProps {
    settings: any
    session?: any
    /**
     * Whether this brand sells anything. Orbit Labs is informational
     * and B2B-by-contact only, so it must not show a cart — and must not call the
     * Shop API, which correctly refuses a brand with no Vendure channel and would
     * otherwise log a 404 on every page load.
     *
     * Defaults to true so the Puck editor preview and any existing caller keep
     * their commerce UI without change.
     */
    hasCommerce?: boolean
    /** Which brand chrome to render. Defaults to the TLR storefront. */
    brand?: BrandCode
}

interface NavLink {
    label: string
    url: string
    openInNewTab?: boolean
    /** Marks the Learn tab's "Soon" chip (TLR only). */
    soon?: boolean
}

/** Blueprint navs. BrandSettings.navLinks, when seeded, overrides label/url. */
const DEFAULT_NAV: Record<BrandCode, NavLink[]> = {
    tlr: [
        { label: 'Shop', url: '/' },
        { label: 'Community', url: '/community' },
        { label: 'Learn', url: '/learn', soon: true },
        { label: 'About', url: '/about' },
    ],
    snm: [
        { label: 'About', url: '/about' },
        { label: 'Technology', url: '/technology' },
        { label: 'Data', url: '/data' },
    ],
    tgp: [
        { label: 'Shop', url: '/' },
        { label: 'About', url: '/about' },
    ],
}

/**
 * One cart read per page view, however many headers mount.
 *
 * A Puck page that owns its chrome renders a SiteHeader block while the
 * layout's copy is still mounted (hidden via CSS), so the naive per-instance
 * effect fired the Shop API query twice on every page view. The in-flight
 * promise is shared and then released, so a later mount still reads fresh.
 */
let inFlightCartRead: Promise<number> | null = null

function readCartCount(): Promise<number> {
    if (!inFlightCartRead) {
        inFlightCartRead = vendureShopRequest<{ activeOrder: { totalQuantity: number } | null }>(
            'query HeaderCart { activeOrder { totalQuantity } }',
        )
            .then((data) => data.activeOrder?.totalQuantity || 0)
            .catch(() => 0)
            .finally(() => {
                inFlightCartRead = null
            })
    }
    return inFlightCartRead
}

function useCartCount(hasCommerce: boolean) {
    const [cartCount, setCartCount] = useState(0)
    useEffect(() => {
        if (!hasCommerce) return
        let active = true
        readCartCount().then((count) => {
            if (active) setCartCount(count)
        })
        const updateCart = (event: Event) => setCartCount(Number((event as CustomEvent).detail) || 0)
        window.addEventListener('cart-updated', updateCart)
        return () => {
            active = false
            window.removeEventListener('cart-updated', updateCart)
        }
    }, [hasCommerce])
    return cartCount
}

function navFromSettings(settings: any, brand: BrandCode): NavLink[] {
    const links: NavLink[] | undefined = settings?.navLinks?.length
        ? settings.navLinks.map((l: any) => ({
              label: l.label,
              url: l.url,
              openInNewTab: l.openInNewTab,
              soon: brand === 'tlr' && l.label === 'Learn',
          }))
        : undefined
    return links ?? DEFAULT_NAV[brand]
}

function isActive(pathname: string, url: string): boolean {
    if (url === '/') return pathname === '/' || pathname.startsWith('/orbit') || pathname.startsWith('/vertex')
    return pathname === url || pathname.startsWith(`${url}/`)
}

/** The TLR "Soon" chip, verbatim from the blueprint header. */
function SoonChip() {
    return (
        <span
            style={{
                fontSize: 9,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                border: '1px solid var(--rule,#e2e8f0)',
                borderRadius: 4,
                padding: '2px 5px',
                color: 'var(--ink-4,#94a3b8)',
            }}
        >
            Soon
        </span>
    )
}

/** Line-art cart glyph — the owner ruled out the literal word (2026-07-29). */
function CartIcon() {
    return (
        <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
            <path d="M2.5 3.5h2.6l2.3 12.1a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3l1.6-8.6H6.1" />
        </svg>
    )
}

function CartWidget({ count, badgeColor, mobile }: { count: number; badgeColor: string; mobile?: boolean }) {
    return (
        <Link
            href="/cart"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 500,
                color: 'var(--ink-3,#475569)',
                // WCAG 2.5.8: the icon alone is ~19px; give the mobile header
                // instance a full-size tap target.
                ...(mobile ? { minWidth: 44, minHeight: 44, justifyContent: 'center' } : {}),
            }}
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
        >
            <CartIcon />
            {count > 0 ? (
                // aria-hidden: the count is already in the link's aria-label;
                // without it screen readers announce "Cart, 2 items 2".
                <span
                    aria-hidden="true"
                    style={{
                        minWidth: 19,
                        height: 19,
                        padding: '0 5px',
                        borderRadius: 999,
                        background: badgeColor,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {count}
                </span>
            ) : null}
        </Link>
    )
}

/** Mobile disclosure nav shared by all three brands (the blueprints are desktop artwork). */
function MobileNav({ nav }: { nav: NavLink[] }) {
    return (
        <details className="relative md:hidden">
            <summary
                className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md"
                aria-label="Open navigation menu"
                style={{ color: 'var(--ink-3,#475569)' }}
            >
                <span aria-hidden="true">☰</span>
            </summary>
            <nav
                className="absolute right-0 top-12 z-50 min-w-52 rounded-xl p-2 shadow-xl"
                style={{ background: 'var(--bg,#ffffff)', border: '1px solid var(--rule,#e2e8f0)' }}
            >
                {nav.map((link) => (
                    <Link
                        key={`${link.label}-${link.url}`}
                        href={link.url}
                        className="block rounded-lg px-4 py-3 text-sm font-medium"
                        style={{ color: 'var(--ink,#0f172a)' }}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
        </details>
    )
}

function TlrHeader({ settings, hasCommerce }: { settings: any; hasCommerce: boolean }) {
    const pathname = usePathname() ?? '/'
    const cartCount = useCartCount(hasCommerce)
    const nav = navFromSettings(settings, 'tlr')
    const platform = ['/about', '/community', '/learn'].some((p) => pathname.startsWith(p))
    return (
        <div className="storefront-vars" style={{ background: 'var(--bg,#ffffff)' }}>
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 70,
                    padding: `0 ${TLR_CAP_40}`,
                    borderBottom: '1px solid var(--rule,#e2e8f0)',
                }}
            >
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TlrMark width={17.2} height={23.8} strokeWidth={6} />
                    <div
                        style={{
                            fontSize: 16.5,
                            fontWeight: 650,
                            letterSpacing: '-.015em',
                            lineHeight: 1,
                            color: 'var(--ink,#0f172a)',
                        }}
                    >
                        Acme<span>&#8209;</span>Commerce
                    </div>
                </Link>
                <nav className="hidden md:flex" style={{ alignItems: 'center', gap: 30, fontSize: 13.5 }}>
                    {nav.map((link) => {
                        const active = isActive(pathname, link.url)
                        return (
                            <Link
                                key={`${link.label}-${link.url}`}
                                href={link.url}
                                style={{
                                    color: active ? 'var(--ink,#0f172a)' : 'var(--ink-3,#475569)',
                                    fontWeight: active ? 600 : 500,
                                    display: link.soon ? 'inline-flex' : undefined,
                                    alignItems: link.soon ? 'center' : undefined,
                                    gap: link.soon ? 7 : undefined,
                                }}
                            >
                                {link.label}
                                {link.soon ? <SoonChip /> : null}
                            </Link>
                        )
                    })}
                    <span style={{ width: 1, height: 22, background: 'var(--rule,#e2e8f0)' }} />
                    {hasCommerce ? <CartWidget count={cartCount} badgeColor="var(--tlr-cart-badge,#7A6FDC)" /> : null}
                </nav>
                {/* Mobile: the conventional header-bar cart icon beside the hamburger. */}
                <div className="flex items-center gap-1 md:hidden">
                    {hasCommerce ? <CartWidget count={cartCount} badgeColor="var(--tlr-cart-badge,#7A6FDC)" mobile /> : null}
                    <MobileNav nav={nav} />
                </div>
            </header>
            <div className="hairline-tlr" style={{ height: 2, opacity: platform ? 0.9 : undefined }} />
        </div>
    )
}

function SnmHeader({ settings }: { settings: any }) {
    const pathname = usePathname() ?? '/'
    const nav = navFromSettings(settings, 'snm')
    return (
        <div>
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 76,
                    padding: `0 ${SNM_CAP_48}`,
                    background: 'var(--tl-background)',
                    borderBottom: '1px solid var(--tl-border)',
                }}
            >
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <SnmEmblem size={26} />
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span
                            style={{
                                fontSize: 17,
                                fontWeight: 650,
                                letterSpacing: '-.01em',
                                color: 'var(--tl-foreground)',
                            }}
                        >
                            Orbit
                        </span>
                        <span
                            style={{
                                fontSize: 17,
                                fontWeight: 400,
                                letterSpacing: '.01em',
                                color: 'var(--tl-muted-foreground)',
                            }}
                        >
                            Orbit Labs
                        </span>
                    </div>
                </Link>
                <nav className="hidden md:flex" style={{ alignItems: 'center', gap: 36 }}>
                    {nav.map((link) => {
                        const active = isActive(pathname, link.url)
                        return (
                            <Link
                                key={`${link.label}-${link.url}`}
                                href={link.url}
                                style={
                                    active
                                        ? {
                                              fontSize: 14,
                                              fontWeight: 600,
                                              color: 'var(--tl-foreground)',
                                              borderBottom: '2px solid var(--snm-aqua,#2ba2c8)',
                                              paddingBottom: 3,
                                          }
                                        : { fontSize: 14, fontWeight: 500, color: 'var(--tl-muted-foreground)' }
                                }
                            >
                                {link.label}
                            </Link>
                        )
                    })}
                    <Link
                        href="/contact"
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--tl-foreground)',
                            border: '1px solid var(--tl-border)',
                            padding: '8px 18px',
                            borderRadius: 8,
                        }}
                    >
                        Contact us
                    </Link>
                </nav>
                <MobileNav nav={[...nav, { label: 'Contact us', url: '/contact' }]} />
            </header>
            <div className="hairline-snm" style={{ height: 2 }} />
        </div>
    )
}

function TgpHeader({ settings, hasCommerce }: { settings: any; hasCommerce: boolean }) {
    const pathname = usePathname() ?? '/'
    const cartCount = useCartCount(hasCommerce)
    const nav = navFromSettings(settings, 'tgp')
    return (
        <div
            className="storefront-vars"
            style={{ background: 'var(--bg,#ffffff)', fontFamily: "Spectral,'Iowan Old Style',Georgia,serif" }}
        >
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 70,
                    padding: `0 ${TLR_CAP_40}`,
                    borderBottom: '1px solid var(--rule,#e2e8f0)',
                }}
            >
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <TgpMark width={27.8} height={25} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div
                            style={{
                                fontSize: 16.5,
                                fontWeight: 500,
                                letterSpacing: '.004em',
                                lineHeight: 1,
                                color: 'var(--ink,#0f172a)',
                            }}
                        >
                            Vertex
                        </div>
                        <div
                            style={{
                                fontFamily: "'JetBrains Mono',monospace",
                                fontSize: 8.5,
                                fontWeight: 400,
                                letterSpacing: '.26em',
                                textTransform: 'uppercase',
                                color: 'var(--ink-4,#94a3b8)',
                                lineHeight: 1,
                            }}
                        >
                            Reagents
                        </div>
                    </div>
                </Link>
                <nav
                    className="hidden md:flex"
                    style={{
                        alignItems: 'center',
                        gap: 26,
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11.5,
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    {nav.map((link) => {
                        const active = isActive(pathname, link.url)
                        return (
                            <Link
                                key={`${link.label}-${link.url}`}
                                href={link.url}
                                style={{
                                    color: active ? 'var(--ink,#0f172a)' : 'var(--ink-3,#475569)',
                                    fontWeight: active ? 600 : 500,
                                }}
                            >
                                {link.label}
                            </Link>
                        )
                    })}
                    <span style={{ width: 1, height: 22, background: 'var(--rule,#e2e8f0)' }} />
                    {hasCommerce ? <CartWidget count={cartCount} badgeColor="var(--tgp-button,#0F8F6B)" /> : null}
                </nav>
                {/* Mobile: the conventional header-bar cart icon beside the hamburger. */}
                <div className="flex items-center gap-1 md:hidden">
                    {hasCommerce ? <CartWidget count={cartCount} badgeColor="var(--tgp-button,#0F8F6B)" mobile /> : null}
                    <MobileNav nav={nav} />
                </div>
            </header>
            {/* No hairline strip on TGP (the owner ruling 2026-07-29): the spectral
                hairline is the shared chrome signature of the TLR/SNM family,
                and TGP must not visually read as a related entity. */}
        </div>
    )
}

export function SiteHeader({ settings, session: _session, hasCommerce = true, brand = 'tlr' }: SiteHeaderProps) {
    if (brand === 'snm') return <SnmHeader settings={settings} />
    if (brand === 'tgp') return <TgpHeader settings={settings} hasCommerce={hasCommerce} />
    return <TlrHeader settings={settings} hasCommerce={hasCommerce} />
}
