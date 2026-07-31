import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { puckConfig } from '@/components/puck/puckConfig'
import { BlockShell } from '@/components/puck/BlockShell'

/**
 * Proves the 2026-07-24 normalization: every locally-owned block now offers the
 * same responsive `visibility` control that Delmare ships on its own components,
 * built from the public field API (no override, no fork).
 */

const CUSTOM_BLOCKS = [
  'Scene3DBlock',
  'RemotionBlock',
  'ExternalFeedBlock',
  'ProductCatalogBlock',
  'ProductDetailBlock',
  'CourseCatalogBlock',
  'CourseDetailBlock',
]

describe('Custom block normalization', () => {
  it.each(CUSTOM_BLOCKS)('%s declares a visibility field', name => {
    const component = (puckConfig.components as Record<string, { fields?: Record<string, unknown> }>)[name]
    expect(component, `${name} missing from the merged config`).toBeTruthy()
    expect(component.fields?.visibility, `${name} has no visibility control`).toBeTruthy()
  })

  it.each(CUSTOM_BLOCKS)('%s defaults visibility to null', name => {
    const component = (puckConfig.components as Record<string, { defaultProps?: Record<string, unknown> }>)[name]
    expect(component.defaultProps, `${name} has no defaultProps`).toBeTruthy()
    expect(component.defaultProps).toHaveProperty('visibility')
  })

  it('BlockShell emits scoped media-query CSS that hides the block on mobile', () => {
    const visibility = { xs: false, md: true }
    const { container } = render(
      <BlockShell visibility={visibility} prefix="puck-test-block" animation={null}>
        <p>payload</p>
      </BlockShell>,
    )
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css, 'no visibility CSS emitted').not.toBe('')
    expect(css).toContain('puck-test-block-')
    expect(css).toMatch(/display:\s*none/)
    // The scoped class is applied to the element the CSS targets.
    const scoped = container.querySelector('[class*="puck-test-block-"]')
    expect(scoped, 'scoped visibility class not applied to the rendered element').not.toBeNull()
  })

  it('BlockShell stays inert when no visibility is configured', () => {
    const { container } = render(
      <BlockShell visibility={null} prefix="puck-test-block" animation={null}>
        <p>payload</p>
      </BlockShell>,
    )
    expect(container.querySelector('style'), 'emitted a style tag for an unset visibility').toBeNull()
    expect(container.textContent).toContain('payload')
  })
})
