import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { describe, expect, it } from 'vitest'

/**
 * Delmare Container contract, including a characterization of an upstream
 * defect found during the 2026-07-24 Container audit.
 *
 * Container's `semanticElement` ("HTML Element" in the editor) is only honoured
 * when the component produces INLINE styles. Internally the renderer computes
 * `hasStyles` from its inline style object and renders
 * `hasStyles ? <Wrapper> : <ContentSlot className=... />` — so with no
 * background/border the chosen element is silently dropped and no wrapper
 * element is emitted at all. Padding/margin/dimensions do NOT count: they are
 * emitted as media-query CSS, not inline styles.
 *
 * These tests document CURRENT behaviour so an upstream fix is detected. Do not
 * "fix" this with a local override or a forked component — report upstream.
 */

const ContainerRenderer = baseConfig.components?.Container?.render as React.ComponentType<Record<string, unknown>>
const SectionRenderer = baseConfig.components?.Section?.render as React.ComponentType<Record<string, unknown>>

const Slot = ({ className, style }: { className?: string; style?: React.CSSProperties }) =>
  React.createElement('div', { 'data-testid': 'slot', className, style }, 'inner')

const containerProps = {
  content: Slot,
  visibility: null,
  dimensions: null,
  background: null,
  border: null,
  padding: null,
  margin: null,
  animation: null,
}

describe('Delmare Container contract', () => {
  it('emits no wrapper element when unstyled — the class lands on the slot child', () => {
    const { container } = render(<ContainerRenderer {...containerProps} />)
    expect(container.querySelector('div[data-testid="slot"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="slot"]')?.className).toMatch(/puck-container-/)
  })

  it('DEFECT: semanticElement is ignored when the Container has no inline styles', () => {
    const { container } = render(<ContainerRenderer {...containerProps} semanticElement="section" />)
    expect(container.querySelector('section'), 'upstream fixed? update this test and the manifest').toBeNull()
  })

  it('DEFECT: responsive padding does not enable the semantic wrapper either', () => {
    const padding = { xs: { top: 8, right: 8, bottom: 8, left: 8, unit: 'px', linked: false } }
    const { container } = render(<ContainerRenderer {...containerProps} semanticElement="section" padding={padding} />)
    expect(container.querySelector('style')?.textContent).toContain('padding: 8px')
    expect(container.querySelector('section')).toBeNull()
  })

  it('semanticElement IS honoured once an inline-style prop (background) is set', () => {
    const background = { type: 'solid', solid: { hex: '#112233', opacity: 100 } }
    const { container } = render(<ContainerRenderer {...containerProps} semanticElement="section" background={background} />)
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section?.className).toMatch(/puck-container-/)
    expect(section?.querySelector('[data-testid="slot"]')).not.toBeNull()
  })

  it('semanticElement IS honoured once a border is set', () => {
    const border = {
      width: 2,
      style: 'solid',
      color: { hex: '#000000', opacity: 100 },
      radius: 4,
      sides: { top: true, right: true, bottom: true, left: true },
    }
    const { container } = render(<ContainerRenderer {...containerProps} semanticElement="article" border={border} />)
    expect(container.querySelector('article')).not.toBeNull()
  })

  it('Section always emits its semantic element, with or without styling', () => {
    const { container } = render(
      <SectionRenderer
        content={Slot}
        semanticElement="section"
        visibility={null}
        sectionBackground={null}
        sectionPadding={null}
        contentDimensions={null}
        contentPadding={null}
        border={null}
        margin={null}
        animation={null}
      />,
    )
    expect(container.querySelector('section')).not.toBeNull()
  })
})
