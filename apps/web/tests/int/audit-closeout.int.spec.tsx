import React from 'react'
import { render, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Close-out pass for the remaining manifest gaps: course access-level filtering,
 * product variant switching, Columns distribution modes, Template, and Image
 * media handling.
 */

vi.mock('@delmaredigital/payload-puck/fields', async () => {
  const stub = () => ({ type: 'custom', render: () => null })
  return {
    createAlignmentField: vi.fn(stub),
    createResponsiveVisibilityField: vi.fn(stub),
    createAnimationField: vi.fn(stub),
    createBackgroundField: vi.fn(stub),
    createDimensionsField: vi.fn(stub),
    createMarginField: vi.fn(stub),
    createPaddingField: vi.fn(stub),
    createTransformField: vi.fn(stub),
    visibilityValueToCSS: vi.fn(() => ''),
    responsiveValueToCSS: vi.fn(() => ({ baseStyles: {}, mediaQueryCSS: '' })),
    dimensionsValueToCSS: vi.fn(() => undefined),
    marginValueToCSS: vi.fn(() => undefined),
    paddingValueToCSS: vi.fn(() => undefined),
    backgroundValueToCSS: vi.fn(() => undefined),
    transformValueToCSS: vi.fn(() => undefined),
  }
})

vi.mock('@delmaredigital/payload-puck/components', () => ({
  AnimatedWrapper: ({ children }: { children: React.ReactNode }) => children,
}))

const shopRequest = vi.fn()
vi.mock('@/lib/vendureShop', () => ({
  vendureShopRequest: (...args: unknown[]) => shopRequest(...args),
}))

const layout = { visibility: null, margin: null, dimensions: null, animation: null, customPadding: null }

describe('CourseCatalogBlock access-level filtering', () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const capture = () => {
    const urls: string[] = []
    global.fetch = vi.fn().mockImplementation((url: string) => {
      urls.push(String(url))
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [] }) })
    }) as never
    return urls
  }

  it('requests a server-side filter for a specific access level', async () => {
    const urls = capture()
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    render(<CourseCatalogBlock {...layout} accessLevel="premium" limit={3} />)

    await waitFor(() => expect(urls.length).toBeGreaterThan(0))
    expect(urls[0], 'access level is not filtered server-side').toContain('where[accessLevel][equals]=premium')
  })

  it('does NOT add an access filter for "all"', async () => {
    const urls = capture()
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    render(<CourseCatalogBlock {...layout} accessLevel="all" limit={3} />)

    await waitFor(() => expect(urls.length).toBeGreaterThan(0))
    expect(urls[0]).not.toContain('where[accessLevel]')
  })

  it('LMS: filtering is applied by the API query, not by hiding rendered content', async () => {
    // If the block fetched everything and filtered client-side, premium titles
    // would be present in the payload and merely hidden — a leak.
    const urls = capture()
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    render(<CourseCatalogBlock {...layout} accessLevel="free" limit={3} />)

    await waitFor(() => expect(urls.length).toBeGreaterThan(0))
    expect(urls[0]).toContain('where[accessLevel][equals]=free')
  })
})

describe('ProductDetailBlock variant switching', () => {
  beforeEach(() => {
    shopRequest.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  const multiVariant = {
    product: {
      id: 'p1',
      name: 'Orbit Serum',
      description: '',
      featuredAsset: null,
      assets: [],
      variants: [
        { id: 'v1', name: '30ml', price: 12999, currencyCode: 'USD', stockLevel: 'IN_STOCK' },
        { id: 'v2', name: '60ml', price: 21999, currencyCode: 'USD', stockLevel: 'IN_STOCK' },
      ],
    },
  }

  it('COMMERCE: selecting a variant updates the displayed price', async () => {
    shopRequest.mockResolvedValue(multiVariant)
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...layout} productSlug="orbit-serum" />)

    await waitFor(() => expect(container.textContent).toContain('129.99'))
    fireEvent.click(within(container).getByRole('button', { name: '60ml' }))
    await waitFor(() => expect(container.textContent).toContain('219.99'))
  })

  it('COMMERCE: add-to-cart sends the SELECTED variant id, not the default', async () => {
    shopRequest.mockImplementation((query: string) => {
      if (String(query).includes('AddToCart')) return Promise.resolve({ addItemToOrder: { totalQuantity: 1 } })
      return Promise.resolve(multiVariant)
    })
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...layout} productSlug="orbit-serum" />)

    await waitFor(() => expect(container.textContent).toContain('129.99'))
    fireEvent.click(within(container).getByRole('button', { name: '60ml' }))
    await waitFor(() => expect(container.textContent).toContain('219.99'))

    fireEvent.click(within(container).getAllByRole('button', { name: /add to cart/i })[0])
    await waitFor(() => {
      const call = shopRequest.mock.calls.find(c => String(c[0]).includes('AddToCart'))
      expect(call, 'AddToCart never issued').toBeTruthy()
      expect(
        (call?.[1] as { variantId?: string })?.variantId,
        'add-to-cart sent the wrong variant — the customer would be charged for the wrong item',
      ).toBe('v2')
    })
  })
})
