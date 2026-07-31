'use client'

import React, { useId } from 'react'

/**
 * Brand marks, verbatim from the canonical blueprints
 * ("Acme Commerce Brand + TGP Brand.dc.html", turns 3 and 5c).
 *
 * Every colour is a custom property with the blueprint's light-mode fallback,
 * so the `.storefront-vars` dark scope recolours the marks with no second DOM.
 * The blueprint shares two page-global blur filters (#uvS/#uvT); here each mark
 * instance carries its own defs keyed by useId so the SVGs stay self-contained.
 */

const CROSS_RECTS = (
  <>
    <rect x="89" y="40" width="22" height="108" rx="10" />
    <rect x="61" y="68" width="78" height="22" rx="10" />
  </>
)

export interface TlrMarkProps {
  width: number
  height: number
  /** Rim stroke width — 6 in the 70px header, 7 in the footer (blueprint sizes). */
  strokeWidth?: number
  /** Footer marks widen the base bands slightly so their gaps stay visible. */
  variant?: 'header' | 'footer'
}

/** The Acme Commerce bulb. viewBox 0 0 112 155 — set the height, width follows. */
export function TlrMark({ width, height, strokeWidth = 6, variant = 'header' }: TlrMarkProps) {
  const id = useId()
  const base =
    variant === 'footer' ? (
      <g fill="var(--logo-base,#94a3b8)">
        <rect x="67" y="141" width="66" height="12" rx="3" />
        <rect x="71" y="155" width="58" height="11" rx="3" />
        <rect x="83" y="168" width="34" height="12" rx="4" />
      </g>
    ) : (
      <g fill="var(--logo-base,#94a3b8)">
        <rect x="68" y="141" width="64" height="11" rx="3" />
        <rect x="72" y="153" width="56" height="10" rx="3" />
        <rect x="84" y="164" width="32" height="11" rx="4" />
      </g>
    )
  return (
    <svg viewBox="0 0 112 155" width={width} height={height} aria-hidden="true">
      <defs>
        <filter id={`${id}-s`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`${id}-t`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g transform="translate(-44,-22)">
        <path
          d="M68 141C68 133 66 126 61 118C53 106 46 93 46 78C46 48 70 24 100 24C130 24 154 48 154 78C154 93 147 106 139 118C134 126 132 133 132 141"
          fill="none"
          stroke="var(--logo-rim,#74CDE6)"
          strokeWidth={strokeWidth}
        />
        <g fill="var(--logo-b1,#6B3FD4)" opacity="var(--logo-b1o,.27)" filter={`url(#${id}-s)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-b2,#A46BF0)" opacity="var(--logo-b2o,.31)" filter={`url(#${id}-t)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-cross,#74CDE6)">{CROSS_RECTS}</g>
        {base}
      </g>
    </svg>
  )
}

/** The About-hero bulb: bloom halo + glass fill, 180px art (blueprint 1h). */
export function TlrMarkHero({ size = 180 }: { size?: number }) {
  const id = useId()
  return (
    <svg viewBox="-50 -40 212 212" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#A5E0F2" stopOpacity=".5" />
          <stop offset=".42" stopColor="#74CDE6" stopOpacity=".18" />
          <stop offset="1" stopColor="#4D84F0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3FD9A8" stopOpacity=".75" />
          <stop offset=".5" stopColor="#A5E0F2" stopOpacity=".95" />
          <stop offset="1" stopColor="#9B90EA" stopOpacity=".72" />
        </linearGradient>
        <filter id={`${id}-s`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`${id}-t`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g transform="translate(-44,-22)">
        <circle cx="100" cy="88" r="92" fill={`url(#${id}-halo)`} opacity="var(--logo-bloom,0)" />
        <path
          d="M68 141C68 133 66 126 61 118C53 106 46 93 46 78C46 48 70 24 100 24C130 24 154 48 154 78C154 93 147 106 139 118C134 126 132 133 132 141"
          fill="var(--logo-glass,none)"
          stroke={`url(#${id}-rim)`}
          strokeWidth="3"
        />
        <g fill="var(--logo-b1,#6B3FD4)" opacity="var(--logo-b1o,.27)" filter={`url(#${id}-s)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-b2,#A46BF0)" opacity="var(--logo-b2o,.31)" filter={`url(#${id}-t)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-b1,#6B3FD4)" opacity="var(--logo-b1o,.27)" filter={`url(#${id}-s)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-b2,#A46BF0)" opacity="var(--logo-b2o,.31)" filter={`url(#${id}-t)`}>
          {CROSS_RECTS}
        </g>
        <g fill="var(--logo-cross,#74CDE6)">{CROSS_RECTS}</g>
        <g fill="var(--logo-base,#94a3b8)" opacity=".85">
          <rect x="68" y="141" width="64" height="11" rx="3" />
          <rect x="72" y="153" width="56" height="10" rx="3" />
          <rect x="84" y="164" width="32" height="11" rx="4" />
        </g>
      </g>
    </svg>
  )
}

/** The Vertex shield. viewBox 0 9 84 75.5 — landscape, set the height. */
export function TgpMark({ width, height }: { width: number; height: number }) {
  return (
    <svg viewBox="0 9 84 75.5" width={width} height={height} aria-hidden="true">
      <path
        d="M42 19L74.04 74.5H9.96Z"
        fill="none"
        stroke="var(--tg-strand,#0F8F6B)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path
        d="M42 56L42 19M42 56L74.04 74.5M42 56L9.96 74.5"
        fill="none"
        stroke="var(--tg-letter,#0b1215)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g>
        <circle cx="42" cy="19" r="10" fill="var(--tg-letter,#0b1215)" />
        <circle cx="74.04" cy="74.5" r="10" fill="var(--tg-letter,#0b1215)" />
        <circle cx="9.96" cy="74.5" r="10" fill="var(--tg-letter,#0b1215)" />
      </g>
      <circle cx="42" cy="56" r="7" fill="var(--tg-letter,#0b1215)" />
    </svg>
  )
}

/**
 * The Orbit emblem placed by its VISIBLE circle (rule 9h): the SVG files
 * carry ~17% transparent margin, so a `size` box shows a `size` circle by
 * oversizing the background (×1.4877) and offsetting it (−24.38% of size).
 * Colour swaps with the theme via the `.em-auto` classes in styles.css.
 */
export function SnmEmblem({ size }: { size: number }) {
  const bg = Math.round(size * 1.4877 * 100) / 100
  const off = Math.round(size * 0.2438 * 100) / 100
  return (
    <span
      className="em-auto"
      style={{
        display: 'block',
        width: size,
        height: size,
        backgroundSize: `${bg}px ${bg}px`,
        backgroundPosition: `-${off}px -${off}px`,
        flex: 'none',
      }}
    />
  )
}
