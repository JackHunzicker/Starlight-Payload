import { z } from 'zod'

/**
 * AI Tools in @delmaredigital/payload-puck AiTool format.
 *
 * Format: { description, inputSchema (zod), execute(input, context) }
 * where context = { payload, user } provided by createPuckAiApiRoutes.
 *
 * NOT Vercel AI SDK format (which uses `parameters` instead of `inputSchema`).
 */
export const sharedTools = {
    getProducts: {
        description: 'Fetch available products from the commerce database. Use when you need real product names, prices, or slugs for ProductCatalogBlock or ProductDetailBlock props.',
        inputSchema: z.object({
            limit: z.number().optional().describe('Number of products to fetch. Default is 5.'),
        }),
        execute: async (params: unknown, context: any) => {
            const { limit = 5 } = (params ?? {}) as { limit?: number }
            try {
                const payload = context?.payload
                if (!payload) {
                    // No unauthenticated Local API fallback: the wrapper must
                    // supply the authenticated context or the tool refuses.
                    return { error: 'No authenticated Payload context available.' }
                }

                const result = await payload.find({
                    collection: 'products',
                    limit,
                    overrideAccess: false,
                    user: context?.user,
                })
                return result.docs.map((doc: any) => ({
                    id: doc.id,
                    name: doc.name,
                    slug: doc.slug,
                    price: doc.price || 0,
                    description: typeof doc.description === 'string' ? doc.description.substring(0, 100) : ''
                }))
            } catch (error) {
                console.error('[AI Tool] getProducts error:', error)
                return { error: 'Failed to fetch products from the database.' }
            }
        }
    },

    getCourses: {
        description: 'Fetch available courses from the LMS database. Use when you need real course names, descriptions, or slugs for CourseCatalogBlock or CourseDetailBlock props.',
        inputSchema: z.object({
            limit: z.number().optional().describe('Number of courses to fetch. Default is 5.'),
        }),
        execute: async (params: unknown, context: any) => {
            const { limit = 5 } = (params ?? {}) as { limit?: number }
            try {
                const payload = context?.payload
                if (!payload) {
                    // No unauthenticated Local API fallback: the wrapper must
                    // supply the authenticated context or the tool refuses.
                    return { error: 'No authenticated Payload context available.' }
                }

                const result = await payload.find({
                    collection: 'courses',
                    limit,
                    overrideAccess: false,
                    user: context?.user,
                })
                return result.docs.map((doc: any) => ({
                    id: doc.id,
                    title: doc.title,
                    slug: doc.slug,
                    accessLevel: doc.accessLevel || 'free',
                    description: typeof doc.description === 'string' ? doc.description.substring(0, 100) : ''
                }))
            } catch (error) {
                console.error('[AI Tool] getCourses error:', error)
                return { error: 'Failed to fetch courses from the database.' }
            }
        }
    }
}
