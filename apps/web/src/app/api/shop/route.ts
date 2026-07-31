import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { resolveTenantStrict, tenantHasCommerce } from '@/lib/tenants'

export const dynamic = 'force-dynamic'

const TOKEN_COOKIE = 'vendure-auth-token'

export async function POST(request: NextRequest) {
  const endpoint = process.env.VENDURE_INTERNAL_URL || 'http://localhost:7774/shop-api'
  const token = request.cookies.get(TOKEN_COOKIE)?.value

  // Select the brand's Vendure channel from the request hostname. Without this
  // every storefront reads the default channel and all three brands would show
  // the same catalogue at the same prices. Strict in production: an unknown
  // Host gets no channel at all.
  const tenant = resolveTenantStrict(request.headers.get('host'))
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown host.' }, { status: 404 })
  }
  const channelToken = tenantHasCommerce(tenant) ? tenant.vendureChannelToken : null

  // A brand with no channel must not fall through to Vendure's default channel.
  // Omitting `vendure-token` makes Vendure serve the default channel's catalogue,
  // which put the full product list on Orbit Labs — a site that is
  // informational and B2B-by-contact only and must never expose a storefront.
  // The same refusal covers a brand behind a holding page: its channel exists,
  // but a site under construction must not be able to take an order.
  if (!channelToken) {
    return NextResponse.json(
      { error: `${tenant.name} does not operate a storefront.` },
      { status: 404 },
    )
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'vendure-token': channelToken,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: await request.text(),
      cache: 'no-store',
    })

    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    })

    const nextToken = upstream.headers.get('vendure-auth-token')
    if (nextToken) {
      response.cookies.set(TOKEN_COOKIE, nextToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    return response
  } catch (error) {
    console.error('[Shop Proxy] Vendure request failed:', error)
    return NextResponse.json({ error: 'Commerce service unavailable' }, { status: 503 })
  }
}
