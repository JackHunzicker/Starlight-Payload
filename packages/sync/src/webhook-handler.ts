import type { Payload } from 'payload'
import type { VendureSyncEvent } from '@acme-commerce/types'

export async function handleVendureSync(
    payload: Payload,
    event: VendureSyncEvent
): Promise<{ success: boolean; error?: string }> {
    try {
        const { type, productId, data } = event

        if (type === 'product.deleted') {
            await payload.delete({
                collection: 'products',
                where: { vendureId: { equals: productId } },
            })
            return { success: true }
        }

        // Find existing product
        const existing = await payload.find({
            collection: 'products',
            where: { vendureId: { equals: productId } },
            limit: 1,
        })

        if (existing.docs[0]) {
            // Update existing
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
            // Create new
            await payload.create({
                collection: 'products',
                data: {
                    vendureId: productId,
                    ...data,
                    syncStatus: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                },
            })
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: String(error) }
    }
}
