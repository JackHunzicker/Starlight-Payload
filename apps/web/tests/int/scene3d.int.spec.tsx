import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * Scene3DBlock sizing and placement contract.
 *
 * The 3D canvas needs WebGL, which jsdom has not got, so these tests exercise
 * the placeholder path and the wrapper/styling layer — enough to prove whether a
 * SMALL, discrete 3D object can be placed beside other content rather than the
 * block always occupying the full page width.
 */

vi.mock('@react-three/drei', () => ({ useGLTF: vi.fn(), OrbitControls: () => null, Environment: () => null }))
vi.mock('@react-three/fiber', () => ({ Canvas: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))

const importBlock = async () => (await import('@/components/puck/Scene3DBlock')).default

const baseProps = {
  gltfUrl: '',
  height: 400,
  environmentPreset: 'studio' as const,
  margin: null,
  dimensions: null,
  animation: null,
  customPadding: null,
  visibility: null,
}

describe('Scene3DBlock sizing', () => {
  it('renders a placeholder prompting for a model when no URL is set', async () => {
    const Scene3DBlock = await importBlock()
    const { container } = render(<Scene3DBlock {...baseProps} />)
    expect(container.querySelector('.scene3d-placeholder')).not.toBeNull()
  })

  it('honours the height field on the placeholder', async () => {
    const Scene3DBlock = await importBlock()
    const { container } = render(<Scene3DBlock {...baseProps} height={180} />)
    const placeholder = container.querySelector('.scene3d-placeholder') as HTMLElement | null
    expect(placeholder?.style.height).toBe('180px')
  })

  it('SIZING: a constrained width is applied so the block need not span the page', async () => {
    const Scene3DBlock = await importBlock()
    const dimensions = {
      xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 320, unit: 'px', enabled: true } },
    }
    const { container } = render(<Scene3DBlock {...baseProps} height={220} dimensions={dimensions} />)
    const html = container.innerHTML
    expect(html, 'no width constraint reached the DOM — a small 3D object is not achievable').toMatch(/320px/)
  })

  it('CONSISTENCY: the placeholder path respects visibility like every other path', async () => {
    const Scene3DBlock = await importBlock()
    const { container } = render(<Scene3DBlock {...baseProps} visibility={{ xs: false, md: true }} />)
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css, 'placeholder path ignores the visibility control').toMatch(/display:\s*none/)
  })
})
