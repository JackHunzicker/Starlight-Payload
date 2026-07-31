'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { vendureShopRequest } from '@/lib/vendureShop'

type Payment = { state: string; metadata?: { public?: { checkoutLink?: string; invoiceId?: string } } }
type Order = { id: string; code: string; state: string; totalWithTax: number; shippingWithTax: number; currencyCode: string; totalQuantity: number; payments?: Payment[] }
type OperationResult = Order & { errorCode?: string; message?: string }
type ShippingMethod = { id: string; name: string; description: string; priceWithTax: number }
type PaymentMethod = { id: string; code: string; name: string; description: string; isEligible: boolean; eligibilityMessage?: string }

const ORDER_FIELDS = 'id code state totalWithTax shippingWithTax currencyCode totalQuantity'
const ACTIVE_ORDER = `query CheckoutOrder { activeOrder { ${ORDER_FIELDS} payments { state metadata } } }`
const SET_CUSTOMER = `mutation SetCustomer($input: CreateCustomerInput!) { setCustomerForOrder(input: $input) { ... on Order { ${ORDER_FIELDS} } ... on ErrorResult { errorCode message } } }`
const SET_SHIPPING_ADDRESS = `mutation SetShippingAddress($input: CreateAddressInput!) { setOrderShippingAddress(input: $input) { ... on Order { ${ORDER_FIELDS} } ... on ErrorResult { errorCode message } } }`
const SET_BILLING_ADDRESS = `mutation SetBillingAddress($input: CreateAddressInput!) { setOrderBillingAddress(input: $input) { ... on Order { ${ORDER_FIELDS} } ... on ErrorResult { errorCode message } } }`
const ELIGIBLE_SHIPPING = `query EligibleShipping { eligibleShippingMethods { id name description priceWithTax } }`
const SET_SHIPPING = `mutation SetShipping($ids: [ID!]!) { setOrderShippingMethod(shippingMethodId: $ids) { ... on Order { ${ORDER_FIELDS} } ... on ErrorResult { errorCode message } } }`
const TRANSITION = `mutation ArrangePayment { transitionOrderToState(state: "ArrangingPayment") { ... on Order { ${ORDER_FIELDS} } ... on ErrorResult { errorCode message } } }`
const ELIGIBLE_PAYMENT = `query EligiblePayment { eligiblePaymentMethods { id code name description isEligible eligibilityMessage } }`
const ADD_PAYMENT = `mutation AddPayment($input: PaymentInput!) { addPaymentToOrder(input: $input) { ... on Order { ${ORDER_FIELDS} payments { state metadata } } ... on ErrorResult { errorCode message } } }`

function formatPrice(value: number, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value / 100)
}

function assertOrder(result: OperationResult, operation: string): Order {
  if (result.errorCode || result.message) throw new Error(result.message || `${operation} failed`)
  return result
}

function resumableCheckoutLink(order: Order | null): string | undefined {
  if (order?.state !== 'ArrangingPayment') return undefined
  return [...(order.payments ?? [])].reverse()
    .find(payment => payment.state === 'Authorized' && payment.metadata?.public?.checkoutLink)
    ?.metadata?.public?.checkoutLink
}

