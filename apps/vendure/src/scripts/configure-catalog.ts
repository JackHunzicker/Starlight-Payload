import { VendureAdminClient } from './admin-api';
import { CATALOG, DEMO_PRODUCT_SLUGS, RETIRED_PRODUCT_SLUGS, type ProductSpec } from './catalog-data';

/**
 * Loads the real product catalogue and retires the bring-up demo products.
 *
 * Idempotent — matches products by slug and variants by SKU, so re-running updates
 * rather than duplicating. Safe to run on every deploy.
 *
 *   docker compose -f docker/docker-compose.yml exec -T vendure-server \
 *     node dist/scripts/configure-catalog.js
 *
 * Everything is created DISABLED. Enabling a product is a deliberate act in the
 * Admin Panel, after the owner has confirmed stock and price.
 */

type Coded = { id: string; code: string };
type ProductRow = {
    id: string;
    slug: string;
    enabled: boolean;
    variantList: { items: Array<{ id: string; sku: string }> };
};

async function main() {
    const client = new VendureAdminClient();
    await client.login();

    const channels = await client.request<{ channels: { items: Coded[] } }>(
        `query { channels { items { id code } } }`,
    );
    const channelId = (code: string) => {
        const found = channels.channels.items.find(c => c.code === code);
        if (!found) throw new Error(`Channel "${code}" not found — run configure-brands first`);
        return found.id;
    };

    // Vendure scopes reads to the channel implied by the auth token (the default
    // channel for a superadmin session), which is where products are created.
    const existing = await client.request<{ products: { items: ProductRow[] } }>(
        `query { products(options: { take: 200 }) {
            items { id slug enabled variantList { items { id sku } } }
        } }`,
    );
    const bySlug = new Map(existing.products.items.map(p => [p.slug, p]));

    const summary: string[] = [];
    const decisions: string[] = [];

    for (const spec of CATALOG) {
        const productId = await upsertProduct(client, spec, bySlug.get(spec.slug));

        // --- Option group -----------------------------------------------------
        // Option groups are per-product in Vendure; a product that already has one
        // keeps it, so we only create on first run.
        const withGroups = await client.request<{
            product: { optionGroups: Array<{ id: string; code: string; options: Coded[] }> } | null;
        }>(
            `query($id: ID!) { product(id: $id) {
                optionGroups { id code options { id code } }
            } }`,
            { id: productId },
        );

        let group = withGroups.product?.optionGroups.find(g => g.code === spec.optionGroup.code);
        if (!group) {
            const created = await client.request<{
                createProductOptionGroup: { id: string; code: string; options: Coded[] };
            }>(
                `mutation($input: CreateProductOptionGroupInput!) {
                    createProductOptionGroup(input: $input) { id code options { id code } }
                }`,
                {
                    input: {
                        code: spec.optionGroup.code,
                        translations: [{ languageCode: 'en', name: spec.optionGroup.name }],
                        options: spec.variants.map(v => ({
                            code: v.optionCode,
                            translations: [{ languageCode: 'en', name: v.optionName }],
                        })),
                    },
                },
            );
            group = created.createProductOptionGroup;
            await client.request(
                `mutation($productId: ID!, $optionGroupId: ID!) {
                    addOptionGroupToProduct(productId: $productId, optionGroupId: $optionGroupId) { id }
                }`,
                { productId, optionGroupId: group.id },
            );
        } else {
            // The group already exists but the spec may have gained options — a
            // strength change (Reagent Alpha 30 mg → 40 mg) or an added fill volume.
            // Options are only created with the group on first run, so add the
            // missing ones here rather than failing on a variant with no option.
            const present = new Set(group.options.map(o => o.code));
            const missing = spec.variants.filter(v => !present.has(v.optionCode));
            for (const v of missing) {
                const added = await client.request<{ createProductOption: Coded }>(
                    `mutation($input: CreateProductOptionInput!) {
                        createProductOption(input: $input) { id code }
                    }`,
                    {
                        input: {
                            productOptionGroupId: group.id,
                            code: v.optionCode,
                            translations: [{ languageCode: 'en', name: v.optionName }],
                        },
                    },
                );
                group.options.push(added.createProductOption);
                summary.push(`${spec.slug}: added option "${v.optionCode}"`);
            }
        }

        const optionIdByCode = new Map(group.options.map(o => [o.code, o.id]));

        // --- Variants ---------------------------------------------------------
        const currentVariants = await client.request<{
            product: { variantList: { items: Array<{ id: string; sku: string }> } } | null;
        }>(
            `query($id: ID!) { product(id: $id) { variantList { items { id sku } } } }`,
            { id: productId },
        );
        const variantIdBySku = new Map(
            (currentVariants.product?.variantList.items ?? []).map(v => [v.sku, v.id]),
        );

        const toCreate = spec.variants.filter(v => !variantIdBySku.has(v.sku));
        const toUpdate = spec.variants.filter(v => variantIdBySku.has(v.sku));

        // Inventory only where stock is real. Made-to-order lines (particle
        // API decanted from bulk) keep tracking off; reagent vials are discrete
        // and finite, so tracking on prevents overselling eight vials.
        const trackInventory = spec.trackInventory ? 'TRUE' : 'FALSE';

        // A variant with no price must never be purchasable. The four held
        // reagents carry real stock (8 vials) but no price yet — catalog-data
        // marks them "PRICE REQUIRED before this can sell" — and Vendure will
        // happily check out a $0 in-stock line, i.e. ship controlled research
        // reagents for free. Publishing stock zero keeps them VISIBLE and
        // "sold out", which is the intended presentation for anything
        // unavailable, and they become sellable the moment a price is set.
        const sellableStock = (v: { priceMinorUnits: number; stockOnHand?: number }) =>
            v.priceMinorUnits > 0 ? (v.stockOnHand ?? 0) : 0;
        for (const v of spec.variants) {
            if (v.priceMinorUnits <= 0 && (v.stockOnHand ?? 0) > 0) {
                summary.push(
                    `${spec.slug}: ${v.sku} held ${v.stockOnHand} but is UNPRICED — published as sold out`,
                );
            }
        }

        if (toCreate.length) {
            await client.request(
                `mutation($input: [CreateProductVariantInput!]!) {
                    createProductVariants(input: $input) { id sku price }
                }`,
                {
                    input: toCreate.map(v => {
                        const optionId = optionIdByCode.get(v.optionCode);
                        if (!optionId) throw new Error(`Option "${v.optionCode}" missing on ${spec.slug}`);
                        return {
                            productId,
                            sku: v.sku,
                            price: v.priceMinorUnits,
                            optionIds: [optionId],
                            enabled: v.enabled ?? false,
                            stockOnHand: sellableStock(v),
                            trackInventory,
                            translations: [{ languageCode: 'en', name: `${spec.name} — ${v.optionName}` }],
                        };
                    }),
                },
            );
        }

        // Re-assert price, availability and stock on existing variants so the
        // internal-notes stays the source of truth for anything the owner has not deliberately
        // overridden in the Admin Panel.
        for (const v of toUpdate) {
            await client.request(
                `mutation($input: [UpdateProductVariantInput!]!) {
                    updateProductVariants(input: $input) { id sku price }
                }`,
                {
                    input: [{
                        id: variantIdBySku.get(v.sku),
                        price: v.priceMinorUnits,
                        enabled: v.enabled ?? false,
                        stockOnHand: sellableStock(v),
                        trackInventory,
                        translations: [{ languageCode: 'en', name: `${spec.name} — ${v.optionName}` }],
                    }],
                },
            );
        }

        // Variants that exist in Vendure but are no longer in the spec — e.g. the
        // first-pass reagent SKUs replaced by per-strength ones. Disabled rather
        // than deleted: a deleted variant would orphan any order line referencing it.
        const specSkus = new Set(spec.variants.map(v => v.sku));
        const orphans = [...variantIdBySku.entries()].filter(([sku]) => !specSkus.has(sku));
        for (const [sku, id] of orphans) {
            await client.request(
                `mutation($input: [UpdateProductVariantInput!]!) {
                    updateProductVariants(input: $input) { id sku enabled }
                }`,
                { input: [{ id, enabled: false }] },
            );
            summary.push(`${spec.slug}: retired stale variant ${sku}`);
        }

        // --- Channel assignment ----------------------------------------------
        for (const code of spec.channels) {
            await client.request(
                `mutation($input: AssignProductsToChannelInput!) {
                    assignProductsToChannel(input: $input) { id }
                }`,
                // priceFactor 1.0 copies the price as-is into the channel. Per-channel
                // prices can then diverge without affecting the other brand.
                { input: { channelId: channelId(code), productIds: [productId], priceFactor: 1.0 } },
            );
        }

        const liveVariants = spec.variants.filter(v => v.enabled).length;
        const stocked = spec.variants.reduce((n, v) => n + (v.stockOnHand ?? 0), 0);
        summary.push(
            `${spec.slug.padEnd(38)} ${String(spec.variants.length).padStart(2)} variant(s)` +
            `  ${spec.enabled ? 'LIVE' : 'off '}` +
            `  ${liveVariants ? `${liveVariants} sellable` : 'none sellable'}` +
            `${stocked ? `  ${stocked} in stock` : ''}` +
            `  [${spec.channels.join(', ')}]`,
        );
        for (const note of spec.pendingDecisions ?? []) decisions.push(`  ${spec.slug}: ${note}`);
    }

    // --- Retire the bring-up demo products and superseded records ------------
    for (const slug of [...DEMO_PRODUCT_SLUGS, ...RETIRED_PRODUCT_SLUGS]) {
        const demo = bySlug.get(slug);
        if (!demo) continue;
        if (!demo.enabled) {
            summary.push(`${slug}: already retired`);
            continue;
        }
        await client.request(
            `mutation($input: UpdateProductInput!) { updateProduct(input: $input) { id enabled } }`,
            { input: { id: demo.id, enabled: false } },
        );
        summary.push(`${slug}: retired (disabled, not deleted — reversible)`);
    }

    console.log('\n--- Catalogue ---');
    for (const line of summary) console.log(line);
    if (decisions.length) {
        console.log('\n--- Needs a decision from the owner before enabling ---');
        for (const line of decisions) console.log(line);
    }
    // The storefront catalogue is served from Vendure's search index, not from the
    // product tables. Without this, a product disabled above KEEPS APPEARING in the
    // shop — the retired demo line was still on sale after being turned off, which
    // is the worst kind of silent failure: you believe you have unpublished
    // something and customers can still buy it.
    const job = await client.request<{ reindex: { id: string; state: string } }>(
        `mutation { reindex { id state } }`,
    );
    console.log(`\nSearch reindex queued (job ${job.reindex.id}). The storefront ` +
        `catalogue reflects enable/disable changes only after it completes.`);

    console.log(
        '\nOnly lines the owner has confirmed in stock are live. Everything else exists as a ' +
        'record to price against — enable it in the Admin Panel (Vendure /admin → ' +
        'Catalog → Products) once stock and price are confirmed.',
    );
}

async function upsertProduct(
    client: VendureAdminClient,
    spec: ProductSpec,
    existing: ProductRow | undefined,
): Promise<string> {
    const translations = [{
        languageCode: 'en',
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
    }];

    // Availability is declared in catalog-data, not inferred. A product is live
    // only where the owner has confirmed stock; everything else exists as a record to
    // price against later.
    const enabled = spec.enabled ?? false;

    if (existing) {
        await client.request(
            `mutation($input: UpdateProductInput!) { updateProduct(input: $input) { id } }`,
            { input: { id: existing.id, enabled, translations } },
        );
        return existing.id;
    }

    const created = await client.request<{ createProduct: { id: string } }>(
        `mutation($input: CreateProductInput!) { createProduct(input: $input) { id } }`,
        { input: { enabled, translations } },
    );
    return created.createProduct.id;
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
