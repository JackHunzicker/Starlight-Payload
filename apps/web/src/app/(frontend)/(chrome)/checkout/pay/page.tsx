import { ResumePayment } from './ResumePayment'

export default async function CheckoutPayPage({ searchParams }: { searchParams: Promise<{ orderCode?: string }> }) {
  const { orderCode } = await searchParams
  return <ResumePayment orderCode={orderCode} />
}