export default function CheckoutPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [shippingMethodId, setShippingMethodId] = useState<string>('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodCode, setPaymentMethodCode] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      vendureShopRequest<{ activeOrder: Order | null }>(ACTIVE_ORDER),
      // Flat-rate methods carry no address dependency, so they are listable
      // before the address exists; the choice is re-validated at submit.
      vendureShopRequest<{ eligibleShippingMethods: ShippingMethod[] }>(ELIGIBLE_SHIPPING).catch(() => ({ eligibleShippingMethods: [] as ShippingMethod[] })),
      vendureShopRequest<{ eligiblePaymentMethods: PaymentMethod[] }>(ELIGIBLE_PAYMENT).catch(() => ({ eligiblePaymentMethods: [] as PaymentMethod[] })),
    ])
      .then(([orderData, shippingData, paymentData]) => {
        const active = orderData.activeOrder
        setOrder(active)
        // An order that already holds an open invoice belongs on the resume
        // page, not back in the details form (which is locked at this state).
        if (resumableCheckoutLink(active)) {
          setResuming(true)
          window.location.replace(`/checkout/pay/?orderCode=${encodeURIComponent(active!.code)}`)
          return
        }
        const methods = [...shippingData.eligibleShippingMethods].sort((a, b) => a.priceWithTax - b.priceWithTax)
        setShippingMethods(methods)
        if (methods.length) setShippingMethodId(methods[0].id)
        const eligiblePayments = paymentData.eligiblePaymentMethods.filter(method => method.isEligible)
        setPaymentMethods(eligiblePayments)
        if (eligiblePayments.length) {
          const bitcoinFirst = eligiblePayments.find(method => method.code === 'btcpay-server') ?? eligiblePayments[0]
          setPaymentMethodCode(bitcoinFirst.code)
        }
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load checkout.'))
      .finally(() => setLoading(false))
  }, [])

  const startPayment = async () => {
    // Re-read eligibility now the order is in ArrangingPayment; honour the
    // radio choice, falling back to the first method still eligible.
    const paymentData = await vendureShopRequest<{ eligiblePaymentMethods: PaymentMethod[] }>(ELIGIBLE_PAYMENT)
    const eligible = paymentData.eligiblePaymentMethods.filter(method => method.isEligible)
    if (!eligible.length) {
      const detail = paymentData.eligiblePaymentMethods[0]?.eligibilityMessage
      throw new Error(detail || 'No payment method is available for this order.')
    }
    const chosen = eligible.find(method => method.code === paymentMethodCode) ?? eligible[0]
    const paymentResult = await vendureShopRequest<{ addPaymentToOrder: OperationResult & { payments?: Payment[] } }>(ADD_PAYMENT, {
      input: { method: chosen.code, metadata: {} },
    })
    assertOrder(paymentResult.addPaymentToOrder, 'Payment creation')
    const checkoutLink = paymentResult.addPaymentToOrder.payments?.find(payment => payment.state === 'Authorized')?.metadata?.public?.checkoutLink
    if (!checkoutLink) throw new Error(`${chosen.name} did not return a checkout URL.`)
    window.location.assign(checkoutLink)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData(event.currentTarget)
      const firstName = String(form.get('firstName') || '').trim()
      const lastName = String(form.get('lastName') || '').trim()
      const emailAddress = String(form.get('emailAddress') || '').trim()
      const phoneNumber = String(form.get('phoneNumber') || '').trim()
      const address = {
        fullName: `${firstName} ${lastName}`,
        streetLine1: String(form.get('streetLine1') || '').trim(),
        streetLine2: String(form.get('streetLine2') || '').trim(),
        city: String(form.get('city') || '').trim(),
        province: String(form.get('province') || '').trim(),
        postalCode: String(form.get('postalCode') || '').trim(),
        countryCode: String(form.get('countryCode') || 'US').trim().toUpperCase(),
        phoneNumber,
      }

      const customer = await vendureShopRequest<{ setCustomerForOrder: OperationResult }>(SET_CUSTOMER, {
        input: { firstName, lastName, emailAddress, phoneNumber },
      })
      assertOrder(customer.setCustomerForOrder, 'Customer details')
      const shippingAddress = await vendureShopRequest<{ setOrderShippingAddress: OperationResult }>(SET_SHIPPING_ADDRESS, { input: address })
      assertOrder(shippingAddress.setOrderShippingAddress, 'Shipping address')
      const billingAddress = await vendureShopRequest<{ setOrderBillingAddress: OperationResult }>(SET_BILLING_ADDRESS, { input: address })
      assertOrder(billingAddress.setOrderBillingAddress, 'Billing address')

      // Re-read eligibility with the address applied; honour the customer's
      // radio choice, falling back to the cheapest if it became ineligible.
      const shipping = await vendureShopRequest<{ eligibleShippingMethods: ShippingMethod[] }>(ELIGIBLE_SHIPPING)
      if (!shipping.eligibleShippingMethods.length) throw new Error('No shipping method is available for this address.')
      const selectedShipping =
        shipping.eligibleShippingMethods.find(method => method.id === shippingMethodId) ??
        [...shipping.eligibleShippingMethods].sort((a, b) => a.priceWithTax - b.priceWithTax)[0]
      const shippingResult = await vendureShopRequest<{ setOrderShippingMethod: OperationResult }>(SET_SHIPPING, { ids: [selectedShipping.id] })
      const updatedOrder = assertOrder(shippingResult.setOrderShippingMethod, 'Shipping selection')
      setOrder(updatedOrder)

      const transition = await vendureShopRequest<{ transitionOrderToState: OperationResult }>(TRANSITION)
      assertOrder(transition.transitionOrderToState, 'Checkout transition')

      await startPayment()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be started.')
      setSubmitting(false)
    }
  }

  const retryPayment = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await startPayment()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payment could not be started.')
      setSubmitting(false)
    }
  }

  if (loading || resuming) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center" aria-live="polite">
        {resuming ? 'Resuming your pending payment…' : 'Loading checkout…'}
      </div>
    )
  }
  if (!order?.totalQuantity) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Your cart is empty</h1>
      <Link href="/" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Browse products</Link>
    </div>
  )

  const paymentSelector = paymentMethods.length > 0 ? (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium">Payment method</legend>
      <div className="mt-2 grid gap-2">
        {paymentMethods.map(method => (
          <label
            key={method.id}
            className="flex min-h-11 cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="paymentMethod"
                className="mt-0.5"
                value={method.code}
                checked={paymentMethodCode === method.code}
                onChange={() => setPaymentMethodCode(method.code)}
              />
              <span>
                <span className="block font-medium">{method.name}</span>
                {method.description ? <span className="mt-0.5 block text-xs text-muted-foreground">{method.description}</span> : null}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  ) : null

  // The order already sits in ArrangingPayment with no open invoice (it
  // expired or was cancelled): details are locked, so offer a fresh invoice
  // instead of an un-fillable form.
  if (order.state === 'ArrangingPayment') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Secure checkout</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Restart your payment</h1>
        <p className="mt-3 text-muted-foreground">
          Order <span className="font-mono">{order.code}</span> ({formatPrice(order.totalWithTax, order.currencyCode)}) is reserved and awaiting payment.
          Its previous invoice is no longer open — choose a payment method to create a fresh one.
        </p>
        <div className="mt-8 grid gap-5">
          {paymentSelector}
          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p> : null}
          <button
            className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={submitting}
            type="button"
            onClick={retryPayment}
          >
            {submitting ? 'Creating secure invoice…' : 'Create a new invoice'}
          </button>
        </div>
      </div>
    )
  }

  const inputClass = 'mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring'
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_20rem]">
      <main>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Secure checkout</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Shipping details</h1>
        <p className="mt-3 text-muted-foreground">After confirming your details, you&rsquo;ll finish paying on a secure crypto invoice.</p>
        <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm font-medium">First name<input className={inputClass} name="firstName" autoComplete="given-name" required /></label>
          <label className="text-sm font-medium">Last name<input className={inputClass} name="lastName" autoComplete="family-name" required /></label>
          <label className="text-sm font-medium sm:col-span-2">Email<input className={inputClass} name="emailAddress" type="email" autoComplete="email" required /></label>
          <label className="text-sm font-medium sm:col-span-2">Phone<input className={inputClass} name="phoneNumber" type="tel" autoComplete="tel" /></label>
          <label className="text-sm font-medium sm:col-span-2">Street address<input className={inputClass} name="streetLine1" autoComplete="address-line1" required /></label>
          <label className="text-sm font-medium sm:col-span-2">Apartment, suite, etc. <span className="text-muted-foreground">(optional)</span><input className={inputClass} name="streetLine2" autoComplete="address-line2" /></label>
          <label className="text-sm font-medium">City<input className={inputClass} name="city" autoComplete="address-level2" required /></label>
          <label className="text-sm font-medium">State / province<input className={inputClass} name="province" autoComplete="address-level1" required /></label>
          <label className="text-sm font-medium">Postal code<input className={inputClass} name="postalCode" autoComplete="postal-code" required /></label>
          <label className="text-sm font-medium">Country code<input className={inputClass} name="countryCode" defaultValue="US" autoComplete="country" minLength={2} maxLength={2} required /></label>
          {shippingMethods.length > 0 ? (
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Shipping method</legend>
              <div className="mt-2 grid gap-2">
                {shippingMethods.map(method => (
                  <label
                    key={method.id}
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value={method.id}
                        checked={shippingMethodId === method.id}
                        onChange={() => setShippingMethodId(method.id)}
                      />
                      <span className="font-medium">{method.name}</span>
                    </span>
                    <span className="font-semibold">{formatPrice(method.priceWithTax, order.currencyCode)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {paymentSelector}
          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:col-span-2" role="alert">{error}</p> : null}
          <button className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2" disabled={submitting} type="submit">
            {submitting ? 'Creating secure invoice…' : 'Continue to payment'}
          </button>
        </form>
      </main>
      <aside className="h-fit rounded-2xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 flex justify-between text-sm"><span>Items</span><span>{order.totalQuantity}</span></div>
        {(() => {
          // Order totals only include shipping once the method is applied at
          // submit — show the radio choice's price so the total is honest
          // before and after (shippingWithTax replaces the estimate then).
          const itemsTotal = order.totalWithTax - order.shippingWithTax
          const selectedShipping = shippingMethods.find(method => method.id === shippingMethodId)
          const shippingDisplay = order.shippingWithTax || selectedShipping?.priceWithTax || 0
          return (
            <>
              <div className="mt-2 flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(itemsTotal, order.currencyCode)}</span></div>
              <div className="mt-2 flex justify-between text-sm"><span>Shipping</span><span>{formatPrice(shippingDisplay, order.currencyCode)}</span></div>
              <div className="mt-5 flex justify-between border-t pt-5 text-lg"><span>Total</span><strong>{formatPrice(itemsTotal + shippingDisplay, order.currencyCode)}</strong></div>
            </>
          )
        })()}
        <p className="mt-3 text-xs text-muted-foreground">Invoices are denominated in {order.currencyCode} and paid in cryptocurrency.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/shipping-policy/" className="underline underline-offset-2 hover:text-foreground">Shipping policy</Link>
          {' · '}
          <Link href="/returns-policy/" className="underline underline-offset-2 hover:text-foreground">Returns &amp; refunds</Link>
        </p>
        <Link href="/cart/" className="mt-5 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">Return to cart</Link>
      </aside>
    </div>
  )
}
