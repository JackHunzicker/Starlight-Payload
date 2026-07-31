'use client'

import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'

/**
 * Real Remotion compositions selectable from the editor.
 *
 * RemotionBlock previously collected a composition name and then always rendered
 * a static placeholder div, so nothing ever animated. These are genuine
 * frame-driven compositions; the block resolves the chosen name against this
 * registry and falls back to a clearly-labelled placeholder for unknown names.
 *
 * Register new compositions here â€” `REMOTION_COMPOSITION_OPTIONS` drives the
 * editor dropdown, so the field and the registry can never drift apart.
 */

export type RemotionCompositionProps = Record<string, unknown>

/** Brand wordmark that fades and rises into place. */
export function TitleReveal() {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const progress = spring({ frame, fps, config: { damping: 200 } })
  const opacity = interpolate(frame, [0, fps * 0.75], [0, 1], { extrapolateRight: 'clamp' })
  const translateY = interpolate(progress, [0, 1], [40, 0])

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #1a2740 100%)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        data-testid="remotion-title"
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          color: '#f8fafc',
          fontSize: width * 0.06,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        Acme Commerce
      </div>
    </AbsoluteFill>
  )
}

/** Pulsing indicator suitable for a loading or "research in progress" motif. */
export function PulseLoop() {
  const frame = useCurrentFrame()
  const { fps, height } = useVideoConfig()

  const cycle = (frame % (fps * 2)) / (fps * 2)
  const scale = 1 + Math.sin(cycle * Math.PI * 2) * 0.15
  const glow = interpolate(Math.sin(cycle * Math.PI * 2), [-1, 1], [0.35, 1])

  return (
    <AbsoluteFill style={{ background: '#0d1117', alignItems: 'center', justifyContent: 'center' }}>
      <div
        data-testid="remotion-pulse"
        style={{
          width: height * 0.35,
          height: height * 0.35,
          borderRadius: '50%',
          transform: `scale(${scale})`,
          background: `radial-gradient(circle, rgba(56,189,248,${glow}) 0%, rgba(56,189,248,0) 70%)`,
        }}
      />
    </AbsoluteFill>
  )
}

export const REMOTION_COMPOSITIONS: Record<string, React.ComponentType<RemotionCompositionProps>> = {
  'title-reveal': TitleReveal,
  'pulse-loop': PulseLoop,
}

export const REMOTION_COMPOSITION_OPTIONS = [
  { label: 'Title Reveal', value: 'title-reveal' },
  { label: 'Pulse Loop', value: 'pulse-loop' },
]

/** Shown when a composition name does not resolve â€” never silently blank. */
export function UnknownComposition({ name }: { name: string }) {
  return (
    <AbsoluteFill
      style={{
        background: '#1f2937',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <span data-testid="remotion-unknown">Unknown composition: {name}</span>
    </AbsoluteFill>
  )
}

export function resolveComposition(name: string): React.ComponentType<RemotionCompositionProps> {
  return REMOTION_COMPOSITIONS[name] ?? (() => <UnknownComposition name={name} />)
}
