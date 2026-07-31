'use client'
import React from 'react'
import Link from 'next/link'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40 } from '@/components/brand/layoutShell'
import { Chip } from '@/components/brand/catalogKit'

/**
 * Granular catalogue filter bar (livetest decomposition of the 1ga chip row):
 * the chip list, count meta and sort label are editable one by one. Chips are
 * presentational, exactly as on the blueprint screens.
 */

interface FilterChip {
    label: string
    active: 'yes' | 'no'
}

interface CatalogFilterBarBlockProps {
    visibility?: any
    accent: 'snm' | 'tgp'
    chips: FilterChip[]
    meta: string
    sortLabel: string
    /** Optional trailing link after the sort label (1gb: "Featured · full catalogue"). */
    linkLabel?: string
    linkHref?: string
}

const ACTIVE_BG = {
    snm: 'var(--snm-btn,#2b93b8)',
    tgp: 'var(--tgp-btn,#0f8f6b)',
} as const

function CatalogFilterBarBlockRender(rawProps: CatalogFilterBarBlockProps) {
    const { visibility, accent, chips, meta, sortLabel, linkLabel, linkHref } = withDefaults(rawProps, defaultProps)
    const activeBg = ACTIVE_BG[accent] ?? ACTIVE_BG.snm
    return (
        <BlockShell visibility={visibility} prefix="puck-catalog-filterbar" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div
                    className="max-md:!flex-col max-md:!items-start"
                    style={{
                        padding: `24px ${TLR_CAP_40} 22px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 20,
                        borderBottom: '1px solid var(--rule-soft,#eef2f6)',
                    }}
                >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {chips.map((chip, index) => (
                            <Chip key={`${chip.label}-${index}`} label={chip.label} active={chip.active === 'yes'} activeBg={activeBg} />
                        ))}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 18,
                            fontSize: 12.5,
                            color: 'var(--ink-3,#475569)',
                        }}
                    >
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink-4,#94a3b8)' }}>
                            {meta}
                        </span>
                        <span>
                            {sortLabel}
                            {linkLabel && linkHref ? (
                                <>
                                    {' · '}
                                    <Link
                                        href={linkHref}
                                        style={{
                                            color:
                                                accent === 'tgp'
                                                    ? 'var(--tgp-button,#0f8f6b)'
                                                    : 'var(--snm-btn,#2b93b8)',
                                        }}
                                    >
                                        {linkLabel}
                                    </Link>
                                </>
                            ) : null}
                        </span>
                    </div>
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: CatalogFilterBarBlockProps = {
    visibility: null,
    accent: 'snm',
    chips: [
        { label: 'All', active: 'yes' },
        { label: 'Particles', active: 'no' },
        { label: 'Nanogels', active: 'no' },
        { label: 'CMP-A', active: 'no' },
        { label: 'CMP-B', active: 'no' },
        { label: 'CMP-C', active: 'no' },
        { label: 'CMP-D', active: 'no' },
    ],
    meta: '8 products',
    sortLabel: 'Sort: featured',
}

export const CatalogFilterBarBlockConfig: ComponentConfig<CatalogFilterBarBlockProps> = {
    label: 'Catalogue Filter Bar',
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
        chips: {
            type: 'array',
            label: 'Filter chips',
            arrayFields: {
                label: { type: 'text', label: 'Label' },
                active: {
                    type: 'select',
                    label: 'State',
                    options: [
                        { label: 'Active', value: 'yes' },
                        { label: 'Inactive', value: 'no' },
                    ],
                },
            },
            defaultItemProps: { label: 'Chip', active: 'no' },
            getItemSummary: (item: FilterChip) => item.label || 'Chip',
        },
        meta: { type: 'text', label: 'Count meta (mono)' },
        sortLabel: { type: 'text', label: 'Sort label' },
        linkLabel: { type: 'text', label: 'Trailing link label (optional)' },
        linkHref: { type: 'text', label: 'Trailing link URL' },
    },
    defaultProps,
    render: CatalogFilterBarBlockRender,
}

export default CatalogFilterBarBlockRender
