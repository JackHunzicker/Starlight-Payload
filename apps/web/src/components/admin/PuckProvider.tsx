'use client'

import { PuckConfigProvider } from '@delmaredigital/payload-puck/client'
import { puckConfig } from '@/components/puck/puckConfig'
import { DEFAULT_LAYOUTS } from '@delmaredigital/payload-puck/layouts'
// Compose the official Puck AI plugin directly (upstream-supported, not a
// component override). Delmare's createAiPlugin wrapper CJS-require()s
// plugin-ai, which fails in this ESM client bundle and silently degrades to
// a no-op placeholder — that is why the chat UI never appeared.
import { createAiPlugin } from '@puckeditor/plugin-ai'
import { SiteHeader } from '../layout/SiteHeader'
import { SiteFooter } from '../layout/SiteFooter'

/*
 * Mock settings for the EDITOR preview only.
 * On the live site, layout.tsx fetches the brand-settings row for the
 * and passes them to SiteHeader/SiteFooter. These mock values are
 * only used inside the Puck admin editor iframe for WYSIWYG preview.
 *
 * Source of truth for live site: the "brand-settings" collection, one row per tenant
 * (siteName, logo, navLinks, footerText, socialLinks)
 */
const mockSettings = {
    siteName: 'Acme Commerce',
    navLinks: [
        { label: 'Courses', url: '/courses' },
        { label: 'Products', url: '/products' },
        { label: 'Community', url: '/community' },
    ],
    footerText: 'The next generation learning and commerce platform.',
}

// Inject header/footer into all default layouts
const layoutsWithHeaderFooter = DEFAULT_LAYOUTS.map(layout => ({
    ...layout,
    header: () => <SiteHeader settings={mockSettings} />,
    footer: () => <SiteFooter settings={mockSettings} />,
}))

const aiPlugin = createAiPlugin({
    host: '/api/puck/ai',
})

export default function PuckProvider({ children }: { children: React.ReactNode }) {
    return (
        <PuckConfigProvider config={puckConfig} layouts={layoutsWithHeaderFooter} plugins={[aiPlugin]}>
            {children}
        </PuckConfigProvider>
    )
}
