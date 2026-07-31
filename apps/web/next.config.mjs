import { withPayload } from '@payloadcms/next/withPayload'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Monorepo root (2 levels up from apps/web)
const monorepoRoot = resolve(__dirname, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker builds - see apps/web/Dockerfile
  output: 'standalone',

  // The floating dev-tools chip contaminates the blueprint fidelity captures
  // (scripts/fidelity-shots.mjs); production builds never render it anyway.
  devIndicators: false,

  experimental: {
    optimizePackageImports: ['@delmaredigital/payload-puck'],
  },

  // Whitelist media/asset origins for the Next.js Image component. Payload media
  // is same-origin relative, but Vendure asset URLs are absolute — production
  // must include the public server + Vendure origins (baked at build time).
  // IMAGE_REMOTE_ORIGINS: comma-separated extra origins, e.g.
  // "https://commerce.example.com,https://cdn.example.com".
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      ...[process.env.NEXT_PUBLIC_SERVER_URL, process.env.NEXT_PUBLIC_VENDURE_API_URL,
        ...(process.env.IMAGE_REMOTE_ORIGINS || '').split(',')]
        .map((value) => {
          try {
            const url = new URL((value || '').trim())
            return { protocol: url.protocol.replace(':', ''), hostname: url.hostname }
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .filter((pattern) => !['localhost', '127.0.0.1'].includes(pattern.hostname)),
    ],
  },

  // Turbopack config for monorepo builds - point to monorepo root
  turbopack: {
    root: monorepoRoot,
  },

  // Enable trailing slashes for consistency with Astro/Starlight
  trailingSlash: true,

  // Proxy /docs to Starlight
  // Local dev: localhost:7776, Docker: starlight:7776
  // IMPORTANT: Must proxy to /docs/ path since Starlight builds with base: '/docs/'
  // NOTE: With output:'standalone', rewrites are baked at build time (not runtime).
  // Changing STARLIGHT_URL requires a full rebuild: docker compose build web
  async rewrites() {
    const starlightUrl = process.env.STARLIGHT_URL || 'http://localhost:7776'
    return [
      { source: '/docs/', destination: `${starlightUrl}/docs/` },
      // Tina generates file-like routes such as /docs/admin/index.html, which
      // Next's trailing-slash rule does not normalize. Proxy both forms.
      { source: '/docs/:path*', destination: `${starlightUrl}/docs/:path*` },
      { source: '/docs/:path*/', destination: `${starlightUrl}/docs/:path*/` },
    ]
  },

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

// NOTE: Delmare's withPuckCSS build-time CSS wrapper is webpack-only and silently
// emits nothing under Turbopack (Next 16 default builder), so it is NOT used here.
// The Puck editor iframe stylesheet is compiled at runtime instead (editorStylesheet
// in payload.config.ts), which requires postcss + postcss-load-config as dependencies
// and postcss.config.mjs + src CSS inside the production image (see apps/web/Dockerfile).
export default withPayload(nextConfig, { devBundleServerPackages: false })
