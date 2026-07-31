'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createAlignmentField,
    createDimensionsField,
    createMarginField,
    createPaddingField,
    createAnimationField,
} from '@delmaredigital/payload-puck/fields'
import type { Alignment } from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'
import { vendureShopRequest } from '@/lib/vendureShop'

interface ProductCatalogBlockProps {
    visibility?: any
    collectionId?: string
    limit: number
    /**
     * 'available' shows only what can actually be bought, behind a toggle that
     * reveals the rest as sold out. Most of the catalogue exists as a record to
     * price against rather than as stock — 13 reagents are held at zero and the
     * four the owner does hold stay unpriced until he sets numbers — so an unfiltered
     * grid reads as a shop where nothing is buyable.
     *
     * Deliberately keyed on stock rather than a hardcoded featured list: the
     * moment a held line gets a price it becomes in-stock and promotes itself
     * into the default view, with no second edit to remember.
     */
    availability?: 'available' | 'all'
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
    rowAlignment: Alignment | null
}

const rowAlignmentClasses: Record<Alignment, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
}

// Simple GraphQL query for products
const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($input: SearchInput!) {
    search(input: $input) {
      items {
        productId
        productName
        slug
        productAsset {
          preview
        }
        priceWithTax {
          ... on PriceRange {
            min
            max
          }
          ... on SinglePrice {
            value
          }
        }
        currencyCode
        inStock
      }
    }
  }
`

function formatPrice(price: any, currencyCode: string = 'USD') {
    if (!price) return ''
    const money = (minorUnits: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(minorUnits / 100)

    // An unpriced product renders as "$0.00" otherwise, which reads as free. The
    // whole reagent catalogue sits at 0 until the owner sets numbers.
    const maxima = price.value ?? price.max ?? price.min
    if (!(maxima > 0)) return 'Price on request'

    // SinglePrice
    if (price.value != null) return money(price.value)

    // PriceRange. A product sold in eight fill volumes spans $25–$2000; showing
    // only the minimum reads as the price of the product rather than its entry
    // point, which is misleading on a catalogue card.
    if (price.min != null) {
        return price.max != null && price.max !== price.min
            ? `From ${money(price.min)}`
            : money(price.min)
    }
    return ''
}

function ProductCatalogBlockRender({
    visibility,
    collectionId,
    limit,
    margin,
    dimensions,
    customPadding,
    animation,
    rowAlignment,
    availability = 'available',
}: ProductCatalogBlockProps) {
    const [products, setProducts] = React.useState<any[]>([])
    const [showAll, setShowAll] = React.useState(false)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        // See CourseCatalogBlock: prevents settling into an unmounted tree.
        let cancelled = false

        const fetchProducts = async () => {
            try {
                setLoading(true)
                const data = await vendureShopRequest<{ search: { items: any[] } }>(SEARCH_PRODUCTS_QUERY, {
                    input: {
                        take: limit,
                        // Without this, Vendure returns one result per VARIANT. The
                        // Orbit CMP-A line has eight fill volumes, so the catalogue
                        // rendered eight identical cards — and `key={productId}`
                        // collided across all of them. The demo products carried a
                        // single variant each, which is why it surfaced only once the
                        // real catalogue landed.
                        groupByProduct: true,
                        ...(collectionId ? { collectionId } : {}),
                    },
                })
                if (cancelled) return
                setProducts(data?.search?.items || [])
            } catch (err) {
                if (cancelled) return
                console.error('Failed to fetch products:', err)
                setError('Failed to load products.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchProducts()
        return () => {
            cancelled = true
        }
    }, [collectionId, limit])


    // `inStock` is absent on older cached responses; treat unknown as available
    // so a schema hiccup can never blank the catalogue.
    const soldOut = (p: any) => p.inStock === false
    const gateOn = availability !== 'all' && !showAll
    const visible = gateOn ? products.filter((p) => !soldOut(p)) : products
    const hidden = availability === 'all' ? [] : products.filter(soldOut)

    return (
        <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-product-catalog" animation={animation} className="product-catalog-wrapper">
            <div className="product-catalog-container">
                {loading && products.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-muted-foreground">
                        Loading products...
                    </div>
                ) : error && products.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-destructive">
                        {error}
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-muted-foreground">
                        No products found.
                    </div>
                ) : (
                    <>
                    <div
                        className={`flex flex-wrap gap-6 ${rowAlignmentClasses[rowAlignment ?? 'center']}`}
                    >
                        {visible.map((product) => (
                            <a
                                key={product.productId}
                                href={`/products/${product.slug}`}
                                className="group flex w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_3rem)/3)] xl:w-[calc((100%_-_4.5rem)/4)]"
                            >
                                <div className="aspect-square bg-muted relative overflow-hidden">
                                    {product.productAsset?.preview ? (
                                        <img
                                            src={product.productAsset.preview}
                                            alt={product.productName}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                                            No Image
                                        </div>
                                    )}
                                    {product.inStock === false && (
                                        <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium text-muted-foreground">
                                            Sold out
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 flex flex-col flex-grow">
                                    {/*
                                      * line-clamp-3, not 2. Real product names are longer
                                      * than the bring-up demo data was: "Orbit®
                                      * Compound Particles™ — CMP-A 10%" needs three
                                      * lines in a 215px card (the width this grid produces
                                      * inside a 1100px section) and only two at 256px. At
                                      * clamp-2 the part that got cut was "— CMP-A 10%", i.e.
                                      * exactly the compound and strength that
                                      * distinguish one product from the next.
                                      */}
                                    <h3 className="font-semibold text-lg line-clamp-3">
                                        {product.productName}
                                    </h3>
                                    <p className="mt-auto pt-4 text-xl font-bold text-primary">
                                        {formatPrice(product.priceWithTax, product.currencyCode)}
                                    </p>
                                </div>
                            </a>
                        ))}
                    </div>
                    {hidden.length > 0 && (
                        <div className={`mt-8 flex ${rowAlignmentClasses[rowAlignment ?? 'center']}`}>
                            <button
                                type="button"
                                onClick={() => setShowAll(!showAll)}
                                aria-expanded={showAll}
                                className="rounded-full border px-5 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                            >
                                {showAll
                                    ? 'Show available only'
                                    : `Show full catalogue (${hidden.length} more)`}
                            </button>
                        </div>
                    )}
                    </>
                )}
            </div>
        </BlockShell>
    )
}

const defaultProps: ProductCatalogBlockProps = {
    visibility: null,
    collectionId: '',
    limit: 12,
    availability: 'available',
    rowAlignment: 'center',
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const ProductCatalogBlockConfig: ComponentConfig<ProductCatalogBlockProps> = {
    label: 'Product Catalog',
    fields: {
        ...standardBlockFields({ defaultProps }),
        collectionId: { type: 'text', label: 'Vendure Collection ID (Optional)' },
        limit: { type: 'number', label: 'Max Products', min: 1, max: 100 },
        availability: {
            type: 'radio',
            label: 'Show',
            options: [
                { label: 'Available, with a full-catalogue toggle', value: 'available' },
                { label: 'Everything', value: 'all' },
            ],
        },
        rowAlignment: createAlignmentField({
            label: 'Card Row Alignment',
            defaultValue: 'center',
        }),
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: ProductCatalogBlockRender,
}

export default ProductCatalogBlockRender
