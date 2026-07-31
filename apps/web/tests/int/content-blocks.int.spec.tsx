import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { describe, expect, it } from 'vitest'

/**
 * Delmare typography, media and interactive block contracts.
 *
 * Focus is on behaviour that silently breaks pages or accessibility if wrong:
 * heading levels (document outline), link targets and rel safety, image alt
 * text, and content actually reaching the DOM.
 */

const nulls = {
  visibility: null,
  textColor: null,
  dimensions: null,
  background: null,
  border: null,
  margin: null,
  customPadding: null,
  transform: null,
  animation: null,
  alignment: null,
}

const renderer = (name: string) =>
  baseConfig.components?.[name]?.render as React.ComponentType<Record<string, unknown>>

describe('Heading', () => {
  const Heading = renderer('Heading')

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('renders %s as the matching tag', level => {
    const { container } = render(<Heading {...nulls} text="Outline probe" level={level} />)
    expect(container.querySelector(level), `Heading did not emit <${level}>`).not.toBeNull()
    expect(container.querySelector(level)?.textContent).toContain('Outline probe')
  })

  it('falls back to a heading tag when level is missing', () => {
    const { container } = render(<Heading {...nulls} text="No level" />)
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).not.toBeNull()
  })
})

describe('Text', () => {
  const Text = renderer('Text')

  it('renders its content', () => {
    const { container } = render(<Text {...nulls} content="Body copy probe" size="base" />)
    expect(container.textContent).toContain('Body copy probe')
  })

  it('renders nothing harmful when content is empty', () => {
    const { container } = render(<Text {...nulls} content="" size="base" />)
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('null')
  })
})

describe('Button', () => {
  const Button = renderer('Button')

  it('renders text and href', () => {
    const { container } = render(<Button {...nulls} text="Browse Products" link="/products" variant="default" size="default" />)
    const anchor = container.querySelector('a')
    expect(anchor, 'Button did not emit an anchor for a link').not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/products')
    expect(anchor?.textContent).toContain('Browse Products')
  })

  it('SECURITY: new-tab links carry rel="noopener noreferrer"', () => {
    // NOTE: Button's openInNewTab is a RADIO taking 'yes' | 'no' — not a boolean.
    const { container } = render(
      <Button {...nulls} text="External" link="https://example.com" variant="default" size="default" openInNewTab="yes" />,
    )
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.getAttribute('rel') ?? '', 'target=_blank without rel=noopener is a tabnabbing risk').toContain('noopener')
  })

  it('TRAP: a boolean openInNewTab is silently ignored by Button', () => {
    // Card takes a boolean for the same-named field; Button does not. Anything
    // writing Puck data programmatically (AI bridge, CLI, migrations) must use
    // the per-component shape — puck-data-audit flags the wrong one.
    const { container } = render(
      <Button {...nulls} text="External" link="https://example.com" variant="default" size="default" openInNewTab={true} />,
    )
    expect(container.querySelector('a')?.getAttribute('target')).toBeNull()
  })
})

describe('Card', () => {
  const Card = renderer('Card')

  it('renders heading and text', () => {
    const { container } = render(<Card {...nulls} heading="Card Title" text="Card body" image={null} shadow={null} />)
    expect(container.textContent).toContain('Card Title')
    expect(container.textContent).toContain('Card body')
  })

  it('links the card when a link is set, with rel safety on new-tab links', () => {
    // NOTE: Card's openInNewTab is a BOOLEAN — differs from Button's 'yes'/'no'.
    const { container } = render(
      <Card {...nulls} heading="Linked" text="body" image={null} shadow={null} link="https://example.com" openInNewTab={true} />,
    )
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('https://example.com')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.getAttribute('rel') ?? '').toContain('noopener')
  })
})

describe('Divider', () => {
  const Divider = renderer('Divider')

  it('renders a visible separator element', () => {
    const { container } = render(<Divider {...nulls} style="solid" color={null} />)
    expect(container.firstElementChild, 'Divider rendered nothing').not.toBeNull()
  })
})

describe('Image', () => {
  const Image = renderer('Image')

  it('ACCESSIBILITY: renders the alt text it was given', () => {
    const image = { url: '/media/probe.png', width: 800, height: 600 }
    const { container } = render(<Image {...nulls} image={image} alt="Orbit particle serum bottle" aspectRatio={null} />)
    const img = container.querySelector('img')
    expect(img, 'Image emitted no <img>').not.toBeNull()
    expect(img?.getAttribute('alt')).toBe('Orbit particle serum bottle')
  })

  it('ACCESSIBILITY: still emits an alt attribute when none is provided', () => {
    const image = { url: '/media/probe.png', width: 800, height: 600 }
    // Omitting alt is the point of this test: it verifies the component still
    // emits an alt attribute rather than dropping it. `Image` here is Delmare's
    // Puck block renderer, not an <img>, so the jsx-a11y rule misfires.
    // eslint-disable-next-line jsx-a11y/alt-text
    const { container } = render(<Image {...nulls} image={image} aspectRatio={null} />)
    const img = container.querySelector('img')
    // An empty alt is correct for decorative images; a MISSING alt is not.
    expect(img?.hasAttribute('alt'), 'img rendered without any alt attribute').toBe(true)
  })
})
