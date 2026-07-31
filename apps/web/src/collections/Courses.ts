import type { CollectionConfig } from 'payload'
import { isAdmin, isStaff, publishedOrStaff } from '../access'

export const Courses: CollectionConfig = {
    slug: 'courses',
    access: {
        read: publishedOrStaff('status'),
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'title',
        description: 'Learning courses with sections and activities',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'URL-friendly identifier (e.g. "intro-to-orbitlabs")',
            },
            hooks: {
                beforeValidate: [
                    ({ value, data }) => {
                        if (!value && data?.title) {
                            return data.title
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/(^-|-$)/g, '')
                        }
                        return value
                    },
                ],
            },
        },
        {
            name: 'description',
            type: 'richText',
        },
        {
            name: 'thumbnail',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'sections',
            type: 'relationship',
            relationTo: 'course-sections',
            hasMany: true,
        },
        {
            name: 'accessLevel',
            type: 'select',
            options: [
                { label: 'Free', value: 'free' },
                { label: 'Subscriber', value: 'subscriber' },
                { label: 'Premium', value: 'premium' },
            ],
            defaultValue: 'free',
        },
        {
            name: 'status',
            type: 'select',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
                { label: 'Archived', value: 'archived' },
            ],
            defaultValue: 'draft',
        },
    ],
}
