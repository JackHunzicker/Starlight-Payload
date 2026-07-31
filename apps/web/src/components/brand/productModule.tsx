'use client'
import React from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'

/**
 * The interchangeable storefront product module (blueprint 1g/1ga/1gb/1gc/5f).
 * By ruling, product cards run Inter + JetBrains Mono on BOTH storefronts —
 * they are the deliberate exception inside Vertex's Spectral pages, because
 * both shops render off the same dashboard and the modules must swap cleanly.
 *
 * Content is the blueprint's exact catalogue; Vendure supplies price, slug and
 * photography per product when they exist. The placeholder states are part of
 * the design: "$––" until priced (the never-sell-unpriced guard stays on the
 * product page), the wash + "Product photograph" until photographed.
 */

export type StorefrontAccent = 'snm' | 'tgp'

export interface ProductModuleItem {
    tag: string
    title: string
    /** Spec lines rendered with <br> between them, exactly as the blueprint. */
    spec: string[]
    footnote: string
}

export interface LiveProduct {
    slug: string
    priceFormatted: string | null
    /** In stock AND priced. Anything else must not offer "Add". */
    purchasable: boolean
    imageUrl: string | null
}

const ACCENTS = {
    snm: {
        wash: 'var(--snm-wash,radial-gradient(70% 90% at 50% 40%,#efedfb 0%,#eaf6fb 46%,#ffffff 78%))',
        tag: 'var(--snm-tag,#2b93b8)',
        btn: 'var(--snm-btn,#2b93b8)',
        btnEdge: 'var(--snm-btn-edge,#2b93b8)',
        btnInk: 'var(--snm-btn-ink,#ffffff)',
    },
    tgp: {
        wash: 'var(--tgp-wash,radial-gradient(70% 90% at 50% 40%,#e6fbf1 0%,#e8f4fe 48%,#ffffff 78%))',
        tag: 'var(--tgp-tag,#0f8f6b)',
        btn: 'var(--tgp-btn,#0f8f6b)',
        btnEdge: 'var(--tgp-btn-edge,#0f8f6b)',
        btnInk: 'var(--tgp-btn-ink,#ffffff)',
    },
} as const

const SEARCH_QUERY = /* GraphQL */ `
    query BlueprintCatalog {
        search(input: { take: 100, groupByProduct: true }) {
            items {
                productName
                slug
                priceWithTax {
                    ... on SinglePrice { value }
                    ... on PriceRange { min max }
                }
                currencyCode
                inStock
                productAsset { preview }
            }
        }
    }
`

const normalize = (name: string) =>
    name
        .toLowerCase()
        .replace(/[®™]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

function formatMinor(value: number, currencyCode: string): string | null {
    if (!value) return null
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' }).format(value / 100)
    } catch {
        return `$${(value / 100).toFixed(2)}`
    }
}

