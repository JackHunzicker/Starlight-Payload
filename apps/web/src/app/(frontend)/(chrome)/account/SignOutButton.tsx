'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { vendureShopRequest } from '@/lib/vendureShop'

const LOGOUT = /* GraphQL */ `
  mutation Logout { logout { success } }
`

/**
 * Signs out of Vendure through `/api/shop`, so the proxy can replace the
 * first-party session cookie with the anonymous token Vendure hands back.
 * Clearing the cookie client-side would not work — it is httpOnly, which is the
 * point.
 */
export function SignOutButton() {
    const router = useRouter()
    const [busy, setBusy] = React.useState(false)

    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true)
                try {
                    await vendureShopRequest(LOGOUT, {})
                } catch {
                    // Fall through: a failed logout still sends them to the
                    // storefront rather than stranding them on a dead page.
                } finally {
                    router.push('/')
                    router.refresh()
                }
            }}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground
                       transition-colors hover:bg-muted disabled:opacity-60
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
            {busy ? 'Signing out…' : 'Sign out'}
        </button>
    )
}
