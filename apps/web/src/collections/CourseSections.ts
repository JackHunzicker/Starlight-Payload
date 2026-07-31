import type { CollectionConfig } from 'payload'
import { isAdmin, isStaff } from '../access'
import { courseChildrenRead } from '../access/lmsChildren'

export const CourseSections: CollectionConfig = {
    slug: 'course-sections',
    access: {
        // Inherited from the owning course: published (+ free/enrolled for
        // non-staff). `read: anyone` let anonymous queries enumerate
        // draft/premium children — see access/lmsChildren.ts.
        read: courseChildrenRead('sections'),
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'title',
        description: 'Hierarchical grouping of activities within courses',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Brief summary shown in course outlines',
            },
        },
        {
            name: 'order',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Display order within the course',
            },
        },
        {
            name: 'activities',
            type: 'relationship',
            relationTo: 'activities',
            hasMany: true,
        },
    ],
}
