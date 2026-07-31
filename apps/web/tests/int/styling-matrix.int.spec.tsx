import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { fullConfig } from '@delmaredigital/payload-puck/config/editor'
import { describe, expect, it } from 'vitest'

/**
 * Styling-field matrix.
 *
 * The shared styling fields (background, border, padding, margin, animation,
 * alignment, transform) account for the bulk of the 203-field surface, and they
 * are declared over and over across components. Rather than hand-write a test per
 * component, this discovers which components declare each field FROM THE CONFIG
 * and exercises every one, so new components are covered automatically.
 *
 * Each value uses a distinctive number so a match in the output is unambiguous.
 */

type Renderable = {
  render?: React.ComponentType<Record<string, unknown>>
  fields?: Record<string, { type?: string }>
  defaultProps?: Record<string, unknown>
}

// Field declarations live in the EDITOR config; `baseConfig` exposes only slots.
// Render with the server-safe renderer, which consumes the same props.
const declared = fullConfig.components as unknown as Record<string, Renderable>
const renderers = baseConfig.components as unknown as Record<string, Renderable>

const Slot = ({ className, style }: { className?: string; style?: React.CSSProperties }) =>
  React.createElement('div', { 'data-testid': 'slot', className, style }, 'inner')

/**
 * Baseline props: each component's OWN defaultProps, with slot fields replaced by a
 * measurable stub. Blanket-nulling every field is wrong — `null` defeats destructuring
 * defaults (e.g. `semanticElement = 'div'`), which makes the component render nothing.
 */
function baseProps(name: string): Record<string, unknown> {
  const fields = declared[name]?.fields ?? {}
  const props: Record<string, unknown> = { ...(declared[name]?.defaultProps ?? {}) }
  for (const [key, field] of Object.entries(fields)) {
    if (field?.type === 'slot') props[key] = Slot
  }
  // Minimum content so components render something measurable.
  if ('text' in fields) props.text = 'Matrix probe'
  if ('content' in fields && fields.content?.type !== 'slot') props.content = 'Matrix probe'
  if ('heading' in fields) props.heading = 'Matrix probe'
  if ('items' in fields) props.items = [{ title: 'Q', content: 'A', defaultOpen: true }]
  if ('image' in fields) props.image = { url: '/media/probe.png', width: 100, height: 100 }
  if ('alt' in fields) props.alt = 'probe'
  return props
}

function outputOf(name: string, overrides: Record<string, unknown>): string {
  const Component = renderers[name]?.render
  if (!Component) return ''
  const { container } = render(<Component {...baseProps(name)} {...overrides} />)
  const css = Array.from(container.querySelectorAll('style'))
    .map(node => node.textContent ?? '')
    .join('\n')
  return `${container.innerHTML}\n${css}`
}

/** Components declaring `field`, excluding those whose render we cannot mount. */
function declaring(field: string): string[] {
  return Object.entries(declared)
    .filter(([name, component]) => component.fields && field in component.fields && typeof renderers[name]?.render === 'function')
    .map(([name]) => name)
}

/**
 * Delmare deliberately splits these fields two ways and the declarations are
 * indistinguishable from outside the package:
 *   - LAYOUT components (Container/Flex/Grid/Section/Columns) wrap them in
 *     `createResponsiveField`, so values arrive as `{ xs: {...} }`.
 *   - CONTENT components (Heading/Text/Image/Button/Card/…) declare the bare
 *     factory, so values arrive flat.
 * Each case therefore carries both shapes; a component must honour one of them.
 * A field that honours NEITHER is inert, which is the real defect to catch.
 */
type Case = {
  /** Field names to probe; the first one a component declares is used. */
  fields: string[]
  value: unknown
  flatValue?: unknown
  /** Pattern the rendered output must contain. */
  expected: RegExp
  label: string
}

