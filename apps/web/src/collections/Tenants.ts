import type { CollectionConfig } from 'payload'
import { anyone, isAdmin, isStaff } from '../access'

/**
 * The brands. One row per tenant, consumed by @payloadcms/plugin-multi-tenant.
 *
 * The plugin requires a tenants collection but deliberately does not dictate its
 * fields ("you own these fields"). `code` is the join key to the routing layer in
 * `src/lib/tenants.ts`.
 *
 * WHY ROUTING IS NOT DRIVEN FROM HERE: hostname → brand resolution stays a static
 * map in code. It runs on every page render, so a database round-trip to decide
 * which brand a visitor is on would add a query to every request and make the
 * whole site depend on that lookup succeeding. `hostnames` below is recorded for
 * operators and is asserted against the static map by
 * `tests/int/tenant-resolution.int.spec.ts`, so the two cannot silently drift.
 */
export const Tenants: CollectionConfig = {
    slug: 'tenants',
    labels: { singular: 'Brand', plural: 'Brands' },
    access: {
        // Public reads: the frontend resolves brand-scoped content by tenant.
        read: anyone,
        create: isAdmin,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        group: 'Settings',
        useAsTitle: 'name',
        defaultColumns: ['name', 'code', 'domain'],
        description: 'The three brands. Adding one here does not route it — see src/lib/tenants.ts.',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Display name, e.g. "Orbit Labs".' },
        },
        {
            name: 'code',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description:
                    'Short key: tlr, tgp or snm. Must match the code in src/lib/tenants.ts and the page-tree folder name.',
            },
        },
        {
            name: 'domain',
            type: 'text',
            admin: { description: 'Primary public hostname, e.g. orbitlabs.example.' },
        },
        {
            name: 'hostnames',
            type: 'array',
            labels: { singular: 'Hostname', plural: 'Hostnames' },
            admin: {
                description:
                    'Every hostname this brand answers on, including parked and vanity domains. Informational — routing uses the static map.',
            },
            fields: [{ name: 'hostname', type: 'text', required: true }],
        },
    ],
}
