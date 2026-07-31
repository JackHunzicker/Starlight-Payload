'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'

type PaymentInfo = { id: string; state: string; method: string; metadata?: { public?: { checkoutLink?: string } } }
type OrderInfo = { code: string; state: string; totalWithTax: number; currencyCode: string; payments?: PaymentInfo[] }

const RESUME_ORDER = `query ResumeOrder($code: String!) {
  orderByCode(code: $code) { code state totalWithTax currencyCode payments { id state method metadata } }
}`

const METHOD_LABELS: Record<string, string> = {
  'btcpay-server': 'Bitcoin via BTCPay Server',
  paymento: 'Paymento (USDT, ETH, BTC & more)',
}

function formatPrice(value: number, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value / 100)
}

function DontHaveCryptoPanel() {
  return (
    <aside className="mx-auto mt-10 max-w-xl rounded-2xl border bg-card p-6 text-left">
      <h2 className="text-lg font-semibold">Don&rsquo;t have crypto yet?</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          Install the{' '}
          <a href="https://www.exodus.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
            Exodus wallet
          </a>{' '}
          — card, Apple Pay and bank purchases are built in.
        </li>
        <li>Buy Bitcoin directly (skip buying another coin and swapping), slightly more than your order total to cover network fees.</li>
        <li>Come back to this page and open the invoice, then send the exact amount shown from your wallet.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        First-time purchases inside a wallet include the provider&rsquo;s identity check and usually take 10–30 minutes.
        If the invoice timer runs out before your coins arrive, restart from checkout — your order details are kept.
      </p>
    </aside>
  )
}

export function ResumePayment({ orderCode }: { orderCode?: string }) {
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [inaccessible, setInaccessible] = useState(false)

  useEffect(() => {
    if (!orderCode) {
      setLoading(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      try {
        const data = await vendureShopRequest<{ orderByCode: OrderInfo | null }>(RESUME_ORDER, { code: orderCode })
        if (cancelled) return
        setOrder(data.orderByCode)
        setInaccessible(!data.orderByCode)
        setLoading(false)
        if (data.orderByCode && data.orderByCode.state !== 'PaymentSettled') timer = setTimeout(check, 3_000)
      } catch {
        if (!cancelled) {
          // Guest access to an order expires a couple of hours after checkout
          // (Vendure's order-by-code window), which reads as an error here.
          setInaccessible(true)
          setLoading(false)
        }
      }
    }
    void check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [orderCode])

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-20 text-center" aria-live="polite">Looking up your order…</div>

  if (!orderCode || inaccessible || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight">We couldn&rsquo;t open this order</h1>
        <p className="mt-4 text-muted-foreground">
          {!orderCode
            ? 'No order code was supplied in the link.'
            : 'Guest order links expire a couple of hours after checkout. If you already paid, your order is safe — contact support with your order code and we will confirm it.'}
        </p>
        {orderCode ? <p className="mt-5 rounded-lg border bg-card p-4 font-mono text-sm">Order {orderCode}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/cart/" className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">View cart</Link>
          <Link href="/" className="rounded-lg border px-5 py-3 font-semibold">Return home</Link>
        </div>
      </div>
    )
  }

  const settled = order.state === 'PaymentSettled'
  const authorized = [...(order.payments ?? [])].reverse().find(
    payment => payment.state === 'Authorized' && payment.metadata?.public?.checkoutLink,
  )
  const checkoutLink = authorized?.metadata?.public?.checkoutLink
  const cancelled = order.state === 'Cancelled'

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary" aria-hidden="true">
        {settled ? '✓' : '…'}
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        {settled ? 'Payment confirmed' : cancelled ? 'This order was cancelled' : 'Finish paying for your order'}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {settled
          ? 'The payment provider and Vendure both confirm that this order is settled.'
          : cancelled
            ? 'No payment is due. If this is unexpected, contact support with your order code.'
            : 'Your order is reserved and its invoice is ready. This page updates automatically once your payment confirms — it is safe to refresh or bookmark.'}
      </p>
      <p className="mt-5 rounded-lg border bg-card p-4 font-mono text-sm">
        Order {order.code} · {formatPrice(order.totalWithTax, order.currencyCode)}
      </p>
      {!settled && !cancelled ? (
        checkoutLink ? (
          <div className="mt-8">
            <a href={checkoutLink} className="inline-flex min-h-12 items-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
              Open payment invoice
            </a>
            {authorized ? <p className="mt-3 text-xs text-muted-foreground">{METHOD_LABELS[authorized.method] ?? authorized.method}</p> : null}
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">This order has no open invoice — it may have expired or been cancelled.</p>
            <Link href="/checkout/" className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
              Restart payment
            </Link>
          </div>
        )
      ) : null}
      {settled ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account/" className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">View account</Link>
          <Link href="/" className="rounded-lg border px-5 py-3 font-semibold">Return home</Link>
        </div>
      ) : null}
      {!settled && !cancelled ? <DontHaveCryptoPanel /> : null}
    </div>
  )
}
