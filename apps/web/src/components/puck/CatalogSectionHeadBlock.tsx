'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40, TLR_CAP_48 } from '@/components/brand/layoutShell'
import { CatalogSectionHead } from '@/components/brand/productModule'

/**
 * Granular section head (the dotted row that introduces each catalogue
 * group/row on 1g, 1gc and 5f): dot colour, title, count, optional view-all
 * link, serif voice and band geometry are all editable. Defaults are the
 * TLR home "Particles" row.
 */

interface CatalogSectionHeadBlockProps {
    visibility?: any
    dot: string
    title: string
    count: string
    viewAllLabel?: string
    viewAllUrl?: string
    serif: 'yes' | 'no'
    size?: number
    family: 'inherit' | 'serif'
    gutter: '40' | '48'
    padTop: number
    padBottom: number
}

function CatalogSectionHeadBlockRender(rawProps: CatalogSectionHeadBlockProps) {
    const { visibility, dot, title, count, viewAllLabel, viewAllUrl, serif, size, family, gutter, padTop, padBottom } =
        withDefaults(rawProps, defaultProps)
    const capX = gutter === '48' ? TLR_CAP_48 : TLR_CAP_40
    return (
        <BlockShell visibility={visibility} prefix="puck-catalog-section-head" className="storefront-vars">
            <div
                style={{
                    background: 'var(--bg,#ffffff)',
                    color: 'var(--ink,#0f172a)',
                    ...(family === 'serif' ? { fontFamily: "Spectral,'Iowan Old Style',Georgia,serif" } : {}),
                }}
            >
                <div style={{ padding: `${padTop ?? 56}px ${capX} ${padBottom ?? 12}px` }}>
                    <CatalogSectionHead
                        dot={dot}
                        title={title}
                        count={count}
                        serif={serif === 'yes'}
                        size={size || undefined}
                        viewAll={viewAllLabel && viewAllUrl ? { label: viewAllLabel, url: viewAllUrl } : undefined}
                    />
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: CatalogSectionHeadBlockProps = {
    visibility: null,
    dot: '#2b93b8',
    title: 'Particles',
    count: '8 products',
    viewAllLabel: 'View all',
    viewAllUrl: '/orbit',
    serif: 'no',
    size: 0,
    family: 'inherit',
    gutter: '48',
    padTop: 56,
    padBottom: 12,
}

export const CatalogSectionHeadBlockConfig: ComponentConfig<CatalogSectionHeadBlockProps> = {
    label: 'Catalogue Section Head',
    fields: {
        ...standardBlockFields({ defaultProps }),
        dot: { type: 'text', label: 'Dot colour' },
        title: { type: 'text', label: 'Title' },
        count: { type: 'text', label: 'Count meta' },
        viewAllLabel: { type: 'text', label: 'View-all label (optional)' },
        viewAllUrl: { type: 'text', label: 'View-all URL' },
        serif: {
            type: 'select',
            label: 'Serif heading',
            options: [
                { label: 'Inter (storefront)', value: 'no' },
                { label: 'Spectral (Vertex)', value: 'yes' },
            ],
        },
        size: { type: 'number', label: 'Heading size px (0 = default)', min: 0, max: 40 },
        family: {
            type: 'select',
            label: 'Band font family',
            options: [
                { label: 'Inherit', value: 'inherit' },
                { label: 'Spectral (Vertex page ground)', value: 'serif' },
            ],
        },
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
    },
    defaultProps,
    render: CatalogSectionHeadBlockRender,
}

export default CatalogSectionHeadBlockRender
