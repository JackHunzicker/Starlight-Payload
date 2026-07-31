'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { useBrandSettings } from '@/components/brand/catalogKit'
import { SiteFooter } from '@/components/layout/SiteFooter'
import type { BrandCode } from '@/components/layout/SiteHeader'

/**
 * The site footer as a Puck block — the counterpart to SiteHeaderBlock for
 * pages that own their chrome. Pair with "Show Footer: Hide" in the page
 * settings so the layout's footer doesn't double up.
 */

interface SiteFooterBlockProps {
    visibility?: any
    brand: BrandCode
}

function SiteFooterBlockRender(rawProps: SiteFooterBlockProps) {
    const { visibility, brand } = withDefaults(rawProps, defaultProps)
    const settings = useBrandSettings(brand)
    return (
        <BlockShell visibility={visibility} prefix="puck-site-footer">
            <SiteFooter settings={settings ?? { siteName: 'Acme Commerce' }} brand={brand} />
        </BlockShell>
    )
}

const defaultProps: SiteFooterBlockProps = {
    visibility: null,
    brand: 'tlr',
}

export const SiteFooterBlockConfig: ComponentConfig<SiteFooterBlockProps> = {
    label: 'Site Footer',
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
    },
    defaultProps,
    render: SiteFooterBlockRender,
}

export default SiteFooterBlockRender
