'use client'
import React from 'react'
import { capOuterX } from '@/components/brand/layoutShell'

/**
 * Shared catalogue primitives, promoted out of TlrSupplierCatalogBlock so the
 * granular Puck blocks (CatalogHeroBlock, CatalogFilterBarBlock, …) and the
 * monolithic blueprint blocks render from ONE source of truth. Lives under
 * brand/ deliberately: the block-styling-contract static guard scans only
 * puck/*Block.tsx, so primitives here stay free of its wrapper rules.
 */

export type CatalogHeroVariant = 'orbit' | 'vertex' | 'vertex-full'

/**
 * Live BrandSettings for the chrome blocks (read access is `anyone`), so a
 * page that owns its chrome still honours admin edits to navLinks/footerText
 * instead of forking to the DEFAULT_NAV fallback. Null until loaded (the
 * chrome components fall back to blueprint defaults, exactly as the layout
 * does for a brand with no settings row).
 */
export function useBrandSettings(brandCode: string): Record<string, unknown> | null {
    const [settings, setSettings] = React.useState<Record<string, unknown> | null>(null)
    React.useEffect(() => {
        let cancelled = false
        fetch(`/api/brand-settings/?where[tenant.code][equals]=${encodeURIComponent(brandCode)}&depth=1&limit=1`)
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => {
                if (!cancelled && body?.docs?.[0]) setSettings(body.docs[0])
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [brandCode])
    return settings
}

export const CATALOG_HERO = {
    orbit: {
        crumb: 'Orbit Labs',
        kicker: 'Orbit Labs',
        kickerColor: 'var(--snm-ink,#2b93b8)',
        bg: 'var(--snm-hero,linear-gradient(200deg,#f2effc 0%,#edf7fc 46%,#ffffff 82%))',
        title: 'Compound particles, under 20 nanometers.',
        blurb: 'Water-soluble nano-suspensions at 10% compound concentration, in exclusive partnership with Orbit Labs.',
        note: 'We are an exclusive retail partner of Orbit Labs.',
    },
    vertex: {
        crumb: 'Vertex Supply',
        kicker: 'Vertex Supply',
        kickerColor: 'var(--tgp-ink,#17a97f)',
        bg: 'var(--tgp-hero,linear-gradient(160deg,#eefcf6 0%,#eef6fe 48%,#ffffff 82%))',
        title: 'Research reagents, made and tested in the USA.',
        blurb: 'Sixteen compounds across metabolic, hormonal, regenerative, GH-axis and mitochondrial classes. Lyophilised vials at 99% purity or better, with lot analytics published against every listing.',
        note: 'Research use only. Not for human or veterinary consumption. Not a drug, food, cosmetic or medical device.',
    },
    'vertex-full': {
        crumb: 'Vertex Supply',
        kicker: 'Vertex Supply',
        kickerColor: 'var(--tgp-ink,#17a97f)',
        bg: 'var(--tgp-hero,linear-gradient(160deg,#eefcf6 0%,#eef6fe 48%,#ffffff 82%))',
        title: 'Research reagents, made and tested in the USA.',
        blurb: '17 compounds across metabolic, hormonal, regenerative, GH-axis and mitochondrial classes. Lyophilised vials at 99% purity or better, with lot analytics published against every listing.',
        note: 'Research use only. Not for human or veterinary consumption. Not a drug, food, cosmetic or medical device.',
    },
} as const

/** One half of the 1g split hero, promoted from TlrShopHomeBlock. */
export function HeroHalf({
    side,
    kicker,
    kickerColor,
    title,
    blurb,
    button,
    buttonBg,
    buttonInk,
    buttonHref,
    note,
}: {
    side: 'left' | 'right'
    kicker: string
    kickerColor: string
    title: string
    blurb: string
    button: string
    buttonBg: string
    buttonInk: string
    buttonHref: string
    note: string
}) {
    // Each half of the 1280 sheet carries 544px of content behind 48px gutters;
    // the outer gutter grows on ultrawide, the centre-seam gutter stays fixed.
    // Below md the halves stack full-width and the outer-pad formula would
    // start growing from 640px viewport — the max-md escape pins both gutters
    // to the artboard 48px in the stacked band.
    const outerPad = capOuterX(48, 544)
    return (
        <div
            className="max-md:!px-12"
            style={{
                padding: '78px 48px 74px',
                ...(side === 'left' ? { paddingLeft: outerPad } : { paddingRight: outerPad }),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 20,
                justifyContent: 'center',
                background:
                    side === 'left'
                        ? 'var(--snm-hero,linear-gradient(200deg,#f2effc 0%,#edf7fc 46%,#ffffff 82%))'
                        : 'var(--tgp-hero,linear-gradient(160deg,#eefcf6 0%,#eef6fe 48%,#ffffff 82%))',
                borderRight: side === 'left' ? '1px solid var(--rule-soft,#eef2f6)' : undefined,
            }}
        >
            <div
                style={{
                    fontSize: 11.5,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: kickerColor,
                }}
            >
                {kicker}
            </div>
            <h2
                style={{
                    margin: 0,
                    fontSize: 33,
                    fontWeight: 600,
                    letterSpacing: '-.022em',
                    lineHeight: 1.14,
                    minHeight: '3.42em',
                    maxWidth: '15ch',
                    textWrap: 'balance',
                }}
            >
                {title}
            </h2>
            <p
                style={{
                    margin: 0,
                    maxWidth: '44ch',
                    minHeight: '4.86em',
                    fontSize: 15.5,
                    lineHeight: 1.62,
                    color: 'var(--ink-2,#64748b)',
                    textWrap: 'pretty',
                }}
            >
                {blurb}
            </p>
            <a
                href={buttonHref}
                style={{
                    marginTop: 4,
                    width: 190,
                    padding: '11px 0',
                    borderRadius: 9,
                    textAlign: 'center',
                    background: buttonBg,
                    border: `1px solid ${buttonBg}`,
                    color: buttonInk,
                    fontSize: 14,
                    fontWeight: 650,
                }}
            >
                {button}
            </a>
            <div style={{ fontSize: 11, color: 'var(--ink-4,#94a3b8)' }}>{note}</div>
        </div>
    )
}

/** TGP's mono-uppercase chip (Spectral pages), promoted from TgpShopBlock. */
export function MonoChip({ label, active }: { label: string; active?: boolean }) {
    return (
        <span
            style={
                active
                    ? {
                          padding: '7px 14px',
                          borderRadius: 999,
                          background: 'var(--tgp-btn,#0f8f6b)',
                          border: '1px solid var(--tgp-btn-edge,#0f8f6b)',
                          color: 'var(--tgp-btn-ink,#ffffff)',
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 11,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          fontWeight: 500,
                      }
                    : {
                          padding: '7px 14px',
                          borderRadius: 999,
                          border: '1px solid var(--rule,#e2e8f0)',
                          color: 'var(--ink-3,#475569)',
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 11,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          fontWeight: 400,
                      }
            }
        >
            {label}
        </span>
    )
}

export function Chip({ label, active, activeBg }: { label: string; active?: boolean; activeBg?: string }) {
    return (
        <span
            style={
                active
                    ? {
                          padding: '7px 14px',
                          borderRadius: 999,
                          background: activeBg,
                          border: `1px solid ${activeBg}`,
                          color: 'var(--snm-btn-ink,#ffffff)',
                          fontSize: 12.5,
                          fontWeight: 600,
                      }
                    : {
                          padding: '7px 14px',
                          borderRadius: 999,
                          border: '1px solid var(--rule,#e2e8f0)',
                          color: 'var(--ink-3,#475569)',
                          fontSize: 12.5,
                          fontWeight: 500,
                      }
            }
        >
            {label}
        </span>
    )
}
