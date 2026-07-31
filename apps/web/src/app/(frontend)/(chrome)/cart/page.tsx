'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'

type OrderLine = {
  id: string
  quantity: number
  linePriceWithTax: number
  productVariant: { id: string; name: string; sku: string; featuredAsset?: { preview?: string } }
}

type Order = {
  id: string
  code: string
  totalQuantity: number
  totalWithTax: number
  currencyCode: string
  lines: OrderLine[]
}

const ORDER_FIELDS = `
  id code totalQuantity totalWithTax currencyCode
  lines {
    id quantity linePriceWithTax
    productVariant { id name sku featuredAsset { preview } }
  }
`

const ACTIVE_ORDER = `query ActiveOrder { activeOrder { ${ORDER_FIELDS} } }`
const ADJUST_LINE = `
  mutation AdjustLine($id: ID!, $quantity: Int!) {
    adjustOrderLine(orderLineId: $id, quantity: $quantity) {
      ... on Order { ${ORDER_FIELDS} }
      ... on ErrorResult { errorCode message }
    }
  }
`
const REMOVE_LINE = `
  mutation RemoveLine($id: ID!) {
    removeOrderLine(orderLineId: $id) {
      ... on Order { ${ORDER_FIELDS} }
      ... on ErrorResult { errorCode message }
    }
  }
`

function formatPrice(value: number, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value / 100)
}

export default function CartPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingLine, setPendingLine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadOrder = useCallback(async () => {
    try {
      const data = await vendureShopRequest<{ activeOrder: Order | null }>(ACTIVE_ORDER)
      setOrder(data.activeOrder)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your cart.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOrder() }, [loadOrder])

  const mutateLine = async (line: OrderLine, quantity: number) => {
    setPendingLine(line.id)
    setError(null)
    try {
      const mutation = quantity === 0 ? REMOVE_LINE : ADJUST_LINE
      const variables = quantity === 0 ? { id: line.id } : { id: line.id, quantity }
      const data = await vendureShopRequest<Record<string, Order & { message?: string }>>(mutation, variables)
      const result = data[quantity === 0 ? 'removeOrderLine' : 'adjustOrderLine']
      if (result.message) throw new Error(result.message)
      setOrder(result)
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: result.totalQuantity }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your cart.')
    } finally {
      setPendingLine(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Commerce</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your cart</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Continue shopping</Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground" aria-live="polite">Loading your cart…</div>
      ) : error && !order ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive" role="alert">{error}</div>
      ) : !order?.lines.length ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <h2 className="text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-muted-foreground">Explore the catalog to add your first product.</p>
          <Link href="/" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {order.lines.map(line => (
              <article key={line.id} className="flex gap-4 rounded-2xl border bg-card p-4 sm:p-5">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {line.productVariant.featuredAsset?.preview ? <img src={line.productVariant.featuredAsset.preview} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{line.productVariant.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">SKU {line.productVariant.sku}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="inline-flex items-center rounded-lg border" aria-label={`Quantity for ${line.productVariant.name}`}>
                      <button type="button" className="min-h-11 min-w-11 hover:bg-muted disabled:opacity-50" disabled={pendingLine === line.id} onClick={() => void mutateLine(line, Math.max(0, line.quantity - 1))} aria-label="Decrease quantity">−</button>
                      <span className="min-w-10 text-center" aria-live="polite">{line.quantity}</span>
                      <button type="button" className="min-h-11 min-w-11 hover:bg-muted disabled:opacity-50" disabled={pendingLine === line.id} onClick={() => void mutateLine(line, line.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <strong>{formatPrice(line.linePriceWithTax, order.currencyCode)}</strong>
                  </div>
                  <button type="button" className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline" disabled={pendingLine === line.id} onClick={() => void mutateLine(line, 0)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border bg-card p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-5 flex justify-between border-t pt-5 text-lg"><span>Total</span><strong>{formatPrice(order.totalWithTax, order.currencyCode)}</strong></div>
            <p className="mt-2 text-xs text-muted-foreground">Shipping and taxes are calculated during checkout.</p>
            <Link href="/checkout/" className="mt-6 flex w-full justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Secure checkout</Link>
          </aside>
        </div>
      )}
      {error && order ? <p className="mt-6 text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}
