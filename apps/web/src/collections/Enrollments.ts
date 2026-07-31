import type { CollectionConfig } from 'payload'
import { isAdmin, isSelfOrStaff, isStaff } from '../access'

export const Enrollments: CollectionConfig = {
    slug: 'enrollments',
    access: {
        // A learner sees only their own enrollments; staff see all.
        read: isSelfOrStaff('user'),
        // Deliberately staff-only. Self-service enrollment must go through a
        // server route that sets `overrideAccess` after checking payment or
        // eligibility — never a client-side write, which would let anyone
        // grant themselves any course.
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        description: 'User enrollments in courses with role-based access',
    },
    fields: [
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
        },
        {
            name: 'course',
            type: 'relationship',
            relationTo: 'courses',
            required: true,
        },
        {
            name: 'role',
            type: 'select',
            required: true,
            options: [
                { label: 'Student', value: 'student' },
                { label: 'Teacher', value: 'teacher' },
                { label: 'Teaching Assistant', value: 'ta' },
                { label: 'Manager', value: 'manager' },
            ],
            defaultValue: 'student',
        },
        {
            name: 'enrolledAt',
            type: 'date',
            defaultValue: () => new Date().toISOString(),
        },
        {
            name: 'progress',
            type: 'number',
            min: 0,
            max: 100,
            defaultValue: 0,
            admin: {
                description: 'Completion percentage (0-100) — recomputed from completedActivities by the completion route',
            },
        },
        {
            name: 'completedActivities',
            type: 'relationship',
            relationTo: 'activities',
            hasMany: true,
            admin: {
                description: 'Activities the learner has marked complete (drives progress)',
            },
        },
        {
            name: 'status',
            type: 'select',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Completed', value: 'completed' },
                { label: 'Dropped', value: 'dropped' },
            ],
            defaultValue: 'active',
        },
    ],
    indexes: [
        {
            fields: ['user', 'course'],
            unique: true,
        },
    ],
}
