/**
 * Demo catalogue for the multi-brand seed script.
 *
 * This is sample data, not a real product list. It exists to exercise the parts
 * of the platform that are genuinely hard to get right: per-channel catalogues,
 * variants with an option group, products that are priced but deliberately not
 * yet sellable, and inventory-tracked lines that must not oversell.
 *
 * Replace `CATALOG` wholesale with your own products — nothing outside this file
 * knows what is in it. `configure-catalog.ts` is the only consumer.
 */

export type VariantSpec = {
    /** Vendure stores money in minor units — 2500 is $25.00. */
    priceMinorUnits: number
    sku: string
    optionCode: string
    optionName: string
    /** Variant-level switch. A product can be live while most sizes are not. */
    enabled?: boolean
    /** Discrete units held. Omit for made-to-order lines. */
    stockOnHand?: number
}

export type ProductSpec = {
    slug: string
    name: string
    description: string
    channels: string[]
    optionGroup: { code: string; name: string }
    variants: VariantSpec[]
    /** Products ship disabled unless explicitly turned on here. */
    enabled?: boolean
    /** Real inventory rather than made-to-order. */
    trackInventory?: boolean
    pendingDecisions?: string[]
}

const SAMPLE_NOTICE =
    'Sample product for demonstration purposes. Replace this catalogue with your own before ' +
    'running the seed against anything real.'

const SIZES: Array<{ code: string; name: string }> = [
    { code: 'small', name: 'Small' },
    { code: 'medium', name: 'Medium' },
    { code: 'large', name: 'Large' },
]

const SIZE_PRICES: Record<string, number> = { small: 2_500, medium: 4_500, large: 8_000 }

/**
 * Made-to-order: no stock is tracked, so these are always purchasable. Only the
 * first size is live — the rest are fully priced but disabled, which is the
 * common "catalogue exists, storefront shows a subset" shape.
 */
const LIVE_SIZES = new Set(['small'])

const widgetProducts: ProductSpec[] = [
    { code: 'alpha', label: 'Alpha' },
    { code: 'beta', label: 'Beta' },
].map((w) => ({
    slug: `demo-widget-${w.code}`,
    name: `Demo Widget ${w.label}`,
    description: `A made-to-order sample product in three sizes.\n\n${SAMPLE_NOTICE}`,
    channels: ['tlr'],
    optionGroup: { code: 'size', name: 'Size' },
    enabled: w.code === 'alpha',
    variants: SIZES.map((s) => ({
        optionCode: s.code,
        optionName: s.name,
        sku: `DEMO-WIDGET-${w.code.toUpperCase()}-${s.code.toUpperCase()}`,
        priceMinorUnits: SIZE_PRICES[s.code],
        enabled: w.code === 'alpha' && LIVE_SIZES.has(s.code),
    })),
}))

/**
 * Inventory-tracked lines. Vendure refuses to oversell these, which is what the
 * negative tests in `configure-catalog` assert against.
 */
const STOCKED_UNITS = 8

const stockedProducts: ProductSpec[] = [
    { code: 'one', label: 'One', held: true },
    { code: 'two', label: 'Two', held: true },
    { code: 'three', label: 'Three', held: false },
].map((k) => ({
    slug: `demo-kit-${k.code}`,
    name: `Demo Kit ${k.label}`,
    description: `An inventory-tracked sample product.\n\n${SAMPLE_NOTICE}`,
    channels: ['tgp', 'tlr'],
    optionGroup: { code: 'pack', name: 'Pack' },
    enabled: true,
    trackInventory: true,
    variants: [
        {
            optionCode: 'standard',
            optionName: 'Standard',
            sku: `DEMO-KIT-${k.code.toUpperCase()}`,
            priceMinorUnits: 10_000,
            enabled: true,
            // Not held → reports out of stock and cannot be added to a cart.
            stockOnHand: k.held ? STOCKED_UNITS : 0,
        },
    ],
    ...(k.held ? {} : { pendingDecisions: ['Not held — displays as sold out.'] }),
}))

/**
 * A single product with two preparations under one listing, rather than two
 * near-duplicate products. Exercises the merge path in `configure-catalog`.
 */
const variantPairProduct: ProductSpec = {
    slug: 'demo-bundle',
    name: 'Demo Bundle',
    description: `One listing, two preparations.\n\n${SAMPLE_NOTICE}`,
    channels: ['tgp', 'tlr'],
    optionGroup: { code: 'preparation', name: 'Preparation' },
    enabled: true,
    trackInventory: true,
    variants: [
        { optionCode: 'with-extras', optionName: 'With Extras', sku: 'DEMO-BUNDLE-PLUS', priceMinorUnits: 10_000, enabled: true, stockOnHand: 0 },
        { optionCode: 'base', optionName: 'Base', sku: 'DEMO-BUNDLE-BASE', priceMinorUnits: 10_000, enabled: true, stockOnHand: 0 },
    ],
    pendingDecisions: ['Not held — displays as sold out.'],
}

export const CATALOG: ProductSpec[] = [...widgetProducts, ...stockedProducts, variantPairProduct]

/**
 * Superseded product records, retired (disabled, never deleted) by
 * configure-catalog when two listings collapse into one.
 */
export const RETIRED_PRODUCT_SLUGS = ['demo-bundle-plus', 'demo-bundle-base']

/**
 * Records superseded by the catalogue above. Disabled rather than deleted so the
 * change is reversible and any order history stays intact.
 */
export const DEMO_PRODUCT_SLUGS = [
    'sample-product-one',
    'sample-product-two',
    'sample-product-three',
]
