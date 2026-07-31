import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { describe, expect, it } from 'vitest'

/**
 * Systematic semantic-element check across every Delmare layout primitive that
 * declares one. Container is deliberately excluded: it is the sole component
 * that gates its wrapper on inline styles and is characterized separately in
 * container.int.spec.tsx (see the 2026-07-24 incident entry). This spec exists
 * so that defect class cannot spread unnoticed to the other primitives.
 */

const Slot = ({ className, style }: { className?: string; style?: React.CSSProperties }) =>
  React.createElement('div', { 'data-testid': 'slot', className, style }, 'inner')

const commonNulls = {
  visibility: null,
  background: null,
  border: null,
  dimensions: null,
  margin: null,
  animation: null,
  customPadding: null,
}

type Case = {
  component: string
  elements: string[]
  props: Record<string, unknown>
}

// Element lists come from each component's own installed field options.
const CASES: Case[] = [
  {
    component: 'Flex',
    elements: ['div', 'nav', 'ul', 'ol', 'aside', 'section'],
    props: { ...commonNulls, content: Slot, direction: 'row', gap: 24, justifyContent: 'flex-start', alignItems: 'stretch', wrap: false },
  },
  {
    component: 'Grid',
    elements: ['div', 'ul', 'ol'],
    props: { ...commonNulls, content: Slot, numColumns: 3, gap: 24 },
  },
]

describe('Layout primitives: semantic element contract', () => {
  for (const { component, elements, props } of CASES) {
    describe(component, () => {
      const Renderer = baseConfig.components?.[component]?.render as React.ComponentType<Record<string, unknown>>

      it('is present in the server-safe config', () => {
        expect(Renderer, `${component} missing from baseConfig`).toBeTypeOf('function')
      })

      it.each(elements)('renders <%s> with no styling props', element => {
        const { container } = render(<Renderer {...props} semanticElement={element} />)
        expect(
          container.querySelector(element),
          `${component} did not emit <${element}> — same defect class as Container, check the renderer`,
        ).not.toBeNull()
      })
    })
  }

  it('Grid drives its columns from the requested count, on the inner content layer', () => {
    const Renderer = baseConfig.components?.Grid?.render as React.ComponentType<Record<string, unknown>>
    const { container } = render(<Renderer {...CASES[1].props} semanticElement="div" numColumns={4} gap={24} />)
    const inner = container.querySelector('[class*="puck-grid-content-"]') as HTMLElement | null
    expect(inner, 'no puck-grid-content layer').not.toBeNull()
    const inline = inner?.getAttribute('style') ?? ''
    expect(inline).toMatch(/display:\s*grid/)
    expect(inline).toMatch(/--grid-cols:\s*4/)
    expect(inline).toMatch(/gap:\s*24px/)
    // The responsive column rules reference the same custom property.
    const css = Array.from(container.querySelectorAll('style'))
      .map(node => node.textContent ?? '')
      .join('\n')
    expect(css).toMatch(/grid-template-columns/)
  })

  it('Flex emits the requested direction and gap on the inner content layer', () => {
    const Renderer = baseConfig.components?.Flex?.render as React.ComponentType<Record<string, unknown>>
    const { container } = render(<Renderer {...CASES[0].props} semanticElement="div" direction="column" gap={32} />)
    const inner = container.querySelector('[class*="puck-flex-content-"]') as HTMLElement | null
    expect(inner, 'no puck-flex-content layer').not.toBeNull()
    // Direction is expressed as a utility class; gap as an inline style.
    expect(inner?.className).toMatch(/\bflex\b/)
    expect(inner?.className).toMatch(/flex-col\b/)
    expect(inner?.getAttribute('style') ?? '').toMatch(/gap:\s*32px/)
  })

  it('every layout primitive nests its slot inside its own outer element', () => {
    for (const { component, props } of CASES) {
      const Renderer = baseConfig.components?.[component]?.render as React.ComponentType<Record<string, unknown>>
      const { container } = render(<Renderer {...props} semanticElement="section" />)
      const outer = container.querySelector('section')
      expect(outer, `${component} emitted no outer element`).not.toBeNull()
      expect(outer?.querySelector('[data-testid="slot"]'), `${component} slot is not nested inside its element`).not.toBeNull()
    }
  })
})
