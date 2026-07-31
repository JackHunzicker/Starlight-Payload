'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { HeroHalf } from '@/components/brand/catalogKit'

/**
 * Granular split hero (the 1g TLR home hero): each half's kicker, title,
 * blurb, button and note are editable; the halves keep the canonical washes,
 * accent inks and the centre-seam rule. Defaults reproduce the TLR home hero
 * verbatim.
 */

interface HeroHalfProps {
    kicker: string
    title: string
    blurb: string
    button: string
    buttonHref: string
    note: string
}

interface SplitHeroBlockProps {
    visibility?: any
    left: HeroHalfProps
    right: HeroHalfProps
}

const halfFields = {
    kicker: { type: 'text' as const, label: 'Kicker' },
    title: { type: 'textarea' as const, label: 'Title' },
    blurb: { type: 'textarea' as const, label: 'Blurb' },
    button: { type: 'text' as const, label: 'Button label' },
    buttonHref: { type: 'text' as const, label: 'Button URL' },
    note: { type: 'text' as const, label: 'Note (small print)' },
}

function SplitHeroBlockRender(rawProps: SplitHeroBlockProps) {
    const merged = withDefaults(rawProps, defaultProps)
    const { visibility } = merged
    // withDefaults is shallow — a partially-saved half must still fall back
    // per field, not replace the default object wholesale.
    const left = { ...defaultProps.left, ...(merged.left ?? {}) }
    const right = { ...defaultProps.right, ...(merged.right ?? {}) }
    return (
        <BlockShell visibility={visibility} prefix="puck-split-hero" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div className="max-md:!grid-cols-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <HeroHalf
                        side="left"
                        kicker={left.kicker}
                        kickerColor="var(--snm-ink,#2b93b8)"
                        title={left.title}
                        blurb={left.blurb}
                        button={left.button}
                        buttonBg="var(--snm-btn,#2b93b8)"
                        buttonInk="var(--snm-btn-ink,#ffffff)"
                        buttonHref={left.buttonHref}
                        note={left.note}
                    />
                    <HeroHalf
                        side="right"
                        kicker={right.kicker}
                        kickerColor="var(--tgp-ink,#17a97f)"
                        title={right.title}
                        blurb={right.blurb}
                        button={right.button}
                        buttonBg="var(--tgp-btn,#17a97f)"
                        buttonInk="var(--tgp-btn-ink,#ffffff)"
                        buttonHref={right.buttonHref}
                        note={right.note}
                    />
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: SplitHeroBlockProps = {
    visibility: null,
    left: {
        kicker: 'Orbit Labs',
        title: 'Real orbitlabs research, not marketing hype.',
        blurb: 'Water-soluble particle suspensions at 10% compound concentration, and the products made from them.',
        button: 'Browse Nano',
        buttonHref: '/orbit',
        note: 'Exclusive retail partnership',
    },
    right: {
        kicker: 'Vertex Supply',
        title: 'Research reagents, made and tested in the USA.',
        blurb: '17 compounds across metabolic, hormonal, regenerative, GH-axis and mitochondrial classes. Lot analytics published with every listing.',
        button: 'Browse Reagents',
        buttonHref: '/vertex',
        note: 'Research use only. Not for human consumption.',
    },
}

export const SplitHeroBlockConfig: ComponentConfig<SplitHeroBlockProps> = {
    label: 'Split Hero',
    fields: {
        ...standardBlockFields({ defaultProps }),
        left: { type: 'object', label: 'Left half (Orbit ramp)', objectFields: halfFields },
        right: { type: 'object', label: 'Right half (Vertex ramp)', objectFields: halfFields },
    },
    defaultProps,
    render: SplitHeroBlockRender,
}

export default SplitHeroBlockRender
