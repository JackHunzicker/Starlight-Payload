'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40 } from '@/components/brand/layoutShell'

/**
 * Granular platform pane (the ruled section under each 1h/1ha/1hb hero):
 * dotted section head, body paragraph and the three cards — each card's tag,
 * tint, title and body — are editable. Defaults reproduce the About pane.
 */

interface PaneCard {
    tag: string
    tint: string
    title: string
    body: string
}

interface PlatformPaneBlockProps {
    visibility?: any
    dot: string
    title: string
    kicker: string
    body: string
    cards: PaneCard[]
}

function PlatformPaneBlockRender(rawProps: PlatformPaneBlockProps) {
    const { visibility, dot, title, kicker, body, cards } = withDefaults(rawProps, defaultProps)
    return (
        <BlockShell visibility={visibility} prefix="puck-platform-pane" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div
                    style={{
                        padding: `64px ${TLR_CAP_40} 72px`,
                        borderTop: '1px solid var(--rule-soft,#eef2f6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 34,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 650, letterSpacing: '-.018em' }}>{title}</h2>
                        <span style={{ flex: 1, height: 1, background: 'var(--rule-soft,#eef2f6)' }} />
                        <span
                            style={{
                                fontSize: 11.5,
                                letterSpacing: '.14em',
                                textTransform: 'uppercase',
                                color: 'var(--ink-5,#a9b6c2)',
                                fontWeight: 600,
                            }}
                        >
                            {kicker}
                        </span>
                    </div>
                    <p
                        style={{
                            margin: 0,
                            maxWidth: '74ch',
                            fontSize: 16,
                            lineHeight: 1.68,
                            color: 'var(--ink-3,#475569)',
                            textWrap: 'pretty',
                        }}
                    >
                        {body}
                    </p>
                    <div
                        className="max-md:!grid-cols-1"
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}
                    >
                        {cards.map((card, index) => (
                            <div
                                key={`${card.tag}-${index}`}
                                style={{
                                    border: '1px solid var(--card-rule,#e8eef3)',
                                    borderRadius: 14,
                                    background: 'var(--card,#ffffff)',
                                    padding: '22px 22px 24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 9,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 10.5,
                                        fontFamily: "'JetBrains Mono',monospace",
                                        letterSpacing: '.08em',
                                        color: card.tint,
                                    }}
                                >
                                    {card.tag}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>{card.title}</div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: 'var(--ink-2,#64748b)',
                                        lineHeight: 1.6,
                                        textWrap: 'pretty',
                                    }}
                                >
                                    {card.body}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: PlatformPaneBlockProps = {
    visibility: null,
    dot: '#4d84f0',
    title: 'Why the shop exists',
    kicker: 'About',
    body: 'Acme Commerce is the exclusive storefront for two independent technologies and the platform being built around them. Orbit Labs makes water-soluble compound particles; Vertex Supply makes ultrapure research reagents in the USA.',
    cards: [
        { tag: 'SUPPLY', tint: '#74CDE6', title: 'Direct, not distributed', body: 'Both lines ship from their own facilities. No brokers, no relabelled drums, no gap between who made it and who sells it.' },
        { tag: 'EVIDENCE', tint: '#3FD9A8', title: 'A COA per lot, published', body: 'Every lot carries its specification sheet on the product page, not on request, not behind an email form.' },
        { tag: 'PLATFORM', tint: '#9B90EA', title: 'The shop funds the archive', body: 'Revenue underwrites the research repository and the community around it. The commerce is the means, not the point.' },
    ],
}

export const PlatformPaneBlockConfig: ComponentConfig<PlatformPaneBlockProps> = {
    label: 'Platform Pane',
    fields: {
        ...standardBlockFields({ defaultProps }),
        dot: { type: 'text', label: 'Dot colour' },
        title: { type: 'text', label: 'Section title' },
        kicker: { type: 'text', label: 'Kicker (right)' },
        body: { type: 'textarea', label: 'Body paragraph' },
        cards: {
            type: 'array',
            label: 'Cards',
            arrayFields: {
                tag: { type: 'text', label: 'Tag (mono)' },
                tint: { type: 'text', label: 'Tag colour' },
                title: { type: 'text', label: 'Title' },
                body: { type: 'textarea', label: 'Body' },
            },
            defaultItemProps: { tag: 'TAG', tint: '#74CDE6', title: 'Card title', body: 'Card body.' },
            getItemSummary: (item: PaneCard) => item.title || 'Card',
        },
    },
    defaultProps,
    render: PlatformPaneBlockRender,
}

export default PlatformPaneBlockRender
