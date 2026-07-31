import { getPayload } from 'payload'
import config from '@payload-config'
import type { VendureSyncEvent } from '@acme-commerce/types'

export async function POST(request: Request) {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== process.env.VENDURE_WEBHOOK_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const event: VendureSyncEvent = await request.json()

    try {
        const { type, productId, data } = event

        if (type === 'product.deleted') {
            await payload.delete({
                collection: 'products',
                where: { vendureId: { equals: productId } },
            })
            return Response.json({ success: true })
        }

        // Find existing product
        const existing = await payload.find({
            collection: 'products',
            where: { vendureId: { equals: productId } },
            limit: 1,
        })

        if (existing.docs[0]) {
            await payload.update({
                collection: 'products',
                id: existing.docs[0].id,
                data: {
                    ...data,
                    syncStatus: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                    syncError: null,
                },
            })
        } else {
            await (payload.create as any)({
                collection: 'products',
                data: {
                    vendureId: productId,
                    ...data,
                    syncStatus: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                },
            })
        }

        return Response.json({ success: true })
    } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
    }
}
