import type { CollectionConfig } from 'payload'
import { isAdmin, isStaff } from '../access'
import { hasRole, STAFF_ROLES } from '../access'

export const Community: CollectionConfig = {
    slug: 'community',
    access: {
        // publishedAt is the publication gate: unset (draft) or future-dated
        // (scheduled) posts are staff-only. The collection was `read: anyone`
        // with no gate at all. (Verified empty at change time — no backfill.)
        read: ({ req }) => {
            if (hasRole(req.user, ...STAFF_ROLES)) return true
            return { publishedAt: { less_than_equal: new Date().toISOString() } }
        },
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
    },
    admin: { useAsTitle: 'title' },
    fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'richText' },
        { name: 'author', type: 'relationship', relationTo: 'users' },
        { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
        { name: 'publishedAt', type: 'date' },
    ],
}
