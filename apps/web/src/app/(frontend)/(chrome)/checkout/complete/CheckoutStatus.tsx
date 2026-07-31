'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'

type OrderStatus = { code: string; state: string; payments: Array<{ state: string }> }

const ORDER_STATUS = `query CheckoutOrderStatus($code: String!) {
  orderByCode(code: $code) { code state payments { state } }
}`

export function CheckoutStatus({ orderCode }: { orderCode?: string }) {
  const [order, setOrder] = useState<OrderStatus | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    if (!orderCode) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      try {
        const data = await vendureShopRequest<{ orderByCode: OrderStatus | null }>(ORDER_STATUS, { code: orderCode })
        if (cancelled) return
        setOrder(data.orderByCode)
        setCheckFailed(false)
        if (data.orderByCode?.state !== 'PaymentSettled') timer = setTimeout(check, 2_000)
      } catch {
        if (!cancelled) {
          setCheckFailed(true)
          timer = setTimeout(check, 4_000)
        }
      }
    }
    void check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [orderCode])

  const settled = order?.state === 'PaymentSettled' && order.payments.some(payment => payment.state === 'Settled')
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary" aria-hidden="true">{settled ? '✓' : '…'}</div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{settled ? 'Payment confirmed' : 'Confirming your payment'}</h1>
      <p className="mt-4 text-muted-foreground">
        {settled
          ? 'BTCPay Server and Vendure both confirm that this order is settled.'
          : 'BTCPay Server has returned you to Acme Commerce. We are waiting for the signed settlement confirmation.'}
      </p>
      {orderCode ? <p className="mt-5 rounded-lg border bg-card p-4 font-mono text-sm">Order {orderCode}</p> : null}
      {!orderCode ? <p className="mt-4 text-sm text-destructive">No order code was supplied. Check your account or contact support before paying again.</p> : null}
      {checkFailed ? <p className="mt-4 text-sm text-muted-foreground">The status check is temporarily unavailable. This page will keep trying.</p> : null}
      {!settled && orderCode ? <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">Bitcoin confirmation can take a few moments. You can safely leave this page; the signed webhook continues processing on the server.</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account/" className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">View account</Link>
        <Link href="/" className="rounded-lg border px-5 py-3 font-semibold">Return home</Link>
      </div>
    </div>
  )
}
