/**
 * Design-system barrel — the components that define the sites' visual language.
 * Consumed by the design-sync converter (claude.ai/design) and usable anywhere
 * a flat import of the visual components is wanted.
 */
import './ds-shims'

export { SiteHeader } from './components/layout/SiteHeader'
export { SiteFooter } from './components/layout/SiteFooter'
// Scene3DBlock / RemotionBlock intentionally excluded from this barrel: their
// runtimes (three.js / Remotion player) exceed the design-sync 12MB bundle cap.
// The 3D particle hero is represented in designs as a placeholder region.
export { default as ProductCatalogBlock } from './components/puck/ProductCatalogBlock'
export { default as ProductDetailBlock } from './components/puck/ProductDetailBlock'
export { default as CourseCatalogBlock } from './components/puck/CourseCatalogBlock'
export { default as CourseDetailBlock } from './components/puck/CourseDetailBlock'

import { ExternalFeedBlockConfig } from './components/puck/ExternalFeedBlock'
/** The feed component is defined inline in its Puck config — re-exposed here. */
export const ExternalFeedBlock = ExternalFeedBlockConfig.render
