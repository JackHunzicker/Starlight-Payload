import type { CollectionConfig } from 'payload'
import { anyone, isAdmin, isStaff } from '../access'

/**
 * Per-brand site chrome: name, logo, navigation, footer, social links.
 *
 * This replaces the `site-settings` GLOBAL. A Payload global is a singleton, so
 * all three brands shared one name and one logo — Orbit and Vertex both
 * rendered the Acme Commerce wordmark and put "Acme Commerce" in the browser tab.
 * Three domains with three identities need three documents.
 *
 * Registered with @payloadcms/plugin-multi-tenant as `isGlobal: true`, which is
 * the vendor's documented answer to exactly this: the collection behaves like a
 * global *per tenant*, and the admin hides the list view so editing it feels like
 * editing one settings screen for the brand you have selected.
 *
 * The `tenant` field is added by the plugin — do not add one here.
 */
export const BrandSettings: CollectionConfig = {
    slug: 'brand-settings',
    labels: { singular: 'Brand Settings', plural: 'Brand Settings' },
    access: {
        // Rendered on every public page of every brand.
        read: anyone,
        create: isAdmin,
        update: isStaff,
        delete: isAdmin,
    },
    admin: {
        group: 'Settings',
        useAsTitle: 'siteName',
        description: 'Header, footer and identity for the selected brand.',
    },
    fields: [
        {
            name: 'siteName',
            type: 'text',
            required: true,
            admin: { description: 'Shown in the header and the browser tab for this brand.' },
        },
        {
            name: 'tagline',
            type: 'text',
            admin: { description: 'Optional short line under the wordmark, e.g. "RESEARCH".' },
        },
        {
            name: 'enable_auth',
            type: 'checkbox',
            admin: { hidden: true },
        },
        {
            name: 'logo',
            type: 'upload',
            relationTo: 'media',
            admin: {
                description: 'Header logo for this brand. Recommended: SVG or transparent PNG.',
            },
        },
        {
            name: 'navLinks',
            type: 'array',
            label: 'Navigation Links',
            maxRows: 10,
            labels: { singular: 'Nav Link', plural: 'Nav Links' },
            admin: { description: 'Links displayed in this brand’s header navigation.' },
            fields: [
                { name: 'label', type: 'text', required: true },
                {
                    name: 'url',
                    type: 'text',
                    required: true,
                    admin: {
                        description: 'Relative path (e.g. /about) or full URL (e.g. https://example.com)',
                    },
                },
                { name: 'openInNewTab', type: 'checkbox', defaultValue: false },
            ],
        },
        {
            name: 'footerText',
            type: 'textarea',
            admin: { description: 'Footer text for this brand (e.g. copyright notice).' },
        },
        {
            name: 'socialLinks',
            type: 'array',
            label: 'Social Links',
            maxRows: 10,
            labels: { singular: 'Social Link', plural: 'Social Links' },
            admin: { description: 'Social media links displayed in this brand’s footer.' },
            fields: [
                {
                    name: 'platform',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Twitter / X', value: 'twitter' },
                        { label: 'GitHub', value: 'github' },
                        { label: 'Discord', value: 'discord' },
                        { label: 'YouTube', value: 'youtube' },
                        { label: 'LinkedIn', value: 'linkedin' },
                        { label: 'Instagram', value: 'instagram' },
                        { label: 'Mastodon', value: 'mastodon' },
                        { label: 'Other', value: 'other' },
                    ],
                },
                { name: 'url', type: 'text', required: true },
            ],
        },
    ],
}
