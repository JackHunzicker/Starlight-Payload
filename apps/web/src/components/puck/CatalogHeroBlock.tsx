'use client'
import React from 'react'
import Link from 'next/link'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40 } from '@/components/brand/layoutShell'
import { CATALOG_HERO } from '@/components/brand/catalogKit'

/**
 * Granular catalogue hero (livetest decomposition of the 1ga hero band):
 * breadcrumb, kicker, headline, blurb and compliance note are individually
 * editable; the accent picks the brand wash and ink ramp. Defaults reproduce
 * the Orbit hero verbatim.
 */

interface CatalogHeroBlockProps {
    visibility?: any
    accent: 'snm' | 'tgp'
    crumb: string
    kicker: string
    title: string
    blurb: string
    note: string
    /**
     * Optional trailing link and partner lockup. The Orbit hero is not a
     * compliance footnote like the reagent one — it states the retail
     * relationship, so it needs a way through to Orbit and the powered-by
     * badge beneath (the owner, 2026-07-31). Leave blank on any hero that only
     * carries small print.
     */
    noteLinkLabel: string
    noteLinkHref: string
    showPartnerBadge: 'yes' | 'no'
}

const ACCENTS = {
    snm: { kickerColor: CATALOG_HERO.orbit.kickerColor, bg: CATALOG_HERO.orbit.bg },
    tgp: { kickerColor: CATALOG_HERO.vertex.kickerColor, bg: CATALOG_HERO.vertex.bg },
} as const

function CatalogHeroBlockRender(rawProps: CatalogHeroBlockProps) {
    const { visibility, accent, crumb, kicker, title, blurb, note, noteLinkLabel, noteLinkHref, showPartnerBadge: badge } =
        withDefaults(rawProps, defaultProps)
    // Gated on the accent as well as the flag. Stored pages predate these props,
    // so withDefaults injects the defaults into EVERY existing hero — including
    // Vertex's, whose note is a research-use-only disclaimer and must never
    // carry a Orbit lockup or a link to orbitlabs.example.
    const isOrbit = accent === 'snm'
    const showPartnerBadge = isOrbit && badge === 'yes'
    const showNoteLink = isOrbit && Boolean(noteLinkLabel && noteLinkHref)
    const ramp = ACCENTS[accent] ?? ACCENTS.snm
    return (
        <BlockShell visibility={visibility} prefix="puck-catalog-hero" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div
                    style={{
                        padding: `52px ${TLR_CAP_40} 44px`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 15,
                        background: ramp.bg,
                        borderBottom: '1px solid var(--rule-soft,#eef2f6)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            fontSize: 12.5,
                            color: 'var(--ink-4,#94a3b8)',
                        }}
                    >
                        <Link href="/" style={{ color: 'var(--ink-4,#94a3b8)' }}>
                            Shop
                        </Link>
                        <span>/</span>
                        <span style={{ color: 'var(--ink-3,#475569)', fontWeight: 500 }}>{crumb}</span>
                    </div>
                    <div
                        style={{
                            fontSize: 11.5,
                            letterSpacing: '.14em',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            color: ramp.kickerColor,
                        }}
                    >
                        {kicker}
                    </div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: 38,
                            fontWeight: 600,
                            letterSpacing: '-.024em',
                            lineHeight: 1.12,
                            maxWidth: '22ch',
                            textWrap: 'balance',
                        }}
                    >
                        {title}
                    </h1>
                    <p
                        style={{
                            margin: 0,
                            maxWidth: '62ch',
                            fontSize: 16,
                            lineHeight: 1.62,
                            color: 'var(--ink-2,#64748b)',
                            textWrap: 'pretty',
                        }}
                    >
                        {blurb}
                    </p>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4,#94a3b8)' }}>
                        {note}
                        {showNoteLink ? (
                            <>
                                {' '}
                                <a
                                    href={noteLinkHref}
                                    style={{ color: 'var(--snm-ink,#2b93b8)', fontWeight: 600, textDecoration: 'none' }}
                                >
                                    {noteLinkLabel}
                                </a>
                            </>
                        ) : null}
                    </div>
                    {showPartnerBadge ? (
                        // `.badge-auto` is the canonical powered-by lockup and swaps
                        // light/dark by theme from styles.css — never an <img>, or it
                        // inverts against a dark background.
                        <div
                            className="badge-auto"
                            role="img"
                            aria-label="Powered by Orbit Labs"
                            style={{ width: 186, height: 33, marginTop: 14 }}
                        />
                    ) : null}
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: CatalogHeroBlockProps = {
    visibility: null,
    accent: 'snm',
    crumb: CATALOG_HERO.orbit.crumb,
    kicker: CATALOG_HERO.orbit.kicker,
    title: CATALOG_HERO.orbit.title,
    blurb: CATALOG_HERO.orbit.blurb,
    note: CATALOG_HERO.orbit.note,
    noteLinkLabel: 'Learn more',
    noteLinkHref: 'https://orbitlabs.example/',
    showPartnerBadge: 'yes',
}

export const CatalogHeroBlockConfig: ComponentConfig<CatalogHeroBlockProps> = {
    label: 'Catalogue Hero',
    fields: {
        ...standardBlockFields({ defaultProps }),
        accent: {
            type: 'select',
            label: 'Accent ramp',
            options: [
                { label: 'Orbit (cyan)', value: 'snm' },
                { label: 'Vertex (green)', value: 'tgp' },
            ],
        },
        crumb: { type: 'text', label: 'Breadcrumb' },
        kicker: { type: 'text', label: 'Kicker' },
        title: { type: 'textarea', label: 'Headline' },
        blurb: { type: 'textarea', label: 'Blurb' },
        note: { type: 'textarea', label: 'Note (small print)' },
        noteLinkLabel: { type: 'text', label: 'Note link text (blank = none)' },
        noteLinkHref: { type: 'text', label: 'Note link URL' },
        showPartnerBadge: {
            type: 'radio',
            label: 'Powered-by badge',
            options: [{ label: 'Show', value: 'yes' }, { label: 'Hide', value: 'no' }],
        },
    },
    defaultProps,
    render: CatalogHeroBlockRender,
}

export default CatalogHeroBlockRender
