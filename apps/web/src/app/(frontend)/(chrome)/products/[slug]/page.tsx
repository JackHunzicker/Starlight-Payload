import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import ProductDetailBlock from '@/components/puck/ProductDetailBlock'

// Products are Vendure-synced — without this, the first hit to a slug is cached
// in the full route cache indefinitely and serves stale prices until rebuild.
export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const payload = await getPayload({ config })

    const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: slug } },
        limit: 1,
    })

    const product = docs[0]
    if (!product) notFound()

    return <ProductDetailBlock productSlug={slug} />
}
