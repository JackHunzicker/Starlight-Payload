export interface VendureSyncEvent {
    type: 'product.created' | 'product.updated' | 'product.deleted'
    productId: string
    timestamp: string
    data?: {
        name: string
        slug: string
        description: string
        price: number
        sku: string
    }
}

export type SyncStatus = 'synced' | 'syncing' | 'error'
