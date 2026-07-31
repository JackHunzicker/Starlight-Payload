import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { describe, expect, it } from 'vitest'

/**
 * Delmare Section contract.
 *
 * Section is the platform's semantic-landmark primitive: unlike Container (see
 * container.int.spec.tsx and the 2026-07-24 incident entry), Section always
 * emits its chosen element, so it is what page structure must rely on.
 */

const SectionRenderer = baseConfig.components?.Section?.render as React.ComponentType<Record<string, unknown>>

const Slot = ({ className, style }: { className?: string; style?: React.CSSProperties }) =>
  React.createElement('div', { 'data-testid': 'slot', className, style }, 'inner')

const baseProps = {
  content: Slot,
  visibility: null,
  sectionBackground: null,
  sectionBorder: null,
  sectionPadding: null,
  sectionMargin: null,
  contentDimensions: null,
  contentBackground: null,
  contentBorder: null,
  contentPadding: null,
  animation: null,
}

// Every element Delmare documents for Section.
const ELEMENTS = ['section', 'article', 'aside', 'nav', 'header', 'footer', 'main', 'div']

describe('Delmare Section contract', () => {
  it.each(ELEMENTS)('renders <%s> when selected, with no styling props', element => {
    const { container } = render(<SectionRenderer {...baseProps} semanticElement={element} />)
    expect(container.querySelector(element), `Section did not emit <${element}>`).not.toBeNull()
  })

  it('defaults to a section element when none is chosen', () => {
    const { container } = render(<SectionRenderer {...baseProps} />)
    expect(container.querySelector('section')).not.toBeNull()
  })

  it('renders the documented two-layer structure: outer element wrapping an inner content layer', () => {
    const { container } = render(<SectionRenderer {...baseProps} semanticElement="section" />)
    const outer = container.querySelector('section')
    expect(outer?.className).toMatch(/puck-section-/)
    const inner = outer?.querySelector('[data-testid="slot"]')
    expect(inner, 'content slot is not nested inside the section element').not.toBeNull()
    expect(inner?.className).toMatch(/puck-section-content-/)
  })

  it('applies Section ID as a real anchor id on the outer element', () => {
    const { container } = render(<SectionRenderer {...baseProps} semanticElement="section" id="research" />)
    const outer = container.querySelector('section')
    expect(outer?.getAttribute('id')).toBe('research')
  })

  it('outer background styles the section element, not the content layer', () => {
    const sectionBackground = { type: 'solid', solid: { hex: '#0d1117', opacity: 100 } }
    const { container } = render(<SectionRenderer {...baseProps} semanticElement="section" sectionBackground={sectionBackground} />)
    const outer = container.querySelector('section') as HTMLElement | null
    expect(outer).not.toBeNull()
    expect(outer?.getAttribute('style') ?? '').toMatch(/background-color/)
  })

  it('content dimensions constrain the inner layer, leaving the outer element full-bleed', () => {
    const contentDimensions = {
      xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 1200, unit: 'px', enabled: true } },
    }
    const { container } = render(<SectionRenderer {...baseProps} semanticElement="section" contentDimensions={contentDimensions} />)
    const css = Array.from(container.querySelectorAll('style'))
      .map(node => node.textContent ?? '')
      .join('\n')
    expect(css).toMatch(/max-width:\s*1200px/)
    // The constraint targets the inner content layer, never the outer landmark.
    expect(css).toMatch(/puck-section-content-/)
  })
})
