import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
    slug: 'products',
    admin: {
        useAsTitle: 'name',
        description: 'Synced from Vendure. READ-ONLY.',
    },
    access: {
        create: () => false,
        update: () => false,
        delete: () => false,
    },
    fields: [
        { name: 'vendureId', type: 'text', required: true, unique: true, admin: { readOnly: true } },
        { name: 'name', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'slug', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'description', type: 'textarea', admin: { readOnly: true } },
        { name: 'price', type: 'number', admin: { readOnly: true } },
        { name: 'sku', type: 'text', admin: { readOnly: true } },
        {
            name: 'syncStatus',
            type: 'select',
            options: ['synced', 'syncing', 'error'],
            defaultValue: 'synced',
            admin: { readOnly: true },
        },
        { name: 'lastSyncedAt', type: 'date', admin: { readOnly: true } },
        { name: 'syncError', type: 'text', admin: { readOnly: true } },
    ],
}
