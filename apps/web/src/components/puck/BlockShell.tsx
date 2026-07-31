'use client'

import React from 'react'
import { AnimatedWrapper } from '@delmaredigital/payload-puck/components'
import {
  responsiveValueToCSS,
  dimensionsValueToCSS,
  marginValueToCSS,
  paddingValueToCSS,
  visibilityValueToCSS,
} from '@delmaredigital/payload-puck/fields'

type BlockShellProps = {
  /** Stable scoped-class prefix, e.g. `puck-product-catalog`. */
  prefix: string
  /** Raw field values — pass them through untouched; the shell converts them. */
  visibility?: unknown
  dimensions?: unknown
  margin?: unknown
  padding?: unknown
  animation?: unknown
  className?: string
  /** Extra inline styles owned by the block itself (e.g. transform, background). */
  style?: React.CSSProperties
  children: React.ReactNode
}

/**
 * Standard outer shell for locally-owned Puck blocks.
 *
 * Owns the responsive styling contract so each block does not have to repeat it:
 *
 *  - `dimensions`, `margin` and `padding` are RESPONSIVE values (`{ xs: {...} }`)
 *    produced by Delmare's field factories. They must go through
 *    `responsiveValueToCSS(value, converter, scopedClass)`, which returns base
 *    styles for inline use plus media-query CSS for the breakpoints. The
 *    February-era blocks called the FLAT converters directly, so every
 *    breakpoint-specific value — including a max-width — was silently dropped
 *    and blocks always rendered full width.
 *  - `visibility` becomes scoped media queries via `visibilityValueToCSS`.
 *
 * All of this uses the package's public API; nothing here overrides or forks a
 * Delmare component.
 */
export function BlockShell({
  prefix,
  visibility,
  dimensions,
  margin,
  padding,
  animation,
  className,
  style,
  children,
}: BlockShellProps) {
  const uniqueId = React.useId().replace(/:/g, '')
  const scopedClass = `${prefix}-${uniqueId}`

  const wrapperStyles: React.CSSProperties = { ...style }
  const mediaQueries: string[] = []

  const collect = (result: { baseStyles?: unknown; mediaQueryCSS?: string }) => {
    if (result.baseStyles) Object.assign(wrapperStyles, result.baseStyles as React.CSSProperties)
    if (result.mediaQueryCSS) mediaQueries.push(result.mediaQueryCSS)
  }

  collect(responsiveValueToCSS(dimensions as never, dimensionsValueToCSS as never, scopedClass))
  collect(
    responsiveValueToCSS(margin as never, (value: never) => ({ margin: marginValueToCSS(value) }) as never, scopedClass),
  )
  collect(
    responsiveValueToCSS(padding as never, (value: never) => ({ padding: paddingValueToCSS(value) }) as never, scopedClass),
  )

  const visibilityCSS = visibilityValueToCSS(visibility as never, scopedClass)
  if (visibilityCSS) mediaQueries.push(visibilityCSS)

  const css = mediaQueries.filter(Boolean).join('\n')
  const merged = [className, scopedClass].filter(Boolean).join(' ')

  return (
    <>
      {css ? <style>{css}</style> : null}
      <AnimatedWrapper animation={animation as never} className={merged} style={wrapperStyles}>
        {children}
      </AnimatedWrapper>
    </>
  )
}
