import type { CollectionConfig } from 'payload'
import { isAdmin, isStaff } from '../access'
import { courseChildrenRead } from '../access/lmsChildren'

export const Activities: CollectionConfig = {
    slug: 'activities',
    access: {
        // Inherited from the owning course via its sections — see
        // access/lmsChildren.ts (closes the anonymous-enumeration leak).
        read: courseChildrenRead('activities'),
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'title',
        description: 'Interactive learning activities with 3D or video content',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'content',
            type: 'richText',
        },
        {
            name: 'mediaType',
            type: 'select',
            required: true,
            options: [
                { label: 'GLTF 3D Model', value: 'gltf' },
                { label: 'Remotion Video', value: 'remotion' },
                { label: 'None', value: 'none' },
            ],
            defaultValue: 'none',
        },
        // Conditional: GLTF URL (shown when mediaType is 'gltf')
        {
            name: 'gltfUrl',
            type: 'text',
            admin: {
                description: 'URL to GLTF/GLB file (from Media upload)',
                condition: (data) => data?.mediaType === 'gltf',
            },
        },
        // Conditional: Remotion composition (shown when mediaType is 'remotion')
        {
            name: 'remotionComposition',
            type: 'text',
            admin: {
                description: 'Remotion composition name',
                condition: (data) => data?.mediaType === 'remotion',
            },
        },
        {
            name: 'order',
            type: 'number',
            defaultValue: 0,
        },
        {
            name: 'duration',
            type: 'number',
            admin: {
                description: 'Estimated duration in minutes',
            },
        },
    ],
}
