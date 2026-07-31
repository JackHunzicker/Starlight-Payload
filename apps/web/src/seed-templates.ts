/**
 * Starter Page Templates for Acme Commerce
 *
 * Run with: npx tsx apps/web/src/seed-templates.ts
 *
 * Creates 3 pages in the Payload "pages" collection demonstrating
 * correct Puck component nesting patterns:
 *   1. Homepage — Hero + product catalog + course catalog
 *   2. About/Landing — Content sections with proper Section > Container nesting
 *   3. Course Catalog — Full catalog page with filtering
 *
 * NESTING PATTERN (from payload-puck best practices):
 *   Section (full-bleed background, semantic HTML)
 *     └── Container (max-width constraint)
 *           └── Content components (Heading, Text, Grid, Flex, etc.)
 */

import { getPayload } from 'payload'
import config from './payload.config'
import { migrateLegacyPuckData } from './lib/migrateLegacyPuckData'

const HOMEPAGE_TEMPLATE = {
    content: [
        {
            type: 'Section',
            props: {
                id: 'hero-section',
                background: { type: 'solid', color: { r: 13, g: 17, b: 23, a: 1 } },
                padding: { top: 120, bottom: 120, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
        {
            type: 'Section',
            props: {
                id: 'products-section',
                padding: { top: 80, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
        {
            type: 'Section',
            props: {
                id: 'courses-section',
                background: { type: 'solid', color: { r: 241, g: 245, b: 249, a: 1 } },
                padding: { top: 80, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
    ],
    root: { props: {} },
    zones: {
        'hero-section:content': [
            {
                type: 'Container',
                props: {
                    id: 'hero-container',
                    maxWidth: '1200px',
                },
            },
        ],
        'hero-container:content': [
            {
                type: 'Heading',
                props: {
                    id: 'hero-heading',
                    text: 'Welcome to Acme Commerce',
                    level: 'h1',
                    align: 'center',
                    size: 'xxxl',
                },
            },
            {
                type: 'Text',
                props: {
                    id: 'hero-text',
                    text: 'The next generation orbitlabs research platform. Explore cutting-edge courses, premium products, and a vibrant scientific community.',
                    align: 'center',
                    color: 'muted-foreground',
                },
            },
            {
                type: 'Flex',
                props: {
                    id: 'hero-buttons',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: { top: 24, bottom: 0, left: 0, right: 0, unit: 'px' },
                },
            },
        ],
        'hero-buttons:content': [
            {
                type: 'Button',
                props: {
                    id: 'hero-cta-products',
                    label: 'Browse Products',
                    href: '/products',
                    variant: 'primary',
                    size: 'lg',
                },
            },
            {
                type: 'Button',
                props: {
                    id: 'hero-cta-courses',
                    label: 'Start Learning',
                    href: '/courses',
                    variant: 'secondary',
                    size: 'lg',
                },
            },
        ],
        'products-section:content': [
            {
                type: 'Container',
                props: {
                    id: 'products-container',
                    maxWidth: '1200px',
                },
            },
        ],
        'products-container:content': [
            {
                type: 'Heading',
                props: {
                    id: 'products-heading',
                    text: 'Featured Products',
                    level: 'h2',
                    align: 'center',
                },
            },
            {
                type: 'Spacer',
                props: { id: 'products-spacer', height: '32px' },
            },
            {
                type: 'ProductCatalogBlock',
                props: {
                    id: 'product-catalog',
                    limit: 8,
                    collectionId: '',
                },
            },
        ],
        'courses-section:content': [
            {
                type: 'Container',
                props: {
                    id: 'courses-container',
                    maxWidth: '1200px',
                },
            },
        ],
        'courses-container:content': [
            {
                type: 'Heading',
                props: {
                    id: 'courses-heading',
                    text: 'Popular Courses',
                    level: 'h2',
                    align: 'center',
                },
            },
            {
                type: 'Spacer',
                props: { id: 'courses-spacer', height: '32px' },
            },
            {
                type: 'CourseCatalogBlock',
                props: {
                    id: 'course-catalog',
                    limit: 6,
                    accessLevel: 'all',
                },
            },
        ],
    },
}

const ABOUT_TEMPLATE = {
    content: [
        {
            type: 'Section',
            props: {
                id: 'about-hero',
                background: { type: 'solid', color: { r: 13, g: 17, b: 23, a: 1 } },
                padding: { top: 100, bottom: 100, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
        {
            type: 'Section',
            props: {
                id: 'about-mission',
                padding: { top: 80, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
        {
            type: 'Section',
            props: {
                id: 'about-features',
                background: { type: 'solid', color: { r: 241, g: 245, b: 249, a: 1 } },
                padding: { top: 80, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
    ],
    root: { props: {} },
    zones: {
        'about-hero:content': [
            {
                type: 'Container',
                props: { id: 'about-hero-c', maxWidth: '900px' },
            },
        ],
        'about-hero-c:content': [
            {
                type: 'Heading',
                props: {
                    id: 'about-title',
                    text: 'About Acme Commerce',
                    level: 'h1',
                    align: 'center',
                    size: 'xxxl',
                },
            },
            {
                type: 'Text',
                props: {
                    id: 'about-subtitle',
                    text: 'Pioneering the future of orbitlabs through research, education, and community.',
                    align: 'center',
                    color: 'muted-foreground',
                },
            },
        ],
        'about-mission:content': [
            {
                type: 'Container',
                props: { id: 'about-mission-c', maxWidth: '800px' },
            },
        ],
        'about-mission-c:content': [
            {
                type: 'Heading',
                props: {
                    id: 'mission-heading',
                    text: 'Our Mission',
                    level: 'h2',
                    align: 'center',
                },
            },
            {
                type: 'Text',
                props: {
                    id: 'mission-body',
                    text: 'Acme Commerce is dedicated to advancing orbitlabs through open science, rigorous education, and a supportive global community. We believe that the convergence of nanotechnology and medicine holds the key to solving some of humanity\'s most pressing health challenges.',
                    align: 'center',
                },
            },
        ],
        'about-features:content': [
            {
                type: 'Container',
                props: { id: 'about-features-c', maxWidth: '1200px' },
            },
        ],
        'about-features-c:content': [
            {
                type: 'Heading',
                props: {
                    id: 'features-heading',
                    text: 'What We Offer',
                    level: 'h2',
                    align: 'center',
                },
            },
            {
                type: 'Spacer',
                props: { id: 'features-spacer', height: '32px' },
            },
            {
                type: 'Grid',
                props: {
                    id: 'features-grid',
                    columns: 3,
                    gap: '24px',
                },
            },
        ],
        'features-grid:content': [
            {
                type: 'Card',
                props: {
                    id: 'feature-research',
                    title: 'Research Archive',
                    description: 'Access peer-reviewed papers, datasets, and analysis tools for cutting-edge orbitlabs research.',
                },
            },
            {
                type: 'Card',
                props: {
                    id: 'feature-courses',
                    title: 'Learning Platform',
                    description: 'Self-paced courses covering particle synthesis, drug delivery systems, and clinical applications.',
                },
            },
            {
                type: 'Card',
                props: {
                    id: 'feature-community',
                    title: 'Community Hub',
                    description: 'Connect with researchers, educators, and practitioners in our federated social platform.',
                },
            },
        ],
    },
}

const COURSE_CATALOG_TEMPLATE = {
    content: [
        {
            type: 'Section',
            props: {
                id: 'catalog-hero',
                background: { type: 'solid', color: { r: 13, g: 17, b: 23, a: 1 } },
                padding: { top: 80, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
        {
            type: 'Section',
            props: {
                id: 'catalog-main',
                padding: { top: 60, bottom: 80, left: 0, right: 0, unit: 'px' },
                element: 'section',
            },
        },
    ],
    root: { props: {} },
    zones: {
        'catalog-hero:content': [
            {
                type: 'Container',
                props: { id: 'catalog-hero-c', maxWidth: '900px' },
            },
        ],
        'catalog-hero-c:content': [
            {
                type: 'Heading',
                props: {
                    id: 'catalog-title',
                    text: 'Course Catalog',
                    level: 'h1',
                    align: 'center',
                    size: 'xxxl',
                },
            },
            {
                type: 'Text',
                props: {
                    id: 'catalog-subtitle',
                    text: 'Explore our comprehensive library of orbitlabs courses, from introductory concepts to advanced research methodologies.',
                    align: 'center',
                    color: 'muted-foreground',
                },
            },
        ],
        'catalog-main:content': [
            {
                type: 'Container',
                props: { id: 'catalog-main-c', maxWidth: '1200px' },
            },
        ],
        'catalog-main-c:content': [
            {
                type: 'CourseCatalogBlock',
                props: {
                    id: 'full-catalog',
                    limit: 24,
                    accessLevel: 'all',
                },
            },
        ],
    },
}

async function seed() {
    const payload = await getPayload({ config })

    const templates = [
        { title: 'Homepage', slug: 'home', data: HOMEPAGE_TEMPLATE },
        { title: 'About', slug: 'about', data: ABOUT_TEMPLATE },
        { title: 'Courses', slug: 'courses', data: COURSE_CATALOG_TEMPLATE },
    ]

    for (const tpl of templates) {
        // Check if page already exists
        const existing = await payload.find({
            collection: 'pages',
            where: { slug: { equals: tpl.slug } },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            console.log(`  [skip] "${tpl.title}" (slug: ${tpl.slug}) already exists`)
            continue
        }

        await payload.create({
            collection: 'pages',
            data: {
                title: tpl.title,
                slug: tpl.slug,
                puckData: migrateLegacyPuckData(tpl.data as never),
            } as any,
        })
        console.log(`  [created] "${tpl.title}" (slug: ${tpl.slug})`)
    }

    console.log('\nDone! Visit http://localhost:7773 to see the pages.')
    process.exit(0)
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
