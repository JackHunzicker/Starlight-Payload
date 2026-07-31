import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductDetailBlock from '@/components/puck/ProductDetailBlock'

/**
 * An unpriced product must never be purchasable.
 *
 * This is a money-safety rule, not styling. Vendure stores price in minor units,
 * so a variant awaiting a price sits at 0 — and a variant at 0 WITH stock can be
 * ordered for nothing. The entire reagent catalogue is currently unpriced,
 * including the four compounds with real vials on the shelf, so this is live risk
 * rather than a hypothetical.
 *
 * Sold out and unpriced are reported separately because they mean different
 * things: one is "we have none", the other is "we have not priced it".
 */

const variant = (over: Record<string, unknown> = {}) => ({
  id: '1',
  name: 'Reagent Alpha — 40 mg',
  sku: 'DEMO-REAGENT-ALPHA-40MG',
  price: 0,
  currencyCode: 'USD',
  stockLevel: '8',
  ...over,
})

const mockProduct = (variants: Array<Record<string, unknown>>) => ({
  product: {
    id: '1',
    name: 'Reagent Alpha',
    slug: 'reagent-alpha',
    description: 'Dual GIP / GLP-1 receptor agonist.',
    assets: [],
    variants,
  },
})

vi.mock('@/lib/vendureShop', () => ({
  vendureShopRequest: vi.fn(),
}))

import { vendureShopRequest } from '@/lib/vendureShop'

const mocked = vendureShopRequest as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mocked.mockReset()
})

const renderBlock = async (variants: Array<Record<string, unknown>>) => {
  mocked.mockResolvedValue(mockProduct(variants))
  render(<ProductDetailBlock productSlug="reagent-alpha" />)
  // The block fetches on mount; wait for the price/CTA to settle.
  await screen.findByRole('button')
}

describe('unpriced products cannot be bought', () => {
  it('offers "Price on request" instead of a free Add to Cart when price is 0', async () => {
    // In stock AND unpriced — the dangerous combination.
    await renderBlock([variant({ price: 0, stockLevel: '8' })])

    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Price on request')
    // "$0.00" would read as free.
    expect(document.body.textContent).not.toContain('$0.00')
  })

  it('says sold out when there is no stock, regardless of price', async () => {
    await renderBlock([variant({ price: 4900, stockLevel: 'OUT_OF_STOCK' })])

    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Sold out')
  })

  it('prefers "sold out" over "price on request" when both are true', async () => {
    // The unheld reagents: no stock and no price. Stock is the more concrete fact.
    await renderBlock([variant({ price: 0, stockLevel: 'OUT_OF_STOCK' })])

    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Sold out')
  })

  it('allows purchase only when a real price and real stock are both present', async () => {
    await renderBlock([variant({ price: 4900, stockLevel: '8' })])

    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.textContent).toContain('Add to Cart')
    expect(button.textContent).toContain('$49.00')
  })

  it('never dispatches an add-to-cart request for an unpriced variant', async () => {
    await renderBlock([variant({ price: 0, stockLevel: '8' })])
    mocked.mockClear()

    // Click through the disabled attribute the way a script or a stale DOM could.
    screen.getByRole('button').click()

    expect(
      mocked,
      'addToCart must refuse an unpriced variant even if the control is reachable',
    ).not.toHaveBeenCalled()
  })
})
