'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TLR_CAP_40, TLR_CAP_48 } from '@/components/brand/layoutShell'
import { SnmEmblem, TgpMark, TlrMark } from '@/components/brand/marks'
import type { BrandCode } from '@/components/layout/SiteHeader'

export interface SiteFooterProps {
    settings: any
    /** Which brand chrome to render. Defaults to the TLR storefront. */
    brand?: BrandCode
}

const RUO_TLR =
    'Reagent products supplied by Vertex Supply are sold '
const RUO_TGP = 'All products are sold '
const RUO_REST =
    '. They are not drugs, foods, cosmetics or medical devices, are not for human or veterinary consumption, and no statement on this site is intended to diagnose, treat, cure or prevent any disease.'

function FooterColumn({
    heading,
    links,
    mono,
}: {
    heading: string
    links: { label: string; url: string }[]
    mono?: boolean
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: 'var(--ink-3,#475569)' }}>
            <div
                style={
                    mono
                        ? {
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: 10,
                              letterSpacing: '.16em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-5,#a9b6c2)',
                              fontWeight: 400,
                          }
                        : {
                              fontSize: 10.5,
                              letterSpacing: '.14em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-4,#94a3b8)',
                              fontWeight: 600,
                          }
                }
            >
                {heading}
            </div>
            {links.map((link) => (
                <Link key={`${link.label}-${link.url}`} href={link.url} style={{ color: 'var(--ink-3,#475569)' }}>
                    {link.label}
                </Link>
            ))}
        </div>
    )
}

function TlrFooter() {
    const pathname = usePathname() ?? '/'
    const platform = ['/about', '/community', '/learn'].some((p) => pathname.startsWith(p))
    // The shop screens (1g/1ga/1gb/1gc) and the platform screens (1h/1ha/1hb)
    // carry slightly different footer paddings and RUO ink steps — both exact.
    const capX = platform ? TLR_CAP_40 : TLR_CAP_48
    const pad = platform ? `46px ${capX} 40px` : `40px ${capX} 34px`
    const sepMargin = `0 ${capX}`
    const ruoPad = platform ? `16px ${capX} 40px` : `0 ${capX} 36px`
    const ruoColor = platform ? 'var(--ink-5,#a9b6c2)' : 'var(--ink-4,#94a3b8)'
    const ruoStrong = platform ? 'var(--ink-4,#94a3b8)' : 'var(--ink-2,#64748b)'
    return (
        <footer className="storefront-vars" style={{ background: 'var(--bg,#ffffff)', color: 'var(--ink,#0f172a)' }}>
            <div style={{ height: 1, background: 'var(--rule-soft,#eef2f6)', margin: sepMargin }} />
            <div
                className="max-md:!grid-cols-1"
                style={{ padding: pad, display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 44 }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TlrMark width={17} height={24} strokeWidth={7} variant="footer" />
                        <span style={{ fontSize: 14, fontWeight: 650 }}>
                            Acme<span>&#8209;</span>Commerce Research
                        </span>
                    </div>
                </div>
                <FooterColumn
                    heading="Shop"
                    links={[
                        { label: 'Particles', url: '/orbit' },
                        { label: 'Reagents', url: '/vertex' },
                    ]}
                />
                <FooterColumn
                    heading="Platform"
                    links={[
                        { label: 'Community', url: '/community' },
                        { label: 'Learn', url: '/learn' },
                    ]}
                />
                <FooterColumn
                    heading="Company"
                    links={[
                        { label: 'About', url: '/about' },
                        { label: 'Certificates of Analysis', url: '/' },
                    ]}
                />
            </div>
            <div style={{ padding: ruoPad }}>
                <div
                    style={{
                        borderTop: '1px solid var(--rule-soft,#eef2f6)',
                        paddingTop: 18,
                        fontSize: 11,
                        lineHeight: 1.7,
                        color: ruoColor,
                        maxWidth: '96ch',
                        textWrap: 'pretty',
                    }}
                >
                    {RUO_TLR}
                    <strong style={{ color: ruoStrong, fontWeight: 600 }}>for research use only</strong>
                    {RUO_REST}
                </div>
            </div>
        </footer>
    )
}

function SnmFooter({ settings }: { settings: any }) {
    return (
        <div style={{ background: 'var(--tl-background)', color: 'var(--tl-foreground)' }}>
            <div style={{ height: 1, background: 'var(--tl-border)' }} />
            <footer
                className="max-md:!flex-col"
                style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '52px 48px 46px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 64,
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SnmEmblem size={22} />
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-.01em' }}>Orbit</span>
                            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--tl-muted-foreground)' }}>
                                Orbit Labs
                            </span>
                        </div>
                    </div>
                    <p
                        style={{
                            margin: '14px 0 0',
                            maxWidth: 320,
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: 'var(--tl-muted-foreground)',
                        }}
                    >
                        {settings?.footerText || 'Compound particles for formulators. B2B inquiries only.'}
                    </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                    {[
                        { label: 'Technology', url: '/technology' },
                        { label: 'Data', url: '/data' },
                        { label: 'About', url: '/about' },
                        { label: 'Contact', url: '/contact' },
                    ].map((link) => (
                        <Link
                            key={link.url}
                            href={link.url}
                            style={{ fontSize: 14, color: 'var(--tl-foreground)' }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </footer>
            <div className="hairline-snm" style={{ height: 2 }} />
        </div>
    )
}

function TgpFooter() {
    return (
        <footer
            className="storefront-vars"
            style={{
                background: 'var(--bg,#ffffff)',
                color: 'var(--ink,#0f172a)',
                fontFamily: "Spectral,'Iowan Old Style',Georgia,serif",
            }}
        >
            <div style={{ height: 1, background: 'var(--rule-soft,#eef2f6)', margin: `0 ${TLR_CAP_40}` }} />
            <div
                className="max-md:!grid-cols-1"
                style={{ padding: `40px ${TLR_CAP_40} 34px`, display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 44 }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <TgpMark width={25.6} height={23} />
                        <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '.004em' }}>Vertex Supply</span>
                    </div>
                </div>
                <FooterColumn
                    heading="Shop"
                    mono
                    links={[
                        { label: 'All reagents', url: '/' },
                        { label: 'Certificates of Analysis', url: '/' },
                    ]}
                />
                <FooterColumn heading="Company" mono links={[{ label: 'About', url: '/about' }]} />
            </div>
            <div style={{ padding: `16px ${TLR_CAP_40} 40px` }}>
                <div
                    style={{
                        borderTop: '1px solid var(--rule-soft,#eef2f6)',
                        paddingTop: 18,
                        fontSize: 11,
                        lineHeight: 1.7,
                        color: 'var(--ink-4,#94a3b8)',
                        maxWidth: '96ch',
                        textWrap: 'pretty',
                    }}
                >
                    {RUO_TGP}
                    <strong style={{ color: 'var(--ink-2,#64748b)', fontWeight: 600 }}>for research use only</strong>
                    {RUO_REST}
                </div>
            </div>
        </footer>
    )
}

export function SiteFooter({ settings, brand = 'tlr' }: SiteFooterProps) {
    if (brand === 'snm') return <SnmFooter settings={settings} />
    if (brand === 'tgp') return <TgpFooter />
    return <TlrFooter />
}
