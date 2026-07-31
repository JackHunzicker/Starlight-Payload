'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createDimensionsField,
    createMarginField,
    createPaddingField,
    createAnimationField,
} from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'
import { vendureShopRequest } from '@/lib/vendureShop'

interface ProductDetailBlockProps {
    visibility?: any
    productSlug: string
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
}

// Simple GraphQL query for a single product by slug
const PRODUCT_QUERY = `
  query GetProduct($slug: String!) {
    product(slug: $slug) {
      id
      name
      slug
      description
      featuredAsset {
        preview
      }
      variants {
        id
        sku
        name
        price
        currencyCode
        stockLevel
      }
    }
  }
`

const ADD_TO_CART = `
  mutation AddToCart($variantId: ID!) {
    addItemToOrder(productVariantId: $variantId, quantity: 1) {
      ... on Order { id totalQuantity }
      ... on ErrorResult { errorCode message }
    }
  }
`

function formatPrice(price: number, currencyCode: string = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
    }).format(price / 100)
}

function ProductDetailBlockRender({
    visibility,
    productSlug,
    margin,
    dimensions,
    customPadding,
    animation,
}: ProductDetailBlockProps) {
    const [product, setProduct] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [selectedVariant, setSelectedVariant] = React.useState<any>(null)

    // Vendure only reports OUT_OF_STOCK when the variant tracks inventory; with
    // tracking off it always claims availability. The catalogue loader therefore
    // sets trackInventory on every reagent.
    const outOfStock = selectedVariant?.stockLevel === 'OUT_OF_STOCK'
    // A variant with no price is not for sale, whatever its stock says.
    const unpriced = Boolean(selectedVariant) && !(selectedVariant.price > 0)
    const [adding, setAdding] = React.useState(false)
    const [cartMessage, setCartMessage] = React.useState<string | null>(null)

    React.useEffect(() => {
        const fetchProduct = async () => {
            if (!productSlug) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                const data = await vendureShopRequest<{ product: any }>(PRODUCT_QUERY, { slug: productSlug })

                if (!data?.product) throw new Error('Product not found')

                setProduct(data.product)
                if (data.product.variants?.length > 0) {
                    setSelectedVariant(data.product.variants[0])
                }
            } catch (err) {
                console.error('Failed to fetch product:', err)
                setError('Failed to load product details.')
            } finally {
                setLoading(false)
            }
        }

        fetchProduct()
    }, [productSlug])

    const addToCart = async () => {
        if (!selectedVariant) return
        // Guard the action, not just the button. A disabled control is a UI
        // affordance; this is the actual rule. Selling an unpriced variant would
        // hand over real stock for nothing.
        if (outOfStock || unpriced) return
        setAdding(true)
        setCartMessage(null)
        try {
            const data = await vendureShopRequest<{ addItemToOrder: { totalQuantity?: number; message?: string } }>(ADD_TO_CART, { variantId: selectedVariant.id })
            if (data.addItemToOrder.message) throw new Error(data.addItemToOrder.message)
            setCartMessage('Added to cart')
            window.dispatchEvent(new CustomEvent('cart-updated', { detail: data.addItemToOrder.totalQuantity }))
        } catch (cause) {
            setCartMessage(cause instanceof Error ? cause.message : 'Could not add this item.')
        } finally {
            setAdding(false)
        }
    }


    if (!productSlug) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-product-detail" animation={animation} className="product-detail-wrapper">
                <div className="product-detail-container flex items-center justify-center p-12 bg-muted text-muted-foreground border rounded-xl">
                    🛍️ Add a product slug to display product details
                </div>
            </BlockShell>
        )
    }

    if (loading) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-product-detail" animation={animation} className="product-detail-wrapper">
                <div className="product-detail-container flex items-center justify-center p-24 text-muted-foreground border rounded-xl">
                    Loading product details...
                </div>
            </BlockShell>
        )
    }

    if (error || !product) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-product-detail" animation={animation} className="product-detail-wrapper">
                <div className="product-detail-container flex items-center justify-center p-24 text-destructive border border-destructive/20 rounded-xl bg-destructive/5">
                    {error || 'Product not found'}
                </div>
            </BlockShell>
        )
    }

    return (
        <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-product-detail" animation={animation} className="product-detail-wrapper">
            <div
                className="product-detail-container max-w-6xl mx-auto py-12 px-6"
                style={
                    {
                        // Accent by product FAMILY, not tenant (the owner ruling
                        // 2026-07-29): Orbit products keep the orbit
                        // teal, everything else (the TGP reagents) takes the
                        // green — on every host. Orbit slugs are the
                        // `orbit-*` catalogue (see catalog-data.ts).
                        '--tl-primary': product.slug?.startsWith('orbit')
                            ? 'var(--snm-btn,#2b93b8)'
                            : 'var(--tgp-btn,#0f8f6b)',
                        '--tl-primary-foreground': '#ffffff',
                    } as React.CSSProperties
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Image Gallery */}
                    <div className="flex flex-col gap-4">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-muted border relative">
                            {product.featuredAsset?.preview ? (
                                <img
                                    src={product.featuredAsset.preview}
                                    alt={product.name}
                                    className="object-cover w-full h-full"
                                />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                                    No Image Available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-col gap-6">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight">{product.name}</h1>
                            <p className="text-3xl font-semibold text-primary mt-4">
                                {!selectedVariant
                                    ? 'Select a variant'
                                    : unpriced
                                      // "$0.00" reads as free rather than as "not priced yet".
                                      ? 'Price on request'
                                      : formatPrice(selectedVariant.price, selectedVariant.currencyCode)}
                            </p>
                        </div>

                        {/* Vendure descriptions are staff-authored HTML; sanitize
                            anyway — defense-in-depth against a compromised or
                            pasted-in admin entry (runs in SSR and the browser). */}
                        <div className="prose dark:prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />

                        {product.variants?.length > 1 && (
                            <div className="flex flex-col gap-3 mt-4">
                                <label className="text-sm font-medium text-foreground">Variants</label>
                                <div className="flex flex-wrap gap-2">
                                    {product.variants.map((v: any) => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVariant(v)}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedVariant?.id === v.id
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-background hover:bg-muted text-foreground'
                                                }`}
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/*
                          * Two independent reasons a variant cannot be bought, and they
                          * must be reported separately because they mean different things
                          * to a customer:
                          *
                          *   outOfStock — we know the price, we have none left.
                          *   unpriced   — the catalogue lists it but no price is set yet.
                          *
                          * The unpriced guard is a safety property, not cosmetics: a
                          * variant at price 0 WITH stock is orderable for free. Every
                          * reagent currently sits at 0 pending the operator numbers, including
                          * the four with real vials on the shelf.
                          */}
                        <div className="pt-6 border-t mt-4 flex flex-col sm:flex-row gap-4">
                            <button
                                type="button"
                                onClick={() => void addToCart()}
                                className="flex-1 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                disabled={adding || !selectedVariant || outOfStock || unpriced}
                            >
                                {adding
                                    ? 'Adding…'
                                    : outOfStock
                                      ? 'Sold out'
                                      : unpriced
                                        ? 'Price on request'
                                        : 'Add to Cart — ' + (selectedVariant ? formatPrice(selectedVariant.price, selectedVariant.currencyCode) : '')}
                            </button>
                        </div>

                        {cartMessage ? (
                            <p className="text-sm" role="status">
                                {cartMessage} {cartMessage === 'Added to cart' ? <Link href="/cart" className="font-semibold text-primary underline-offset-4 hover:underline">View cart</Link> : null}
                            </p>
                        ) : null}

                        {outOfStock ? (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                                Currently sold out
                            </p>
                        ) : unpriced ? (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                                Contact us for pricing and availability
                            </p>
                        ) : selectedVariant?.stockLevel ? (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                In stock
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </BlockShell>
    )
}

const defaultProps: ProductDetailBlockProps = {
    visibility: null,
    productSlug: '',
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const ProductDetailBlockConfig: ComponentConfig<ProductDetailBlockProps> = {
    label: 'Product Detail',
    fields: {
        ...standardBlockFields({ defaultProps }),
        productSlug: { type: 'text', label: 'Product Slug' },
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: ProductDetailBlockRender,
}

export default ProductDetailBlockRender