const CASES: Case[] = [
  {
    label: 'background colour',
    fields: ['background', 'sectionBackground'],
    value: { type: 'solid', solid: { hex: '#123456', opacity: 100 } },
    // React serialises hex to rgb() in inline styles.
    expected: /#123456|rgb\(18,\s*52,\s*86\)/i,
  },
  {
    label: 'border width',
    fields: ['border', 'sectionBorder'],
    value: { width: 7, style: 'solid', color: { hex: '#000000', opacity: 100 }, radius: 3, sides: { top: true, right: true, bottom: true, left: true } },
    expected: /7px/,
  },
  {
    label: 'responsive padding',
    fields: ['customPadding', 'padding', 'contentPadding', 'sectionPadding'],
    value: { xs: { top: 37, right: 37, bottom: 37, left: 37, unit: 'px', linked: true } },
    flatValue: { top: 37, right: 37, bottom: 37, left: 37, unit: 'px', linked: true },
    expected: /37px/,
  },
  {
    label: 'responsive margin',
    fields: ['margin', 'sectionMargin'],
    value: { xs: { top: 41, right: 41, bottom: 41, left: 41, unit: 'px', linked: true } },
    flatValue: { top: 41, right: 41, bottom: 41, left: 41, unit: 'px', linked: true },
    expected: /41px/,
  },
  {
    label: 'responsive dimensions max-width',
    fields: ['dimensions', 'contentDimensions'],
    value: { xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 543, unit: 'px', enabled: true } } },
    flatValue: { mode: 'contained', alignment: 'center', maxWidth: { value: 543, unit: 'px', enabled: true } },
    expected: /543px/,
  },
]

describe('Styling matrix across every component that declares each field', () => {
  for (const testCase of CASES) {
    const names = Array.from(new Set(testCase.fields.flatMap(declaring)))

    it(`${testCase.label}: at least one component declares it`, () => {
      expect(names.length, `no component declares any of ${testCase.fields.join('/')}`).toBeGreaterThan(0)
    })

    it.each(names)(`${testCase.label} reaches the DOM for %s`, name => {
      const field = testCase.fields.find(candidate => declared[name]?.fields && candidate in declared[name].fields!)
      expect(field, `resolved no field for ${name}`).toBeTruthy()

      const responsive = outputOf(name, { [field as string]: testCase.value })
      const flat = testCase.flatValue === undefined ? '' : outputOf(name, { [field as string]: testCase.flatValue })
      const honoured = testCase.expected.test(responsive) || testCase.expected.test(flat)

      expect(
        honoured,
        `${name}.${field} produced no matching CSS for EITHER the responsive or the flat value shape — the field is inert`,
      ).toBe(true)
    })
  }
})

describe('Alignment fields', () => {
  const names = declaring('alignment')

  it('is declared by the expected typography/media components', () => {
    expect(names.length).toBeGreaterThan(0)
  })

  it.each(names)('alignment=right produces a right-aligned result for %s', name => {
    const output = outputOf(name, { alignment: 'right' })
    expect(output, `${name} ignored alignment=right`).toMatch(/text-align:\s*right|text-right|justify-end|flex-end|margin-left:\s*auto/i)
  })
})

describe('Animation fields', () => {
  const names = declaring('animation')

  it('is declared by multiple components', () => {
    expect(names.length).toBeGreaterThan(0)
  })

  // AnimatedWrapper only engages for { mode: 'preset', enacme: <not 'none'> }
  // or { mode: 'custom' }; a preset enacme applies inline transition/opacity/
  // transform styles. NOTE: comparing rendered output with vs without animation
  // is NOT a valid assertion — scoped class ids (useId) change every render, so
  // the strings always differ regardless of the animation.
  it.each(names)('a preset enacme animation is applied for %s', name => {
    const output = outputOf(name, { animation: { mode: 'preset', enacme: 'fade-in', duration: 800, delay: 0 } })
    expect(output, `${name} ignored a preset enacme animation`).toMatch(/opacity|transform|transition/i)
  })

  it.each(names)('enacme "none" adds no animation styling for %s', name => {
    const output = outputOf(name, { animation: { mode: 'preset', enacme: 'none' } })
    expect(output, `${name} emitted a transition for enacme="none"`).not.toMatch(/transition-property/i)
  })
})
