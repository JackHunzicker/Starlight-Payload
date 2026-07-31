import { createPuckAiApiRoutes } from '@delmaredigital/payload-puck/ai'
import configPromise from '@payload-config'
import { sharedTools } from './shared-tools'
import { getPayload } from 'payload'

const cloudRoutes = createPuckAiApiRoutes({
    payloadConfig: configPromise,
    auth: {
        authenticate: async (request) => {
            const payload = await getPayload({ config: configPromise })
            const { user } = await payload.auth({
                headers: request.headers,
                canSetHeaders: false,
            })

            return { authenticated: Boolean(user) }
        },
    },
    ai: {
        apiKey: process.env.PUCK_API_KEY,
        context: `You are building pages for Acme Commerce, a orbitlabs research platform.
Brand: "Sanctuary" aesthetic — calming, trustworthy, Apple-tier polish, generous whitespace.
Use Section > Container > content nesting for proper layouts.
Primary color is teal (#0d9488 light / #4ecdc4 dark). Dark backgrounds use #0d1117.
Always use semantic Tailwind classes (bg-background, text-foreground, bg-card, etc.).`,
        tools: sharedTools,
    },
})

// The returned object has { POST: async (req: Request) => Response }
export const invokeCloudAi = cloudRoutes.POST;
