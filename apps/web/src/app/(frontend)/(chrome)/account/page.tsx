import { redirect } from 'next/navigation'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantStrict, tenantHasCommerce } from '@/lib/tenants'
import { VENDURE_TOKEN_COOKIE, fetchCustomerOverview, resolvePayloadUser } from '@/lib/vendureIdentity'
import { SignOutButton } from './SignOutButton'
import { CommunityInvite } from './CommunityInvite'

export const metadata = {
    title: 'My Account | Acme Commerce',
    description: 'Your orders and account details',
}

export const dynamic = 'force-dynamic'

function money(minorUnits: number, currencyCode: string) {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' })
            .format(minorUnits / 100)
    } catch {
        return `$${(minorUnits / 100).toFixed(2)}`
    }
}

export default async function AccountPage() {
    const token = (await nextCookies()).get(VENDURE_TOKEN_COOKIE)?.value
    const tenant = resolveTenantStrict((await nextHeaders()).get('host'))
    if (!token || !tenant || !tenantHasCommerce(tenant) || !tenant.vendureChannelToken) {
        redirect('/login')
    }

    const customer = await fetchCustomerOverview(token, tenant.vendureChannelToken)
    if (!customer) redirect('/login')

    // Provision the derived Payload user here too, not only on an LMS action.
    // This page is where most people first arrive after signing in, and without
    // it a customer could be signed in, see their orders, and still have no
    // Payload record — so their first enrollment would create the account
    // instead, at the least convenient moment. One round-trip already made
    // above; this reuses it rather than resolving the session a second time.
    const user = await resolvePayloadUser(await getPayload({ config }), customer)

    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    const initial = (name || customer.emailAddress)[0]?.toUpperCase() ?? '?'

    return (
        <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-16">
            <header className="flex items-center gap-4">
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-muted text-2xl font-bold text-foreground">
                    {initial}
                </div>
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                        {name || 'Your account'}
                    </h1>
                    <p className="truncate text-sm text-muted-foreground">{customer.emailAddress}</p>
                </div>
                <div className="ml-auto">
                    <SignOutButton />
                </div>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Orders
                </h2>
                {customer.orders.items.length === 0 ? (
                    <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                        No orders yet.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {customer.orders.items.map((order) => (
                            <li key={order.id} className="rounded-xl border border-border bg-card p-4">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                        {order.code}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {order.orderPlacedAt
                                            ? new Date(order.orderPlacedAt).toLocaleDateString()
                                            : order.state}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground">
                                        {money(order.totalWithTax, order.currencyCode)}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {order.lines
                                        .map((line) => `${line.quantity} × ${line.productVariant.name}`)
                                        .join(', ')}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Addresses
                </h2>
                {!customer.addresses?.length ? (
                    <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                        No saved addresses. One is stored the first time you check out.
                    </p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {customer.addresses.map((address) => (
                            <li key={address.id} className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
                                <div>{address.streetLine1}</div>
                                {address.streetLine2 && <div>{address.streetLine2}</div>}
                                <div className="text-muted-foreground">
                                    {[address.city, address.postalCode].filter(Boolean).join(' ')}
                                </div>
                                <div className="text-muted-foreground">{address.country?.name}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <CommunityInvite
                communityUrl={process.env.NEXT_PUBLIC_COMMUNITY_URL || '/community/'}
                existingCode={(user as { sharkeyInviteCode?: string | null })?.sharkeyInviteCode ?? null}
            />
        </div>
    )
}
