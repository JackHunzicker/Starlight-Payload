import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * Behavioural regression gate for the 2026-07-24 responsive-styling defect.
 *
 * The structural conformance gate proves a block DECLARES the standard fields.
 * It cannot prove the block USES them correctly — which is exactly how every
 * custom block ended up discarding max-width, padding and margin for months.
 *
 * This suite renders EVERY locally-owned block with a constrained width and a
 * breakpoint visibility rule, and asserts both reach the DOM. A new block that
 * repeats the old mistake fails here, not in production.
 */

// R3F/Remotion need real browser APIs; stub them so the wrapper can be measured.
vi.mock('@react-three/drei', () => ({ useGLTF: vi.fn(), OrbitControls: () => null, Environment: () => null }))
vi.mock('@react-three/fiber', () => ({ Canvas: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/lib/vendureShop', () => ({ vendureShopRequest: vi.fn().mockResolvedValue({ search: { items: [] } }) }))

const LOCAL_BLOCKS: { name: string; module: string; extraProps?: Record<string, unknown> }[] = [
  { name: 'Scene3DBlock', module: '@/components/puck/Scene3DBlock', extraProps: { gltfUrl: '', height: 200, environmentPreset: 'studio' } },
  { name: 'RemotionBlock', module: '@/components/puck/RemotionBlock', extraProps: { compositionName: '', durationInFrames: 60, width: 640, height: 360, fps: 30, showControls: true } },
  { name: 'ExternalFeedBlock', module: '@/components/puck/ExternalFeedBlock', extraProps: { feedType: 'sharkey', apiUrl: 'http://localhost:7777', limit: 3, refreshInterval: 0 } },
  { name: 'ProductCatalogBlock', module: '@/components/puck/ProductCatalogBlock', extraProps: { collectionId: '', limit: 3, rowAlignment: 'center' } },
  { name: 'ProductDetailBlock', module: '@/components/puck/ProductDetailBlock', extraProps: { productSlug: '' } },
  { name: 'CourseCatalogBlock', module: '@/components/puck/CourseCatalogBlock', extraProps: { accessLevel: 'all', limit: 3 } },
  { name: 'CourseDetailBlock', module: '@/components/puck/CourseDetailBlock', extraProps: { courseId: '' } },
]

const CONSTRAINED_DIMENSIONS = {
  xs: { mode: 'contained', alignment: 'center', maxWidth: { value: 321, unit: 'px', enabled: true } },
}

const nullStyling: Record<string, unknown> = {
  margin: null,
  customPadding: null,
  animation: null,
  background: null,
  transform: null,
  border: null,
}

describe('Responsive styling reaches the DOM for every local block', () => {
  it.each(LOCAL_BLOCKS)('$name honours a constrained width', async ({ module, extraProps }) => {
    const { default: Block } = await import(module)
    const { container } = render(
      <Block {...nullStyling} {...extraProps} visibility={null} dimensions={CONSTRAINED_DIMENSIONS} />,
    )
    expect(
      container.innerHTML,
      'constrained width never reached the DOM — the block is probably calling a FLAT converter on a responsive value instead of passing raw values to BlockShell',
    ).toContain('321px')
  })

  it.each(LOCAL_BLOCKS)('$name honours a breakpoint visibility rule', async ({ module, extraProps }) => {
    const { default: Block } = await import(module)
    const { container } = render(
      <Block {...nullStyling} {...extraProps} dimensions={null} visibility={{ xs: false, md: true }} />,
    )
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css, 'no visibility CSS emitted — block is not routing through BlockShell').toMatch(/display:\s*none/)
  })
})

describe('Static guard: blocks must not hand-roll responsive CSS', () => {
  const blockDir = path.join(process.cwd(), 'src', 'components', 'puck')
  const FLAT_CONVERTERS = ['dimensionsValueToCSS', 'marginValueToCSS', 'paddingValueToCSS']

  const blockFiles = fs
    .readdirSync(blockDir)
    .filter(file => file.endsWith('Block.tsx'))

  it('finds the block files it is meant to guard', () => {
    expect(blockFiles.length).toBeGreaterThanOrEqual(LOCAL_BLOCKS.length)
  })

  it.each(blockFiles)('%s does not call the flat CSS converters directly', file => {
    const source = fs.readFileSync(path.join(blockDir, file), 'utf-8')
    for (const converter of FLAT_CONVERTERS) {
      expect(
        source.includes(`${converter}(`),
        `${file} calls ${converter}() directly. Responsive field values ({ xs: … }) must be passed untouched to BlockShell, which applies responsiveValueToCSS.`,
      ).toBe(false)
    }
  })

  it.each(blockFiles)('%s routes its output through BlockShell', file => {
    const source = fs.readFileSync(path.join(blockDir, file), 'utf-8')
    expect(source.includes('BlockShell'), `${file} does not use BlockShell`).toBe(true)
  })
})
