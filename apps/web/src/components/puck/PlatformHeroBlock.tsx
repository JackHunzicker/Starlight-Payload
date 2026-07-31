'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { BlockShell } from './BlockShell'
import { standardBlockFields, withDefaults } from './blockKit'
import { TLR_CAP_40 } from '@/components/brand/layoutShell'
import { TlrMarkHero } from '@/components/brand/marks'
import { resolveDestination } from '@/lib/externalDestinations'

/**
 * Granular platform hero (1h About / 1ha Community / 1hb Learn): headline,
 * blurb and both CTAs are editable; the About style adds the bulb mark, the
 * radial hero wash and the halo. Defaults reproduce the About hero.
 */

interface PlatformHeroBlockProps {
    visibility?: any
    style: 'about' | 'plain'
    heroTitle: string
    heroBlurb: string
    ctaLabel: string
    ctaHref: string
    secLabel?: string
    secHref?: string
}

function PlatformHeroBlockRender(rawProps: PlatformHeroBlockProps) {
    const {
        visibility,
        style,
        heroTitle,
        heroBlurb,
        ctaLabel,
        ctaHref: rawCtaHref,
        secLabel,
        secHref: rawSecHref,
    } = withDefaults(rawProps, defaultProps)
    // `{community}` resolves to this environment's community instance —
    // see src/lib/externalDestinations.ts. A stored `/community` would
    // self-link back to this very page.
    const ctaHref = resolveDestination(rawCtaHref)
    const secHref = resolveDestination(rawSecHref)
    const isAbout = style === 'about'
    return (
        <BlockShell visibility={visibility} prefix="puck-platform-hero" className="storefront-vars">
            <div style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
                <div
                    style={{
                        position: 'relative',
                        padding: isAbout ? `104px ${TLR_CAP_40} 92px` : `64px ${TLR_CAP_40} 52px`,
                        textAlign: 'center',
                        background: isAbout
                            ? 'var(--hero,radial-gradient(90% 130% at 50% 8%,#eaf2fb 0%,#f4f8fd 34%,#ffffff 74%))'
                            : 'transparent',
                        overflow: 'hidden',
                    }}
                >
                    {isAbout ? (
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 26,
                                width: 420,
                                height: 420,
                                marginLeft: -210,
                                borderRadius: '50%',
                                background: 'var(--hero-halo,none)',
                            }}
                        />
                    ) : null}
                    <div
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 26,
                        }}
                    >
                        {isAbout ? <TlrMarkHero size={180} /> : null}
                        <h1
                            style={{
                                margin: 0,
                                fontSize: isAbout ? 46 : 38,
                                lineHeight: 1.1,
                                fontWeight: 600,
                                letterSpacing: '-.024em',
                                maxWidth: '19ch',
                                textWrap: 'balance',
                            }}
                        >
                            {heroTitle}
                        </h1>
                        <p
                            style={{
                                margin: 0,
                                maxWidth: 620,
                                fontSize: 17.5,
                                lineHeight: 1.62,
                                color: 'var(--ink-3,#475569)',
                                textWrap: 'pretty',
                            }}
                        >
                            {heroBlurb}
                        </p>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            <a
                                href={ctaHref}
                                style={{
                                    padding: '10px 21px',
                                    borderRadius: 9,
                                    background:
                                        'linear-gradient(104deg,#9a8bec 0%,#7fb4ee 38%,#63cbe8 62%,#5fdcb4 100%)',
                                    border: '1px solid #b3a6f2',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5),0 0 16px rgba(126,110,228,.3)',
                                    color: '#0d1230',
                                    fontSize: 12.5,
                                    fontWeight: 650,
                                }}
                            >
                                {ctaLabel}
                            </a>
                            {secLabel && secHref ? (
                                <a
                                    href={secHref}
                                    style={{
                                        display: 'inline-flex',
                                        padding: '10px 18px',
                                        borderRadius: 9,
                                        border: '1px solid var(--rule,#e2e8f0)',
                                        color: 'var(--ink-3,#475569)',
                                        fontSize: 12.5,
                                        fontWeight: 500,
                                    }}
                                >
                                    {secLabel}
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: PlatformHeroBlockProps = {
    visibility: null,
    style: 'about',
    heroTitle: 'Two powerful product lines. One place to get them.',
    heroBlurb:
        'We are the exclusive retail partner for Orbit Labs and Vertex Supply, providing consumers direct access to the cutting edge.',
    ctaLabel: 'Shop all products',
    ctaHref: '/',
    secLabel: 'Join the community →',
    secHref: '/community',
}

export const PlatformHeroBlockConfig: ComponentConfig<PlatformHeroBlockProps> = {
    label: 'Platform Hero',
    fields: {
        ...standardBlockFields({ defaultProps }),
        style: {
            type: 'select',
            label: 'Hero style',
            options: [
                { label: 'About (mark + wash + halo)', value: 'about' },
                { label: 'Plain centred', value: 'plain' },
            ],
        },
        heroTitle: { type: 'textarea', label: 'Headline' },
        heroBlurb: { type: 'textarea', label: 'Blurb' },
        ctaLabel: { type: 'text', label: 'Primary CTA label' },
        ctaHref: { type: 'text', label: 'Primary CTA URL — {community} links to the community instance' },
        secLabel: { type: 'text', label: 'Secondary CTA label (optional)' },
        secHref: { type: 'text', label: 'Secondary CTA URL — {community} links to the community instance' },
    },
    defaultProps,
    render: PlatformHeroBlockRender,
}

export default PlatformHeroBlockRender
