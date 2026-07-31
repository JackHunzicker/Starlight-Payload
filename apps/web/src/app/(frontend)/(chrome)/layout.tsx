import React from 'react'
import { headers } from 'next/headers'
import { SiteChromeHeader, SiteChromeFooter } from '@/components/layout/SiteChrome'
import { resolveTenant } from '@/lib/tenants'

/**
 * Chrome for the infrastructure routes — cart, checkout, login, account,
 * products, courses.
 *
 * These are plain Next routes, not Puck pages, so they can never own their
 * chrome the way a Puck page does (SiteHeaderBlock/SiteFooterBlock in
 * content). Grouping them under `(chrome)` gives them the header and footer
 * without the `(frontend)` layout having to render it for everyone —
 * route groups do not affect URLs, so `/cart` is still `/cart`.
 */
export default async function ChromeLayout({ children }: { children: React.ReactNode }) {
  const tenant = resolveTenant((await headers()).get('host'))
  return (
    <>
      <SiteChromeHeader tenant={tenant} />
      <main className="flex-1">{children}</main>
      <SiteChromeFooter tenant={tenant} />
    </>
  )
}
