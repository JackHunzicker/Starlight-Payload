import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProductCatalogBlock from '@/components/puck/ProductCatalogBlock'

vi.mock('@delmaredigital/payload-puck/fields', () => ({
  createAlignmentField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createResponsiveVisibilityField: vi.fn(() => ({ type: 'custom', render: () => null })),
  visibilityValueToCSS: vi.fn(() => ''),
  responsiveValueToCSS: vi.fn(() => ({ baseStyles: {}, mediaQueryCSS: '' })),
  createAnimationField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createDimensionsField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createMarginField: vi.fn(() => ({ type: 'custom', render: () => null })),
  createPaddingField: vi.fn(() => ({ type: 'custom', render: () => null })),
  dimensionsValueToCSS: vi.fn(() => undefined),
  marginValueToCSS: vi.fn(() => undefined),
  paddingValueToCSS: vi.fn(() => undefined),
}))

vi.mock('@delmaredigital/payload-puck/components', () => ({
  AnimatedWrapper: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/vendureShop', () => ({
  vendureShopRequest: vi.fn().mockResolvedValue({
    search: {
      items: [
        {
          productId: 'product-1',
          productName: 'Alignment Test Product',
          slug: 'alignment-test-product',
          productAsset: null,
          priceWithTax: { value: 1000 },
          currencyCode: 'USD',
        },
      ],
    },
  }),
}))

const baseProps = {
  collectionId: '',
  limit: 3,
  margin: null,
  dimensions: null,
  animation: null,
  customPadding: null,
}

const renderCatalog = (rowAlignment: 'left' | 'center' | 'right') =>
  React.createElement(ProductCatalogBlock, { ...baseProps, rowAlignment })

describe('ProductCatalogBlock', () => {
  it('maps every Delmare alignment value to the product row', async () => {
    const { rerender } = render(renderCatalog('center'))
    const productLink = await screen.findByRole('link', {
      name: /Alignment Test Product/,
    })
    const productRow = productLink.parentElement

    expect(productRow?.classList.contains('justify-center')).toBe(true)

    rerender(renderCatalog('left'))
    expect(productRow?.classList.contains('justify-start')).toBe(true)

    rerender(renderCatalog('right'))
    expect(productRow?.classList.contains('justify-end')).toBe(true)
  })
})
