import { defineConfig } from 'tinacms'

/**
 * TinaCMS Configuration for Starlight
 * 
 * This enables local content editing for documentation.
 * TinaCMS runs alongside Astro and provides a visual editor at /admin/
 * 
 * NOTE: This is LOCAL MODE only. No Tina Cloud account required.
 * For production with cloud sync, add TINA_CLIENT_ID and TINA_TOKEN.
 */
export default defineConfig({
    branch: process.env.TINA_BRANCH || 'main',
    clientId: process.env.TINA_CLIENT_ID || '',
    token: process.env.TINA_TOKEN || '',

    build: {
        outputFolder: 'admin',
        publicFolder: 'public',
        host: '0.0.0.0',  // Bind to all interfaces for Docker
    },

    media: {
        tina: {
            mediaRoot: 'uploads',
            publicFolder: 'public',
        },
    },

    schema: {
        collections: [
            {
                name: 'docs',
                label: 'Documentation',
                path: 'src/content/docs',
                format: 'mdx',
                fields: [
                    {
                        type: 'string',
                        name: 'title',
                        label: 'Title',
                        isTitle: true,
                        required: true,
                    },
                    {
                        type: 'string',
                        name: 'description',
                        label: 'Description',
                    },
                    {
                        type: 'object',
                        name: 'sidebar',
                        label: 'Sidebar Options',
                        fields: [
                            { type: 'string', name: 'label', label: 'Custom Label' },
                            { type: 'number', name: 'order', label: 'Order (lower = higher)' },
                        ],
                    },
                    {
                        type: 'rich-text',
                        name: 'body',
                        label: 'Content',
                        isBody: true,
                    },
                ],
            },
            // The dev-era `archive` and `api` collections were removed with
            // their placeholder content (2026-07-29) — restore them alongside
            // real Archive content, not before.
        ],
    },
})
