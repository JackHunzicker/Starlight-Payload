'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40, TLR_CAP_48 } from '@/components/brand/layoutShell'
import {
    ProductModuleCard,
    SNM_PRODUCTS,
    TGP_CLASS_GROUPS,
    TGP_FEATURED,
    liveFor,
    useLiveCatalog,
    type StorefrontAccent,
} from '@/components/brand/productModule'

/**
 * Granular product-module grid (livetest decomposition of the blueprint card
 * grids): picks a blueprint product set and accent, renders the standard
 * module cards with live Vendure link-through, in the artboard grid with the
 * ultrawide cap and the responsive column escape hatches. Band geometry
 * (gutter, top/bottom padding) is editable because the artboards vary it per
 * band; defaults are the 1ga /orbit values.
 */

/** Editable card copy; `spec` is one line per row in the editor. */
interface CardCopy {
    tag: string
    title: string
    spec: string
    footnote: string
}

interface ProductModuleGridBlockProps {
    visibility?: any
    source:
        | 'snm'
        | 'snm-featured'
        | 'tgp-featured'
        | 'tgp-metabolic'
        | 'tgp-hormonal'
        | 'tgp-regenerative'
        | 'tgp-ghaxis'
        | 'tgp-mitochondrial'
    accent: StorefrontAccent
    columns: number
    gutter?: '40' | '48'
    padTop?: number
    padBottom?: number
    /**
     * Optional per-card copy override. Empty = the blueprint set chosen by
     * `source` (the code arrays). Only PRESENTATION copy lives here — price,
     * stock and link-through stay live from Vendure, matched by card title.
     */
    items?: CardCopy[]
}

const groupByHeading = (heading: string) =>
    TGP_CLASS_GROUPS.find((group) => group.heading === heading)?.items ?? []

const SOURCES = {
    snm: () => SNM_PRODUCTS,
    'snm-featured': () => SNM_PRODUCTS.slice(0, 4),
    'tgp-featured': () => TGP_FEATURED,
    'tgp-metabolic': () => groupByHeading('Metabolic'),
    'tgp-hormonal': () => groupByHeading('Hormonal and signalling'),
    'tgp-regenerative': () => groupByHeading('Regenerative'),
    'tgp-ghaxis': () => groupByHeading('GH axis'),
    'tgp-mitochondrial': () => groupByHeading('Mitochondrial'),
} as const

function ProductModuleGridBlockRender(rawProps: ProductModuleGridBlockProps) {
    const { visibility, source, accent, columns, gutter, padTop, padBottom, items } = withDefaults(rawProps, defaultProps)
    const catalog = useLiveCatalog()
    const overrides = (items ?? [])
        .filter((card) => card.title)
        .map((card) => ({
            tag: card.tag,
            title: card.title,
            spec: (card.spec || '').split('\n').filter(Boolean),
            footnote: card.footnote,
        }))
    const cards = overrides.length ? overrides : (SOURCES[source] ?? SOURCES.snm)()
    const cols = Math.min(Math.max(Math.round(columns) || 4, 2), 6)
    const capX = gutter === '48' ? TLR_CAP_48 : TLR_CAP_40
    return (
        <BlockShell visibility={visibility} prefix="puck-product-module-grid" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div
                    className="max-lg:!grid-cols-2 max-md:!grid-cols-1"
                    style={{
                        padding: `${padTop ?? 26}px ${capX} ${padBottom ?? 48}px`,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols},1fr)`,
                        gap: 18,
                    }}
                >
                    {cards.map((item) => (
                        <ProductModuleCard key={item.title} item={item} accent={accent} live={liveFor(catalog, item)} />
                    ))}
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: ProductModuleGridBlockProps = {
    visibility: null,
    source: 'snm',
    accent: 'snm',
    columns: 4,
    gutter: '40',
    padTop: 26,
    padBottom: 48,
    items: [],
}

export const ProductModuleGridBlockConfig: ComponentConfig<ProductModuleGridBlockProps> = {
    label: 'Product Module Grid',
    fields: {
        ...standardBlockFields({ defaultProps }),
        source: {
            type: 'select',
            label: 'Product set',
            options: [
                { label: 'Orbit products (8)', value: 'snm' },
                { label: 'Orbit featured (4)', value: 'snm-featured' },
                { label: 'Vertex featured (4)', value: 'tgp-featured' },
                { label: 'Vertex — Metabolic', value: 'tgp-metabolic' },
                { label: 'Vertex — Hormonal and signalling', value: 'tgp-hormonal' },
                { label: 'Vertex — Regenerative', value: 'tgp-regenerative' },
                { label: 'Vertex — GH axis', value: 'tgp-ghaxis' },
                { label: 'Vertex — Mitochondrial', value: 'tgp-mitochondrial' },
            ],
        },
        accent: {
            type: 'select',
            label: 'Accent ramp',
            options: [
                { label: 'Orbit (cyan)', value: 'snm' },
                { label: 'Vertex (green)', value: 'tgp' },
            ],
        },
        columns: { type: 'number', label: 'Columns (desktop)', min: 2, max: 6 },
        gutter: {
            type: 'select',
            label: 'Artboard gutter',
            options: [
                { label: '40px (catalogue pages)', value: '40' },
                { label: '48px (shop home)', value: '48' },
            ],
        },
        padTop: { type: 'number', label: 'Band padding top (px)', min: 0, max: 160 },
        padBottom: { type: 'number', label: 'Band padding bottom (px)', min: 0, max: 160 },
        items: {
            type: 'array',
            label: 'Card copy (empty = blueprint set; titles must match Vendure names for live prices)',
            arrayFields: {
                tag: { type: 'text', label: 'Tag (mono uppercase)' },
                title: { type: 'text', label: 'Title' },
                spec: { type: 'textarea', label: 'Spec lines (one per row)' },
                footnote: { type: 'text', label: 'Footnote' },
            },
            defaultItemProps: { tag: 'TAG', title: '', spec: 'Lyophilised vial · ≥99%', footnote: 'Research use only' },
            getItemSummary: (item: CardCopy) => item.title || 'Card',
        },
    },
    defaultProps,
    render: ProductModuleGridBlockRender,
}

export default ProductModuleGridBlockRender
