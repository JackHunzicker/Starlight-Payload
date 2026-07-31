import React from 'react'
// Self-hosted fonts. The token layer has always declared Inter/JetBrains Mono,
// but nothing loaded them — visitors got system-ui. Spectral is Vertex's
// serif voice (blueprint turn 5); the storefront product modules stay Inter.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/spectral/300.css'
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/500.css'
import '@fontsource/spectral/600.css'
import './styles.css'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getBrandSettings } from '@/components/layout/SiteChrome'
import { resolveTenant } from '@/lib/tenants'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = resolveTenant((await headers()).get('host'))
  const settings = await getBrandSettings(tenant)
  return {
    // Falls back to the brand's own name rather than a hardcoded one, so a brand
    // with no settings row still never displays another brand's identity.
    title: settings?.siteName || tenant.name,
    description: settings?.footerText || undefined,
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  const tenant = resolveTenant((await headers()).get('host'))

  // The storefront brands (TLR/TGP) paint from the blueprint's scoped variable
  // set — light mode is the var() fallbacks, dark is the .storefront-vars
  // override in styles.css. Orbit keeps the --tl-* token ground.
  // `brand-*` scopes the commerce accent (`primary`): teal is Orbit's
  // signature — TLR infra surfaces take the house purple, TGP its green.
  const bodyClass =
    tenant.code === 'snm'
      ? 'flex min-h-screen flex-col bg-background font-sans antialiased text-foreground'
      : `flex min-h-screen flex-col font-sans antialiased storefront-vars storefront-body brand-${tenant.code}`

  // NO chrome here. Chrome ownership is decided on the server by whoever
  // knows the route: the `(chrome)` route group's layout renders it for the
  // infrastructure pages, and the catch-all renders it only for Puck pages
  // that do not own their own (see components/layout/SiteChrome.tsx). This
  // replaced an unconditional header/footer plus an injected
  // `[data-site-chrome]{display:none}` suppression rule.
  return (
    <html lang="en">
      <body className={bodyClass}>{children}</body>
    </html>
  )
}
