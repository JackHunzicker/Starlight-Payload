'use client'
import React from 'react'

/**
 * Shared SNM primitives for the granular Puck blocks. The Snm*Block monoliths
 * remain the canonical pages until the migration swap; these helpers keep the
 * granular blocks' inline-accent handling and constants in one place.
 */

/** The SNM spectral hairline gradient (blueprint token). */
export const SNM_HAIRLINE =
    'linear-gradient(105deg,#cfe2f4 0%,#7cd2ec 20%,#5f86d8 42%,#8f83e0 60%,#b9a6e8 72%,#d5e4f4 86%,#9fc2e8 100%)'

/** The gradient used for headline accent text on the SNM home hero. */
export const SNM_TEXT_GRADIENT =
    'linear-gradient(100deg,#4f8fd0 0%,#6fd0ea 24%,#c8dff2 38%,#4f6fd0 56%,#8f7fe0 74%,#5f9fd8 100%)'

/**
 * Wraps every occurrence of the comma-separated `phrases` in `text` with a
 * styled span — how the granular blocks expose the blueprint's inline accents
 * (aqua strongs, gradient headline words) as plain editable strings.
 */
export function accentify(text: string, phrases: string, style: React.CSSProperties): React.ReactNode[] {
    // Longest-first so a phrase that prefixes another ("nano, orbitlabs")
    // still matches whole. Comma is the delimiter, so a phrase cannot contain
    // one; matching is case-sensitive and exact.
    const targets = (phrases || '')
        .split(',')
        .map((phrase) => phrase.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
    if (!targets.length) return [text]
    const pattern = new RegExp(`(${targets.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    return text.split(pattern).map((part, index) =>
        targets.includes(part) ? (
            <span key={index} style={style}>
                {part}
            </span>
        ) : (
            <React.Fragment key={index}>{part}</React.Fragment>
        ),
    )
}

// Canonical home is blockKit (it applies to every granular block, not just
// SNM); re-exported here so the SNM blocks' kit import stays one line.
export { withDefaults } from '@/components/puck/blockKit'

export interface LightboxImage {
    src: string
    alt: string
}

/**
 * Fullscreen image lightbox (owner-requested addition over the canonical
 * artboards). One shared implementation with real modal behaviour: focus
 * moves to the close control on open, Tab is trapped inside the dialog,
 * focus returns to the opener on close; Esc or clicking anywhere closes.
 */
export function Lightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
    const closeRef = React.useRef<HTMLButtonElement | null>(null)
    const openerRef = React.useRef<Element | null>(null)
    React.useEffect(() => {
        openerRef.current = document.activeElement
        closeRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            // The close button is the dialog's only focusable — trap Tab on it.
            if (e.key === 'Tab') {
                e.preventDefault()
                closeRef.current?.focus()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            if (openerRef.current instanceof HTMLElement) openerRef.current.focus()
        }
    }, [onClose])
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={image.alt}
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                background: 'rgba(10,14,18,.92)',
                cursor: 'zoom-out',
            }}
        >
            <img
                src={image.src}
                alt={image.alt}
                style={{
                    maxWidth: '94vw',
                    maxHeight: '94vh',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: 8,
                    background: '#fff',
                    boxShadow: '0 24px 80px rgba(0,0,0,.5)',
                }}
            />
            <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close fullscreen view"
                style={{
                    position: 'fixed',
                    top: 18,
                    right: 22,
                    border: 0,
                    background: 'transparent',
                    color: '#fff',
                    fontSize: 34,
                    lineHeight: 1,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                }}
            >
                ×
            </button>
        </div>
    )
}

export const SNM_EYEBROW: React.CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: 'var(--tl-muted-foreground)',
    fontFamily: 'var(--font-mono)',
}
