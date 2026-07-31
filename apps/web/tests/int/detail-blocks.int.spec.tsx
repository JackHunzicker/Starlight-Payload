import React from 'react'
import { render, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * ProductDetailBlock and CourseDetailBlock — the two locally-owned blocks that
 * carry real business logic (purchase path, enrolment) and had zero coverage.
 *
 * Focus is on what costs money or blocks a customer: correct price formatting,
 * out-of-stock handling, add-to-cart failure surfacing, and graceful degradation
 * when the upstream API is unavailable.
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

const layout = { visibility: null, margin: null, dimensions: null, animation: null, customPadding: null }

/**
 * Clicking before the variant has been selected is a no-op — the handler early
 * returns on `!selectedVariant`. Wait for the button to become ENABLED rather
 * than merely for the product name to appear, otherwise the test races the
 * component's own state and silently exercises nothing.
 */
async function clickAddToCart(container: HTMLElement) {
  // Scope to THIS render: `screen` searches document.body, which can still hold a
  // previous test's DOM and would click a stale, inert button.
  const button = await waitFor(() => {
    const candidate = within(container).getAllByRole('button', { name: /add to cart/i })[0] as HTMLButtonElement
    expect(candidate.disabled, 'add-to-cart never became enabled').toBe(false)
    return candidate
  })
  fireEvent.click(button)
  // The message state lands a tick after the mutation promise resolves, so wait
  // for the mutation itself before asserting on the rendered message. This also
  // proves the click actually reached the shop API rather than silently no-oping.
  await waitFor(() =>
    expect(
      shopRequest.mock.calls.some(call => String(call[0]).includes('AddToCart')),
      'clicking add-to-cart never issued the AddToCart mutation',
    ).toBe(true),
  )
}

const productResponse = (overrides: Record<string, unknown> = {}) => ({
  product: {
    id: 'p1',
    name: 'Orbit Particle Serum',
    description: '<p>Premium serum.</p>',
    featuredAsset: null,
    assets: [],
    variants: [
      { id: 'v1', name: 'Default', price: 12999, currencyCode: 'USD', stockLevel: 'IN_STOCK', ...overrides },
    ],
  },
})

describe('ProductDetailBlock', () => {
  beforeEach(() => {
    shopRequest.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  const props = { ...layout, productSlug: 'orbit-particle-serum' }

  it('formats price from minor units, never raw or NaN', async () => {
    shopRequest.mockResolvedValue(productResponse())
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...props} />)

    await waitFor(() => expect(within(container).getAllByText('Orbit Particle Serum').length).toBeGreaterThan(0))
    expect(container.textContent).toContain('129.99')
    expect(container.textContent).not.toContain('12999')
    expect(container.textContent).not.toContain('NaN')
  })

  it('COMMERCE: an out-of-stock variant cannot be added to the cart', async () => {
    shopRequest.mockResolvedValue(productResponse({ stockLevel: 'OUT_OF_STOCK' }))
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...props} />)

    await waitFor(() => expect(within(container).getAllByText('Orbit Particle Serum').length).toBeGreaterThan(0))
    const button = within(container).getAllByRole('button', { name: /sold out/i })[0]
    expect((button as HTMLButtonElement).disabled, 'out-of-stock product is still purchasable').toBe(true)
  })

  it('COMMERCE: a rejected add-to-cart surfaces the reason and does not claim success', async () => {
    shopRequest.mockImplementation((query: string) => {
      if (String(query).includes('AddToCart')) {
        return Promise.resolve({ addItemToOrder: { errorCode: 'INSUFFICIENT_STOCK', message: 'Only 2 left' } })
      }
      return Promise.resolve(productResponse())
    })
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...props} />)

    await waitFor(() => expect(within(container).getAllByText('Orbit Particle Serum').length).toBeGreaterThan(0))
    await clickAddToCart(container)

    await waitFor(() => expect(container.textContent).toContain('Only 2 left'))
    expect(container.textContent, 'claimed success despite a rejected mutation').not.toContain('Added to cart')
  })

  it('a successful add-to-cart confirms to the customer', async () => {
    shopRequest.mockImplementation((query: string) => {
      if (String(query).includes('AddToCart')) return Promise.resolve({ addItemToOrder: { totalQuantity: 1 } })
      return Promise.resolve(productResponse())
    })
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...props} />)

    await clickAddToCart(container)
    await waitFor(() => expect(container.textContent).toContain('Added to cart'))
  })

  it('degrades readably when the shop API is unavailable', async () => {
    shopRequest.mockRejectedValue(new Error('ECONNREFUSED vendure'))
    const { default: ProductDetailBlock } = await import('@/components/puck/ProductDetailBlock')
    const { container } = render(<ProductDetailBlock {...props} />)

    await waitFor(() => expect(container.textContent).not.toMatch(/^\s*$/))
    expect(container.textContent).not.toContain('ECONNREFUSED')
    expect(container.innerHTML).not.toContain('undefined')
  })
})

describe('CourseDetailBlock', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const props = { ...layout, courseId: '1' }

  const course = {
    id: 1,
    title: 'Orbit Labs',
    slug: 'orbit-orbitlabs',
    description: 'Foundations.',
    accessLevel: 'premium',
    status: 'published',
    sections: [{ title: 'Module 1', lessons: [{ title: 'Lesson 1' }] }],
  }

  it('renders the course with its modules', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => course }) as never
    const { default: CourseDetailBlock } = await import('@/components/puck/CourseDetailBlock')
    const { container } = render(<CourseDetailBlock {...props} />)

    await waitFor(() => expect(within(container).getAllByText('Orbit Labs').length).toBeGreaterThan(0))
    expect(container.textContent, 'course modules were not rendered').toContain('Module 1')
  })

  it('SECURITY: a failed load shows a generic message, never the raw upstream error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED payload')) as never
    const { default: CourseDetailBlock } = await import('@/components/puck/CourseDetailBlock')
    const { container } = render(<CourseDetailBlock {...props} />)

    await waitFor(() => expect(container.textContent).not.toMatch(/^\s*$/))
    expect(container.textContent).not.toContain('ECONNREFUSED')
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('survives a 404 for a deleted course without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ errors: [] }) }) as never
    const { default: CourseDetailBlock } = await import('@/components/puck/CourseDetailBlock')
    const { container } = render(<CourseDetailBlock {...props} />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('renders nothing harmful when no course is selected', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ docs: [] }) }) as never
    const { default: CourseDetailBlock } = await import('@/components/puck/CourseDetailBlock')
    const { container } = render(<CourseDetailBlock {...layout} courseId="" />)

    await waitFor(() => expect(container.innerHTML).not.toContain('undefined'))
    expect(container.textContent).not.toContain('NaN')
  })
})
