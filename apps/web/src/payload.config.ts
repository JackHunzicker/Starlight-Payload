import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { createPuckPlugin } from '@delmaredigital/payload-puck/plugin'
import { pageTreePlugin } from '@delmaredigital/payload-page-tree'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Courses } from './collections/Courses'
import { CourseSections } from './collections/CourseSections'
import { Activities } from './collections/Activities'
import { Enrollments } from './collections/Enrollments'
import { Community } from './collections/Community'
import { Tenants } from './collections/Tenants'
import { BrandSettings } from './collections/BrandSettings'
import { migrateLegacyPuckData } from './lib/migrateLegacyPuckData'
import { STAFF_ROLES, hasRole, isAdmin, isStaff, publishedOrStaff } from './access'
import { hardenFolderAccess, hardenPluginAccess } from './access/hardenPluginAccess'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// All public origins this one app answers on (three brand domains + the server
// URL). Payload's CORS/CSRF must allow every one or cross-brand admin/API calls
// die in production. Comma-separated in PAYLOAD_PUBLIC_ORIGINS.
const publicOrigins = [
  process.env.NEXT_PUBLIC_SERVER_URL || '',
  ...(process.env.PAYLOAD_PUBLIC_ORIGINS || '').split(','),
]
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)
  .filter((origin, index, all) => all.indexOf(origin) === index)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    suppressHydrationWarning: true,
    components: {
      providers: ['@/components/admin/PuckProvider'],
    },
  },
  collections: [
    Users,
    Media,
    Products,
    Courses,
    CourseSections,
    Activities,
    Enrollments,
    Community,
    Tenants,
    BrandSettings,
  ],
  folders: {
    // payload-folders is generated during sanitization, after plugins run, so it
    // cannot be hardened by hardenPluginAccess. This is Payload's own hook for it.
    collectionOverrides: [hardenFolderAccess],
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Local dev shares the live Docker database — push mode silently mutates its
    // schema and caused the Feb 2026 drift. Schema changes go through migrations:
    // `npx payload migrate:create <name>` then let the container apply on boot.
    push: false,
  }),
  sharp,
  // Real SMTP when configured; otherwise Payload's default console/log adapter
  // (fine for dev — password resets print to the container log). Production
  // compose sets the SMTP_* vars, so email works without a code change.
  ...(process.env.SMTP_HOST
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@localhost',
          defaultFromName: process.env.EMAIL_FROM_NAME || 'Acme Commerce',
          transportOptions: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            ...(process.env.SMTP_USER
              ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
              : {}),
          },
        }),
      }
    : {}),
  plugins: [
    createPuckPlugin({
      pagesCollection: 'pages',
      // Staff only. `Boolean(req.user)` used to sit here, which meant every SSO
      // customer in the shared `users` collection could publish and delete pages.
      access: {
        read: publishedOrStaff('_status'),
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
      },
      // Puck editor preview iframe CSS, compiled at runtime via /api/puck/styles.
      // Requires postcss + postcss-load-config (plugin peer deps) and, in production,
      // postcss.config.mjs + this source file inside the image (see Dockerfile).
      // Delmare's build-time alternative (withPuckCSS/editorStylesheetCompiled) is
      // webpack-only and does nothing under Turbopack — do not wire it up.
      editorStylesheet: 'src/app/(frontend)/styles.css',
      ai: {
        enabled: true,
        promptsCollection: true,
        contextCollection: true,
        componentInstructions: {
          Scene3DBlock: { ai: { instructions: 'Use when the user requests 3D models, interactive product views, or scientific visualizations. Requires a GLTF/GLB URL.' } },
          ExternalFeedBlock: { ai: { instructions: 'Use when the user wants to embed a social media feed, community posts, or RSS content.' } },
          RemotionBlock: { ai: { instructions: 'Use when the user wants programmatic video content. Currently placeholder — only use if a composition is specified.' } },
          ProductCatalogBlock: { ai: { instructions: 'Use when the user wants to display a browsable product grid with filtering and add-to-cart.' } },
          ProductDetailBlock: { ai: { instructions: 'Use when the user wants a detailed single-product page with purchase flow.' } },
          CourseCatalogBlock: { ai: { instructions: 'Use when the user wants to display a browsable course grid with filtering by access level and enrollment buttons.' } },
          CourseDetailBlock: { ai: { instructions: 'Use when the user wants a detailed single-course page with section outline and enrollment flow.' } },
        }
      }
    }),
    pageTreePlugin({
      collections: ['pages'],
    }),
    /**
     * Official multi-tenancy. Runs AFTER the Puck plugin because `pages` is
     * created there and must exist before it can be tenant-enabled.
     *
     * Note on slugs: this plugin scopes data by tenant but does NOT scope field
     * uniqueness. `pages_slug_idx` is a UNIQUE index on `slug` alone (owned by the
     * Puck plugin's collection), so two brands cannot both hold a bare `about`.
     * Page slugs therefore stay prefixed with the tenant's page-tree folder
     * (`snm/about`), which the frontend resolver strips — see src/lib/tenants.ts.
     * The plugin gives the admin experience; the prefix satisfies the index.
     */
    multiTenantPlugin({
      collections: {
        pages: {},
        // Behaves like a global per tenant: no list view, just the settings for
        // whichever brand is selected. This is the fix for one shared logo.
        'brand-settings': { isGlobal: true },
        // DELIBERATELY NOT media. The architecture decision calls for media to be
        // tenant-scoped with an `isShared` flag, because Acme Commerce resells
        // Orbit and Vertex goods and needs their photography. Switching on
        // plain tenant filtering would hide every existing asset (they all
        // predate tenancy and carry no tenant) and give the wrong model besides.
        // Left shared until that flag is designed.
      },
      // the owner is the sole operator and administers every brand.
      userHasAccessToAllTenants: (user) => hasRole(user, 'admin'),
    }),
    // Must stay last: it hardens write access on collections the plugins above add.
    hardenPluginAccess,
  ],
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  cors: publicOrigins,
  csrf: publicOrigins,
  // Custom endpoints to fix payload-puck version restore bug
  // The VersionHistoryPanel POSTs to /versions but the plugin registers at /restore
  endpoints: [
    {
      path: '/puck/:collection/:id/versions',
      method: 'post',
      handler: async (req) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }
          // Restoring a version rewrites live page content. The `overrideAccess: false`
          // calls below would catch this anyway; failing here makes it an explicit 403
          // instead of a confusing downstream error.
          if (!hasRole(req.user, ...STAFF_ROLES)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 })
          }

          const { collection, id } = req.routeParams || {}
          const body = await req.json?.() || {}
          const { versionId } = body

          if (collection !== 'pages') {
            return Response.json({ error: 'Unsupported collection' }, { status: 404 })
          }

          if (!id || typeof versionId !== 'string') {
            return Response.json({ error: 'Missing id or versionId' }, { status: 400 })
          }

          // Restore the version by finding it and updating the document
          const version = await req.payload.findVersionByID({
            collection: 'pages',
            id: versionId,
            overrideAccess: false,
            req,
            user: req.user,
          })

          if (!version) {
            return Response.json({ error: 'Version not found' }, { status: 404 })
          }

          // Update the document with the version's data
          const updatedDoc = await req.payload.update({
            collection: 'pages',
            id: id as string,
            draft: true,
            overrideAccess: false,
            req,
            user: req.user,
            data: {
              puckData: migrateLegacyPuckData(version.version.puckData as never),
              title: version.version.title,
              _status: 'draft',
            },
          })

          return Response.json({ success: true, doc: updatedDoc })
        } catch (error) {
          console.error('[Version Restore] Error:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Restore failed' },
            { status: 500 }
          )
        }
      },
    },
  ],
  onInit: async (payload) => {
    const users = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (users.totalDocs === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: process.env.PAYLOAD_ADMIN_EMAIL || 'admin@example.com',
          password: process.env.PAYLOAD_ADMIN_PASSWORD || (() => { throw new Error('PAYLOAD_ADMIN_PASSWORD environment variable is required') })(),
          // The bootstrap account is the break-glass admin. Every other user
          // defaults to `customer` and must be promoted deliberately.
          roles: ['admin'],
        },
      })
    }
  },
})