/** One shared fetch per page: maps normalized product name → live data. */
export function useLiveCatalog(enabled = true) {
    const [catalog, setCatalog] = React.useState<Record<string, LiveProduct>>({})
    React.useEffect(() => {
        if (!enabled) return
        let cancelled = false
        vendureShopRequest<{
            search: {
                items: {
                    productName: string
                    slug: string
                    priceWithTax: { value?: number; min?: number; max?: number }
                    currencyCode: string
                    inStock: boolean
                    productAsset: { preview: string } | null
                }[]
            }
        }>(SEARCH_QUERY)
            .then((data) => {
                if (cancelled) return
                const next: Record<string, LiveProduct> = {}
                for (const item of data.search.items) {
                    const minor = item.priceWithTax?.value ?? item.priceWithTax?.min ?? 0
                    next[normalize(item.productName)] = {
                        slug: item.slug,
                        priceFormatted: formatMinor(minor, item.currencyCode),
                        // Unpriced counts as unavailable: `formatMinor` returns null
                        // at 0, and a card offering "Add" on a $–– line sends the
                        // customer into an InsufficientStockError.
                        purchasable: item.inStock !== false && minor > 0,
                        imageUrl: item.productAsset?.preview ?? null,
                    }
                }
                setCatalog(next)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [enabled])
    return catalog
}

export function ProductModuleCard({
    item,
    accent,
    live,
}: {
    item: ProductModuleItem
    accent: StorefrontAccent
    live?: LiveProduct
}) {
    const a = ACCENTS[accent]
    const body = (
        <>
            <div
                style={{
                    height: 140,
                    background: a.wash,
                    borderBottom: '1px solid var(--card-rule,#f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}
            >
                {live?.imageUrl ? (
                    <img
                        src={live.imageUrl}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span
                        style={{
                            fontSize: 10.5,
                            letterSpacing: '.12em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-5,#a9b6c2)',
                        }}
                    >
                        Product photograph
                    </span>
                )}
            </div>
            <div style={{ padding: '15px 16px 17px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: a.tag }}>{item.tag}</div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2,#64748b)' }}>
                    {item.spec.map((line, i) => (
                        <React.Fragment key={line}>
                            {i > 0 ? <br /> : null}
                            {line}
                        </React.Fragment>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 4,
                    }}
                >
                    <span
                        style={{
                            fontSize: 16,
                            fontWeight: 650,
                            color: 'var(--ink-4,#94a3b8)',
                            fontFamily: "'JetBrains Mono',monospace",
                        }}
                    >
                        {live?.priceFormatted ?? '$––'}
                    </span>
                    {/*
                      * Only offer "Add" on something that can actually be bought.
                      * Vendure refuses an unpriced or zero-stock line with
                      * InsufficientStockError, so an always-on Add button walks the
                      * customer into an error — and on a $–– card it also implies the
                      * item is free. Thirteen reagents are held at zero and the four
                      * the owner does hold are unpriced, so this is most of the catalogue.
                      */}
                    <span
                        style={
                            live?.purchasable
                                ? {
                                      padding: '8px 14px',
                                      borderRadius: 8,
                                      background: a.btn,
                                      border: `1px solid ${a.btnEdge}`,
                                      color: a.btnInk,
                                      fontSize: 12.5,
                                      fontWeight: 650,
                                  }
                                : {
                                      padding: '8px 14px',
                                      borderRadius: 8,
                                      background: 'transparent',
                                      border: '1px solid var(--card-rule,#e8eef3)',
                                      color: 'var(--ink-4,#94a3b8)',
                                      fontSize: 12.5,
                                      fontWeight: 650,
                                  }
                        }
                    >
                        {live?.purchasable ? 'Add' : 'Sold out'}
                    </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-5,#a9b6c2)' }}>{item.footnote}</div>
            </div>
        </>
    )
    const cardStyle: React.CSSProperties = {
        border: '1px solid var(--card-rule,#e8eef3)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--card,#ffffff)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "Inter,-apple-system,'Segoe UI',sans-serif",
        color: 'var(--ink,#0f172a)',
    }
    return live?.slug ? (
        <a href={`/products/${live.slug}`} style={cardStyle}>
            {body}
        </a>
    ) : (
        <div style={cardStyle}>{body}</div>
    )
}

/** The dot + heading + count + rule row that opens each catalogue section. */
export function CatalogSectionHead({
    dot,
    title,
    count,
    viewAll,
    serif,
    size,
}: {
    dot: string
    title: string
    count: string
    viewAll?: { label: string; url: string }
    serif?: boolean
    /** 20 on the home rows (1g), 19 on the grouped catalogue (1gc). */
    size?: number
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
            <h3
                style={
                    serif
                        ? { margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: 0 }
                        : { margin: 0, fontSize: size ?? 20, fontWeight: 650, letterSpacing: '-.015em' }
                }
            >
                {title}
            </h3>
            <span style={{ fontSize: 12.5, color: 'var(--ink-4,#94a3b8)', fontFamily: "'JetBrains Mono',monospace" }}>
                {count}
            </span>
            <span style={{ flex: 1, height: 1, background: 'var(--rule-soft,#eef2f6)' }} />
            {viewAll ? (
                <a href={viewAll.url} style={{ fontSize: 13, fontWeight: 500, color: 'var(--tlr-link,#8F86E4)' }}>
                    {viewAll.label}
                </a>
            ) : null}
        </div>
    )
}

// ---- The blueprint catalogue, exact ----

export const SNM_PRODUCTS: ProductModuleItem[] = [
    { tag: 'BULK ORBIT LABS API', title: 'Orbit® CMP-A Particles™', spec: ['15 ml · 10–20 nm', '10% CMP-A'], footnote: 'COA published per lot' },
    { tag: 'TRANSDERMAL DELIVERY', title: 'Orbit® CMP-A Nanogel™', spec: ['50 ml topical · transdermal'], footnote: 'COA published per lot' },
    { tag: 'BULK ORBIT LABS API', title: 'Orbit® CMP-B Particles™', spec: ['15 ml · 10–20 nm', '10% CMP-B'], footnote: 'COA published per lot' },
    { tag: 'TRANSDERMAL DELIVERY', title: 'Orbit® CMP-B Nanogel™', spec: ['50 ml topical · transdermal'], footnote: 'COA published per lot' },
    { tag: 'BULK ORBIT LABS API', title: 'Orbit® CMP-C Particles™', spec: ['15 ml · 10–20 nm', '10% CMP-C'], footnote: 'COA published per lot' },
    { tag: 'TRANSDERMAL DELIVERY', title: 'Orbit® CMP-C Nanogel™', spec: ['50 ml topical · transdermal'], footnote: 'COA published per lot' },
    { tag: 'BULK ORBIT LABS API', title: 'Orbit® CMP-D Particles™', spec: ['15 ml · 10–20 nm', '10% CMP-D'], footnote: 'COA published per lot' },
    { tag: 'TRANSDERMAL DELIVERY', title: 'Orbit® CMP-D Nanogel™', spec: ['50 ml topical · transdermal'], footnote: 'COA published per lot' },
]

export interface ReagentClassGroup {
    heading: string
    count: string
    items: ProductModuleItem[]
}

const vial = (dose?: string): string[] => [dose ? `${dose} lyophilised vial · ≥99%` : 'Lyophilised vial · ≥99%']

/** 1gc/5f grouping; "listings" copy normalized to "products" per the owner 2026-07-29 — CJC-1295 is one product carrying both DAC variants. */
export const TGP_CLASS_GROUPS: ReagentClassGroup[] = [
    {
        heading: 'Metabolic',
        count: '3 products',
        items: [
            { tag: 'CLASS-A', title: 'Reagent Alpha', spec: vial('40 mg'), footnote: 'Research use only' },
            { tag: 'CLASS-A', title: 'Reagent Beta', spec: vial('10 mg'), footnote: 'Research use only' },
            { tag: 'CLASS-A', title: 'Reagent Gamma', spec: vial('5 mg'), footnote: 'Research use only' },
        ],
    },
    {
        heading: 'Hormonal and signalling',
        count: '3 products',
        items: [
            { tag: 'HORMONAL', title: 'Reagent Delta', spec: vial('5 mg'), footnote: 'Research use only' },
            { tag: 'HORMONAL', title: 'Kisspeptin', spec: vial(), footnote: 'Research use only' },
            { tag: 'HORMONAL', title: 'AH-38 (Adifyline)', spec: vial(), footnote: 'Research use only' },
        ],
    },
    {
        heading: 'Regenerative',
        count: '4 products',
        items: [
            { tag: 'REGENERATIVE', title: 'BPC-157', spec: vial(), footnote: 'Research use only' },
            { tag: 'REGENERATIVE', title: 'TB-500', spec: vial(), footnote: 'Research use only' },
            { tag: 'REGENERATIVE', title: 'GHK-Cu', spec: vial(), footnote: 'Research use only' },
            { tag: 'REGENERATIVE', title: 'PT-141', spec: vial(), footnote: 'Research use only' },
        ],
    },
    {
        heading: 'GH axis',
        count: '3 products',
        items: [
            { tag: 'GH AXIS', title: 'Ipamorelin', spec: vial(), footnote: 'Research use only' },
            { tag: 'GH AXIS', title: 'CJC-1295', spec: vial(), footnote: 'Research use only' },
            { tag: 'GH AXIS', title: 'Ipamorelin / CJC-1295 Blend', spec: vial(), footnote: 'Research use only' },
        ],
    },
    {
        heading: 'Mitochondrial',
        count: '3 products',
        items: [
            { tag: 'MITOCHONDRIAL', title: 'SS-31', spec: vial(), footnote: 'Research use only' },
            { tag: 'MITOCHONDRIAL', title: 'MOTS-c', spec: vial(), footnote: 'Research use only' },
            { tag: 'MITOCHONDRIAL', title: 'NAD+', spec: vial(), footnote: 'Research use only' },
        ],
    },
]

/** 1g home + 1gb featured four — Reagent Delta carries the CLASS-B tag on these screens. */
export const TGP_FEATURED: ProductModuleItem[] = [
    { tag: 'CLASS-A', title: 'Reagent Alpha', spec: vial('40 mg'), footnote: 'Research use only' },
    { tag: 'CLASS-A', title: 'Reagent Beta', spec: vial('10 mg'), footnote: 'Research use only' },
    { tag: 'CLASS-A', title: 'Reagent Gamma', spec: vial('5 mg'), footnote: 'Research use only' },
    { tag: 'CLASS-B', title: 'Reagent Delta', spec: vial('5 mg'), footnote: 'Research use only' },
]

/**
 * Blueprint card title → live Vendure product name, where they differ.
 * (CJC-1295 needs no alias since 2026-07-29: it is one Vendure product named
 * "CJC-1295" carrying both DAC preparations as variants.) The full nano and
 * gel families are mapped so a product lights up on its card the moment the owner
 * enables it in Vendure — the CMP-A gel card silently showed "$––" after the
 * 2026-07-29 pricing launch because only the CMP-A nano alias existed.
 */
const LIVE_NAME_ALIASES: Record<string, string> = {
    [normalize('Orbit® CMP-A Particles™')]: normalize('Orbit® CMP-A Particles 10%'),
    [normalize('Orbit® CMP-B Particles™')]: normalize('Orbit® CMP-B Particles 10%'),
    [normalize('Orbit® CMP-C Particles™')]: normalize('Orbit® CMP-C Particles 10%'),
    [normalize('Orbit® CMP-D Particles™')]: normalize('Orbit® CMP-D Particles 10%'),
    [normalize('Orbit® CMP-A Nanogel™')]: normalize('Nanocrystal Gel 1% CMP-A'),
    [normalize('Orbit® CMP-B Nanogel™')]: normalize('Nanocrystal Gel 1% CMP-B'),
    [normalize('Orbit® CMP-C Nanogel™')]: normalize('Nanocrystal Gel 1% CMP-C'),
    [normalize('Orbit® CMP-D Nanogel™')]: normalize('Nanocrystal Gel 1% CMP-D'),
}

export function liveFor(catalog: Record<string, LiveProduct>, item: ProductModuleItem): LiveProduct | undefined {
    const key = normalize(item.title)
    return catalog[LIVE_NAME_ALIASES[key] ?? key]
}
