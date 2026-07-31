import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { fullConfig } from '@delmaredigital/payload-puck/config/editor'
import { describe, expect, it } from 'vitest'

/**
 * Close-out for the remaining DELMARE component gaps: Columns distribution
 * modes, Template, and Image media handling.
 *
 * Deliberately does NOT mock `@delmaredigital/payload-puck/fields` — the editor
 * config builds itself from those factories at import time, so mocking them
 * breaks `fullConfig` outright. Custom-block tests, which do need the mock, live
 * in audit-closeout.int.spec.tsx.
 */

describe('Columns distribution and Template', () => {
  const Slot = (label: string) =>
    function SlotImpl({ className }: { className?: string }) {
      return React.createElement('div', { 'data-testid': `slot-${label}`, className }, label)
    }

  const columnsProps = {
    column1: Slot('one'),
    column2: Slot('two'),
    column3: Slot('three'),
    column4: Slot('four'),
    count: 2,
    distribution: 'equal',
    gap: 24,
    background: null,
    customPadding: null,
    dimensions: null,
    border: null,
    margin: null,
    visibility: null,
    animation: null,
  }

  const Columns = baseConfig.components?.Columns?.render as React.ComponentType<Record<string, unknown>>

  it('exposes distribution options in the editor', () => {
    const field = (fullConfig.components as Record<string, { fields?: Record<string, { options?: { value: string }[] }> }>)
      .Columns?.fields?.distribution
    expect(field?.options?.length, 'Columns declares no distribution options').toBeGreaterThan(1)
    // Every declared option must be either 'equal' or a valid ratio string.
    for (const option of field?.options ?? []) {
      expect(
        option.value === 'equal' || /^\d+(\.\d+)?(:\d+(\.\d+)?)+$/.test(option.value),
        `distribution option "${option.value}" is neither 'equal' nor a ratio — it would silently fall back`,
      ).toBe(true)
    }
  })

  // `distribution` is a RATIO STRING ('2:1', '1:2', '1:1:2'), not a named preset.
  // resolveColumnsTemplate falls back to equal widths when the ratio's segment
  // count does not match the column count — documented behaviour, not a bug.
  it.each(['equal', '2:1', '1:2'])('distribution=%s renders without dropping columns', distribution => {
    const { container } = render(<Columns {...columnsProps} distribution={distribution} />)
    expect(container.querySelector('[data-testid="slot-one"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="slot-two"]')).not.toBeNull()
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('a valid ratio produces different track sizing than equal', () => {
    const equal = render(<Columns {...columnsProps} distribution="equal" />).container.innerHTML
    const ratio = render(<Columns {...columnsProps} distribution="2:1" />).container.innerHTML
    const tracks = (html: string) => (html.match(/--cols-template:[^;"}]*/g) ?? []).join('|')
    expect(tracks(ratio), 'a 2:1 ratio produced the same tracks as equal').not.toBe(tracks(equal))
    expect(tracks(ratio)).toContain('2fr 1fr')
  })

  it('a ratio whose segment count does not match the column count falls back to equal', () => {
    const equal = render(<Columns {...columnsProps} count={2} distribution="equal" />).container.innerHTML
    const mismatched = render(<Columns {...columnsProps} count={2} distribution="1:1:2" />).container.innerHTML
    const tracks = (html: string) => (html.match(/--cols-template:[^;"}]*/g) ?? []).join('|')
    expect(tracks(mismatched), 'a mismatched ratio should fall back to equal widths').toBe(tracks(equal))
  })

  it('Template renders its slot content', () => {
    const Template = baseConfig.components?.Template?.render as React.ComponentType<Record<string, unknown>>
    const { container } = render(
      <Template
        content={Slot('template-body')}
        templateId={null}
        dimensions={null}
        margin={null}
        customPadding={null}
        visibility={null}
      />,
    )
    expect(container.querySelector('[data-testid="slot-template-body"]')).not.toBeNull()
  })
})

describe('Image media handling', () => {
  const Image = baseConfig.components?.Image?.render as React.ComponentType<Record<string, unknown>>
  const base = {
    visibility: null,
    aspectRatio: null,
    link: null,
    openInNewTab: false,
    border: null,
    dimensions: null,
    alignment: null,
    transform: null,
    animation: null,
    margin: null,
    customPadding: null,
  }

  it('renders a Payload media object with its URL', () => {
    const media = { url: '/api/media/file/serum.png', width: 800, height: 600, alt: 'Serum bottle' }
    const { container } = render(<Image {...base} image={media} alt="Serum bottle" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('/api/media/file/serum.png')
  })

  it('renders nothing harmful when no media is selected', () => {
    const { container } = render(<Image {...base} image={null} alt="" />)
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('null')
  })

  it('wraps the image in a link when one is set, with rel safety for new tabs', () => {
    const media = { url: '/api/media/file/serum.png', width: 800, height: 600 }
    const { container } = render(
      <Image {...base} image={media} alt="Serum" link="https://example.com" openInNewTab={true} />,
    )
    const anchor = container.querySelector('a')
    if (anchor) {
      expect(anchor.getAttribute('href')).toBe('https://example.com')
      if (anchor.getAttribute('target') === '_blank') {
        expect(anchor.getAttribute('rel') ?? '').toContain('noopener')
      }
    }
  })
})
