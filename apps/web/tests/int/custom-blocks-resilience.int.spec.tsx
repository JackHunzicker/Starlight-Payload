import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Resilience contracts for the locally-owned data blocks.
 *
 * These blocks fetch at runtime (Vendure shop API, Payload courses API, Sharkey
 * timeline). A failing or empty upstream must degrade to a readable state — never
 * a crash, an infinite spinner, or a raw error object rendered to visitors.
 */

vi.mock('@delmaredigital/payload-puck/fields', () => ({
  createAlignmentField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createResponsiveVisibilityField: vi.fn(() => ({ type: 'custom', render: () => null })),
  visibilityValueToCSS: vi.fn(() => ''),
  responsiveValueToCSS: vi.fn(() => ({ baseStyles: {}, mediaQueryCSS: '' })),
  createAnimationField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createBackgroundField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createDimensionsField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createMarginField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createPaddingField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createTransformField: vi.fn(() => ({ type: 'custom', render: () => null })),
  dimensionsValueToCSS: vi.fn(() => undefined),
  marginValueToCSS: vi.fn(() => undefined),
  paddingValueToCSS: vi.fn(() => undefined),
  backgroundValueToCSS: vi.fn(() => undefined),
  transformValueToCSS: vi.fn(() => undefined),
}))

vi.mock('@delmaredigital/payload-puck/components', () => ({
  AnimatedWrapper: ({ children }: { children: React.ReactNode }) => children,
}))

const shopRequest = vi.fn()
vi.mock('@/lib/vendureShop', () => ({
  vendureShopRequest: (...args: unknown[]) => shopRequest(...args),
}))

// Each block declares its own subset of styling props, so props are spelled out
// per block rather than shared — a wide bag would hide real contract drift.
const layout = { visibility: null, margin: null, dimensions: null, animation: null, customPadding: null }

describe('ProductCatalogBlock resilience', () => {
  beforeEach(() => {
    shopRequest.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  const props = { ...layout, collectionId: '', limit: 3, rowAlignment: 'center' as const }

  it('shows a readable message when the shop API fails', async () => {
    shopRequest.mockRejectedValue(new Error('ECONNREFUSED vendure'))
    const { default: ProductCatalogBlock } = await import('@/components/puck/ProductCatalogBlock')
    const { container } = render(<ProductCatalogBlock {...props} />)

    await waitFor(() => {
      expect(container.textContent, 'block never left its loading state after a failed fetch').not.toMatch(/^\s*$/)
    })
    // The raw error/stack must not be shown to visitors.
    expect(container.textContent).not.toContain('ECONNREFUSED')
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('renders an empty state rather than a broken grid when the shop returns nothing', async () => {
    shopRequest.mockResolvedValue({ search: { items: [] } })
    const { default: ProductCatalogBlock } = await import('@/components/puck/ProductCatalogBlock')
    const { container } = render(<ProductCatalogBlock {...props} />)

    await waitFor(() => expect(shopRequest).toHaveBeenCalled())
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('renders products with formatted prices when the shop responds', async () => {
    shopRequest.mockResolvedValue({
      search: {
        items: [
          {
            productId: 'p1',
            productName: 'Orbit Serum',
            slug: 'orbit-serum',
            productAsset: null,
            priceWithTax: { value: 12999 },
            currencyCode: 'USD',
          },
        ],
      },
    })
    const { default: ProductCatalogBlock } = await import('@/components/puck/ProductCatalogBlock')
    const { container } = render(<ProductCatalogBlock {...props} />)

    await waitFor(() => expect(screen.getByText('Orbit Serum')).toBeTruthy())
    // Price is minor units: 12999 -> $129.99, never a raw 12999 or NaN.
    expect(container.textContent).toContain('129.99')
    expect(container.textContent).not.toContain('12999')
    expect(container.textContent).not.toContain('NaN')
  })
})

describe('CourseCatalogBlock resilience', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const props = { ...layout, accessLevel: 'all' as const, limit: 3 }

  it('shows a readable message when the courses API fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED payload')) as never
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    const { container } = render(<CourseCatalogBlock {...props} />)

    await waitFor(() => expect(container.textContent).not.toMatch(/^\s*$/))
    expect(container.textContent).not.toContain('ECONNREFUSED')
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('survives a non-OK response without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'boom' }] }),
    }) as never
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    const { container } = render(<CourseCatalogBlock {...props} />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('renders returned courses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        docs: [
          { id: 1, title: 'Orbit Labs', slug: 'orbit-orbitlabs', accessLevel: 'free', modules: [], status: 'published' },
        ],
      }),
    }) as never
    const { default: CourseCatalogBlock } = await import('@/components/puck/CourseCatalogBlock')
    render(<CourseCatalogBlock {...props} />)

    await waitFor(() => expect(screen.getByText('Orbit Labs')).toBeTruthy())
  })
})

describe('ExternalFeedBlock resilience', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const props = { ...layout, feedType: 'sharkey' as const, apiUrl: 'http://localhost:7777', limit: 5, refreshInterval: 0, background: null, transform: null }

  it('shows a readable message when the feed host is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED sharkey')) as never
    // Normalized 2026-07-24: ExternalFeedBlock now exports a named renderer as
    // its default, matching every other custom block.
    const { default: ExternalFeedBlock } = await import('@/components/puck/ExternalFeedBlock')
    const { container } = render(<ExternalFeedBlock {...props} />)

    await waitFor(() => expect(container.textContent).not.toMatch(/^\s*$/))
    expect(container.textContent).not.toContain('ECONNREFUSED')
  })
})

describe('Sharkey avatar URL resolution', () => {
  it('unwraps a proxy URL to the direct file on the API origin', async () => {
    const { resolveAvatarUrl } = await import('@/components/puck/ExternalFeedBlock')
    const proxied =
      'http://localhost:7777/proxy/avatar.webp?url=http%3A%2F%2Flocalhost%3A7777%2Ffiles%2Fabc.webp&avatar=1'
    expect(resolveAvatarUrl(proxied, 'http://localhost:7777')).toBe('http://localhost:7777/files/abc.webp')
  })

  it('rehosts the unwrapped file onto the configured API origin', async () => {
    const { resolveAvatarUrl } = await import('@/components/puck/ExternalFeedBlock')
    const proxied =
      'http://localhost:7777/proxy/avatar.webp?url=http%3A%2F%2Flocalhost%3A7777%2Ffiles%2Fabc.webp&avatar=1'
    expect(resolveAvatarUrl(proxied, 'https://social.example.com')).toBe('https://social.example.com/files/abc.webp')
  })

  it('passes non-proxy and empty URLs through untouched', async () => {
    const { resolveAvatarUrl } = await import('@/components/puck/ExternalFeedBlock')
    expect(resolveAvatarUrl('https://cdn.example.com/a.png', 'http://localhost:7777')).toBe('https://cdn.example.com/a.png')
    expect(resolveAvatarUrl(null, 'http://localhost:7777')).toBeNull()
  })

  it('falls back to the original URL when the proxy URL is malformed', async () => {
    const { resolveAvatarUrl } = await import('@/components/puck/ExternalFeedBlock')
    expect(resolveAvatarUrl('http://localhost:7777/proxy/avatar.webp', 'http://localhost:7777')).toBe(
      'http://localhost:7777/proxy/avatar.webp',
    )
  })
})
