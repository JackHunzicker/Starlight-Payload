import { CheckoutStatus } from './CheckoutStatus'

export default async function CheckoutCompletePage({ searchParams }: { searchParams: Promise<{ orderCode?: string }> }) {
  const { orderCode } = await searchParams
  return <CheckoutStatus orderCode={orderCode} />
}
