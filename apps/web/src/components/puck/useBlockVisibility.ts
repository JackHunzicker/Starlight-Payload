'use client'

import React from 'react'
import { visibilityValueToCSS } from '@delmaredigital/payload-puck/fields'

/**
 * Responsive per-breakpoint visibility for locally-owned Puck blocks.
 *
 * Every Delmare layout/content component ships a `visibility` control; the
 * February-era custom blocks did not, so an author could hide a Section on
 * mobile but not a ProductCatalog. This mirrors Delmare's own implementation
 * (scoped class + media-query CSS via the public `visibilityValueToCSS`)
 * instead of forking or overriding any package component.
 *
 * Usage:
 *   const { className, css } = useBlockVisibility(visibility, 'puck-product-catalog')
 *   return (
 *     <>
 *       {css && <style>{css}</style>}
 *       <AnimatedWrapper className={cx('...', className)} …>
 *     </>
 *   )
 *
 * NOTE: Delmare's sibling `_reset` control is deliberately NOT mirrored here —
 * `createResetField` is not exported from the public `/fields` entry, and
 * reaching into `dist/` is prohibited (see the project docs and the Puck Verification
 * Manifest). Revisit if it is ever published.
 */
export function useBlockVisibility(visibility: unknown, prefix: string): { className: string; css: string } {
  const uniqueId = React.useId().replace(/:/g, '')
  const className = `${prefix}-${uniqueId}`
  const css = visibilityValueToCSS(visibility as never, className) || ''
  return { className, css }
}
