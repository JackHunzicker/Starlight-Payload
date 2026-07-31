'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { useBrandSettings } from '@/components/brand/catalogKit'
import { SiteHeader, type BrandCode } from '@/components/layout/SiteHeader'

/**
 * The site header as a Puck block, so a page can own (and edit or remove) its
 * chrome instead of inheriting the layout's. Pair with the page settings
 * "Show Header: Hide" so the global chrome doesn't double up. BrandSettings
 * are fetched live so admin nav edits apply here too; until they load (or
 * for a brand with no settings row) navFromSettings falls back to the
 * blueprint DEFAULT_NAV.
 */

interface SiteHeaderBlockProps {
    visibility?: any
    brand: BrandCode
    hasCommerce: 'yes' | 'no'
}

function SiteHeaderBlockRender(rawProps: SiteHeaderBlockProps) {
    const { visibility, brand, hasCommerce } = withDefaults(rawProps, defaultProps)
    const settings = useBrandSettings(brand)
    return (
        <BlockShell visibility={visibility} prefix="puck-site-header">
            <SiteHeader
                settings={settings ?? { siteName: 'Acme Commerce' }}
                brand={brand}
                hasCommerce={hasCommerce === 'yes'}
            />
        </BlockShell>
    )
}

const defaultProps: SiteHeaderBlockProps = {
    visibility: null,
    brand: 'tlr',
    hasCommerce: 'yes',
}

export const SiteHeaderBlockConfig: ComponentConfig<SiteHeaderBlockProps> = {
    label: 'Site Header',
    fields: {
        ...standardBlockFields({ defaultProps }),
        brand: {
            type: 'select',
            label: 'Brand chrome',
            options: [
                { label: 'Acme Commerce', value: 'tlr' },
                { label: 'Orbit Labs', value: 'snm' },
                { label: 'Vertex Supply', value: 'tgp' },
            ],
        },
        hasCommerce: {
            type: 'select',
            label: 'Cart widget',
            options: [
                { label: 'Show cart', value: 'yes' },
                { label: 'No cart', value: 'no' },
            ],
        },
    },
    defaultProps,
    render: SiteHeaderBlockRender,
}

export default SiteHeaderBlockRender
