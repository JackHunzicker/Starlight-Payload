'use client'

/**
 * Unified Puck Configuration
 *
 * This config is used by BOTH:
 * 1. PuckProvider.tsx (Editor Preview)
 * 2. ClientPageRendererInner.tsx (Live Site)
 *
 * It includes:
 * - All custom components (Scene3DBlock, RemotionBlock)
 * - All base components from payload-puck (including Accordion with full prop support)
 *
 * IMPORTANT: The extendConfig mergeConfigs function CONCATENATES category.components
 * without deduplication. Do NOT add components that already exist in fullConfig.categories.
 *
 * fullConfig.categories.interactive already contains: ['Button', 'Card', 'Divider', 'Accordion']
 * So we only add our NEW custom components here.
 *
 * NOTE: We use the package's Accordion directly (not a local override) because it properly
 * handles all props including dimensions, margin, padding, background, transform, animation.
 */

import { extendConfig, fullConfig } from '@delmaredigital/payload-puck/config/editor'
import { Scene3DBlockConfig } from './Scene3DBlock'
import { RemotionBlockConfig } from './RemotionBlock'
import { ExternalFeedBlockConfig } from './ExternalFeedBlock'
import { ProductCatalogBlockConfig } from './ProductCatalogBlock'
import { ProductDetailBlockConfig } from './ProductDetailBlock'
import { CourseCatalogBlockConfig } from './CourseCatalogBlock'
import { CourseDetailBlockConfig } from './CourseDetailBlock'
import { CatalogHeroBlockConfig } from './CatalogHeroBlock'
import { CatalogFilterBarBlockConfig } from './CatalogFilterBarBlock'
import { CatalogSectionHeadBlockConfig } from './CatalogSectionHeadBlock'
import { ProductModuleGridBlockConfig } from './ProductModuleGridBlock'
import { SplitHeroBlockConfig } from './SplitHeroBlock'
import { PlatformHeroBlockConfig } from './PlatformHeroBlock'
import { PlatformPaneBlockConfig } from './PlatformPaneBlock'
import { SiteHeaderBlockConfig } from './SiteHeaderBlock'
import { SiteFooterBlockConfig } from './SiteFooterBlock'

// Create the unified configuration
export const puckConfig = extendConfig({
    base: fullConfig,
    components: {
        // Custom interactive blocks only - don't override package components
        Scene3DBlock: Scene3DBlockConfig,
        RemotionBlock: RemotionBlockConfig,
        ExternalFeedBlock: ExternalFeedBlockConfig,
        ProductCatalogBlock: ProductCatalogBlockConfig,
        ProductDetailBlock: ProductDetailBlockConfig,
        CourseCatalogBlock: CourseCatalogBlockConfig,
        CourseDetailBlock: CourseDetailBlockConfig,
        // Blueprint brand screens (canonical .dc.html fidelity pages)
        // Granular catalogue parts (the livetest decomposition of the
        // monolithic brand screens — see the §14a granular-editability mission)
        CatalogHeroBlock: CatalogHeroBlockConfig,
        CatalogFilterBarBlock: CatalogFilterBarBlockConfig,
        CatalogSectionHeadBlock: CatalogSectionHeadBlockConfig,
        ProductModuleGridBlock: ProductModuleGridBlockConfig,
        SplitHeroBlock: SplitHeroBlockConfig,
        PlatformHeroBlock: PlatformHeroBlockConfig,
        PlatformPaneBlock: PlatformPaneBlockConfig,
        SiteHeaderBlock: SiteHeaderBlockConfig,
        SiteFooterBlock: SiteFooterBlockConfig,
        // Granular Orbit parts (the SNM livetest decomposition)
    },
    categories: {
        // Only add NEW components that don't exist in fullConfig.categories.interactive
        // fullConfig.interactive already has: ['Button', 'Card', 'Divider', 'Accordion']
        interactive: {
            title: 'Interactive',
            components: [
                'Scene3DBlock',
                'RemotionBlock',
                'ExternalFeedBlock',
                'ProductCatalogBlock',
                'ProductDetailBlock',
                'CourseCatalogBlock',
                'CourseDetailBlock'
            ],  // Only our NEW components!
        },
        catalog: {
            title: 'Catalogue Parts',
            components: [
                'CatalogHeroBlock',
                'CatalogFilterBarBlock',
                'CatalogSectionHeadBlock',
                'ProductModuleGridBlock',
                'SplitHeroBlock',
                'PlatformHeroBlock',
                'PlatformPaneBlock',
                'SiteHeaderBlock',
                'SiteFooterBlock',
            ],
        },
    },
})
