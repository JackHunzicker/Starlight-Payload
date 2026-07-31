import React from 'react'
import { render } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { buildContract, auditPuckData } from '@/lib/puckAudit'
import { puckConfig } from '@/components/puck/puckConfig'
import { describe, expect, it } from 'vitest'

/**
 * Remaining Delmare primitives: Columns, Spacer, Template, RichText.
 *
 * Columns is structurally unusual — it exposes FOUR separate slot props
 * (column1..column4) rather than one `content` slot. Anything writing Puck data
 * programmatically (AI bridge, CLI, migrations) must target the right slot, so
 * that shape is asserted here and in the schema auditor.
 */

const renderer = (name: string) =>
  baseConfig.components?.[name]?.render as React.ComponentType<Record<string, unknown>>

const Slot = (label: string) =>
  function SlotImpl({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return React.createElement('div', { 'data-testid': `slot-${label}`, className, style }, label)
  }

describe('Columns', () => {
  const Columns = renderer('Columns')
  const props = {
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

  it('renders only as many column slots as `count` requests', () => {
    const { container } = render(<Columns {...props} count={2} />)
    expect(container.querySelector('[data-testid="slot-one"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="slot-two"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="slot-three"]'), 'third column rendered despite count=2').toBeNull()
  })

  it('renders three and four column layouts when requested', () => {
    const three = render(<Columns {...props} count={3} />)
    expect(three.container.querySelector('[data-testid="slot-three"]')).not.toBeNull()
    expect(three.container.querySelector('[data-testid="slot-four"]')).toBeNull()

    const four = render(<Columns {...props} count={4} />)
    expect(four.container.querySelector('[data-testid="slot-four"]')).not.toBeNull()
  })

  it('applies the requested gap', () => {
    const { container } = render(<Columns {...props} gap={40} />)
    const styles = `${container.innerHTML}`
    expect(styles).toMatch(/40px/)
  })

  it('SCHEMA: the auditor knows Columns uses column1..column4 slots, not `content`', () => {
    const contract = buildContract(puckConfig as never)
    const wrong = {
      root: { props: {} },
      content: [
        {
          type: 'Columns',
          props: { id: 'cols', count: 2, content: [{ type: 'Text', props: { id: 't1', content: 'misplaced' } }] },
        },
      ],
    }
    const issues = auditPuckData(wrong as never, 'fixture', contract)
    expect(
      issues.some(i => i.detail.startsWith('Columns.content')),
      'auditor must reject content written to a non-existent Columns.content slot',
    ).toBe(true)

    const right = {
      root: { props: {} },
      content: [
        {
          type: 'Columns',
          props: { id: 'cols', count: 2, column1: [{ type: 'Text', props: { id: 't1', content: 'ok' } }], column2: [] },
        },
      ],
    }
    expect(auditPuckData(right as never, 'fixture', contract)).toEqual([])
  })
})

describe('Spacer', () => {
  const Spacer = renderer('Spacer')

  // Sizes are emitted as Tailwind scale classes (1 unit = 4px), not literal px.
  const spacerMarkup = (size: string, direction: string) => {
    const { container } = render(<Spacer size={size} direction={direction} visibility={null} />)
    const el = container.firstElementChild as HTMLElement | null
    expect(el, 'Spacer rendered nothing').not.toBeNull()
    return `${el?.className ?? ''} ${el?.getAttribute('style') ?? ''}`
  }

  it('renders the requested vertical size (48px -> h-12)', () => {
    const markup = spacerMarkup('48px', 'vertical')
    expect(markup).toMatch(/\bh-12\b/)
    expect(markup).toMatch(/\bw-full\b/)
  })

  it('supports horizontal direction (32px -> w-8)', () => {
    const markup = spacerMarkup('32px', 'horizontal')
    expect(markup).toMatch(/\bw-8\b/)
    expect(markup).toMatch(/\bh-full\b/)
  })

  it('still renders a spacer for a size off the Tailwind scale', () => {
    // 50px is not a scale step; the component must not emit an empty/undefined class.
    const markup = spacerMarkup('50px', 'vertical')
    expect(markup).not.toMatch(/undefined|NaN/)
    expect(markup).toMatch(/puck-spacer-/)
  })
})

describe('Template', () => {
  const Template = renderer('Template')

  it('renders its content slot', () => {
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

describe('RichText', () => {
  const RichText = renderer('RichText')
  const base = { dimensions: null, margin: null, customPadding: null }

  it('renders authored markup as real elements', () => {
    const { container } = render(<RichText {...base} content="<p>Hello <strong>world</strong></p>" />)
    expect(container.querySelector('strong')?.textContent).toBe('world')
  })

  it('SECURITY: characterizes how script markup in stored content is handled', () => {
    const { container } = render(<RichText {...base} content='<p>safe</p><script>window.__puckXss = true</script>' />)
    // Whatever the parser does, an inline script must never execute during render.
    expect((window as unknown as Record<string, unknown>).__puckXss, 'stored RichText content executed script on render').toBeUndefined()
    expect(container.textContent).toContain('safe')
  })

  it('SECURITY: characterizes inline event-handler attributes in stored content', () => {
    const { container } = render(<RichText {...base} content='<img src="x" alt="probe" onerror="window.__puckXssImg = true">' />)
    const img = container.querySelector('img')
    // React/html-react-parser must not carry a live onerror handler through.
    expect(img?.getAttribute('onerror'), 'inline event handler survived into the DOM').toBeNull()
  })
})
