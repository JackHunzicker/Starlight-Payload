import React from 'react'
import { render, screen } from '@testing-library/react'
import { baseConfig } from '@delmaredigital/payload-puck/config'
import { describe, expect, it } from 'vitest'

import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'

type GridRenderProps = {
  content: React.ComponentType<{
    className?: string
    style?: React.CSSProperties
  }>
  semanticElement: 'div' | 'ul' | 'ol'
  numColumns: number
  gap: number
  background: null
  customPadding: null
  dimensions: null
  border: null
  margin: null
  animation: null
  visibility: null
}

const GridConfig = baseConfig.components?.Grid
const GridRenderer = GridConfig?.render as unknown as React.ComponentType<GridRenderProps>

const SlotContent = ({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) =>
  React.createElement(
    'div',
    { 'data-testid': 'grid-slot', className, style },
    React.createElement('div', null, 'One'),
    React.createElement('div', null, 'Two'),
    React.createElement('div', null, 'Three'),
    React.createElement('div', null, 'Four'),
  )

describe('Delmare Grid contract', () => {
  it('uses Delmare server-safe defaults for live rendering', () => {
    expect(GridConfig).toBeDefined()
    expect(GridConfig?.defaultProps).toMatchObject({
      semanticElement: 'div',
      numColumns: 3,
      gap: 24,
    })
    expect(GridConfig?.fields).toEqual({
      content: { type: 'slot' },
    })
  })

  it('renders the selected columns, gap, semantic element, and mobile breakpoint', () => {
    const { container } = render(
      React.createElement(GridRenderer, {
        content: SlotContent,
        semanticElement: 'ul',
        numColumns: 4,
        gap: 32,
        background: null,
        customPadding: null,
        dimensions: null,
        border: null,
        margin: null,
        animation: null,
        visibility: null,
      }),
    )

    const slot = screen.getByTestId('grid-slot')
    const scopedClass = slot.className
    const css = Array.from(container.querySelectorAll('style'))
      .map(style => style.textContent)
      .join('\n')

    expect(screen.getByRole('list').tagName).toBe('UL')
    expect(slot.style.display).toBe('grid')
    expect(slot.style.gap).toBe('32px')
    expect(slot.style.getPropertyValue('--grid-cols')).toBe('4')
    expect(css).toContain(`.${scopedClass} { grid-template-columns: 1fr; }`)
    expect(css).toContain('@media (min-width: 768px)')
    expect(css).toContain(
      'grid-template-columns: repeat(var(--grid-cols), 1fr);',
    )
  })

  it('normalizes legacy Grid props to the current Delmare field contract', () => {
    const migrated = migrateLegacyPuckData({
      root: { props: {} },
      content: [
        {
          type: 'Grid',
          props: {
            id: 'legacy-grid',
            columns: 4,
            gap: '32px',
            content: [],
          },
        },
      ],
    } as never)

    expect(migrated.content[0].props.numColumns).toBe(4)
    expect(migrated.content[0].props.gap).toBe(32)
    expect(migrated.content[0].props.columns).toBeUndefined()
  })
})
