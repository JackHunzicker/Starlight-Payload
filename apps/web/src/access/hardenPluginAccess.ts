import type { Config, Plugin } from 'payload'
import { isAdmin, isStaff } from './index'

/**
 * Collections created by plugins and by Payload core that ship with permissive
 * write access, and which we own the policy for.
 *
 * Verified against payload 3.86.0 and @delmaredigital/payload-puck on 2026-07-25:
 * all four use Payload's `defaultAccess` (`Boolean(user)`) or declare nothing,
 * which in a codebase where storefront customers share the `users` collection
 * means "any customer may write". Each is a real content surface:
 *
 *  - puck-ai-prompts / puck-ai-context — drive the page-building AI. Customer
 *    write access here is a prompt-injection vector into an authoring tool.
 *  - puck-templates — reusable page templates.
 *
 * `payload-folders` needs the same treatment but cannot be handled here: Payload
 * core creates it during config *sanitization*, after every plugin has run, so a
 * plugin never sees it. It is hardened through the documented
 * `folders.collectionOverrides` hook instead — see `hardenFolderAccess` below.
 */
const PLUGIN_COLLECTIONS_TO_HARDEN = [
  'puck-templates',
  'puck-ai-prompts',
  'puck-ai-context',
] as const

/**
 * Payload's own bookkeeping collections. Deliberately NOT hardened — Payload core
 * owns their semantics and overriding them breaks the Admin Panel:
 *
 *  - payload-preferences — per-user UI state. Reads/deletes are already scoped to
 *    `req.user.id`, and a `beforeValidate` hook forces the `user` field to the
 *    requester, so a user can only ever write their own row.
 *  - payload-locked-documents — document edit locks. Uses core `defaultAccess`.
 *    Worst case an authenticated user disturbs another editor's lock; it holds no
 *    content. Hardening it would break locking for any non-staff auth collection.
 *  - payload-migrations — written by the migration runner, not the HTTP API.
 *  - payload-jobs / payload-jobs-stats — queue internals, same reasoning.
 */
export const PAYLOAD_INTERNAL_COLLECTIONS = [
  'payload-preferences',
  'payload-locked-documents',
  'payload-migrations',
  'payload-jobs',
  'payload-jobs-stats',
] as const

/**
 * Applies staff-only writes to plugin-owned collections.
 *
 * Runs as the LAST plugin so it sees collections other plugins have added. Reads
 * are left alone: the goal is to stop unauthorized mutation, not to change what the
 * Admin Panel can display.
 */
export const hardenPluginAccess: Plugin = (config: Config): Config => {
  const collections = (config.collections ?? []).map((collection) => {
    if (!(PLUGIN_COLLECTIONS_TO_HARDEN as readonly string[]).includes(collection.slug)) {
      return collection
    }
    return {
      ...collection,
      access: {
        ...collection.access,
        create: isStaff,
        update: isStaff,
        delete: isAdmin,
      },
    }
  })

  return { ...config, collections }
}

/**
 * Staff-only writes on the `payload-folders` collection.
 *
 * Wired through `folders.collectionOverrides` in payload.config.ts, which is
 * Payload's documented hook for modifying the generated folder collection
 * ("An array of functions to be ran when the folder collection is initialized").
 * Payload ships it with core `defaultAccess` (`Boolean(user)`); folders are the
 * per-tenant boundary of the page tree, so customer writes must not reach them.
 *
 * Read is left as Payload set it — this changes who can mutate the tree, not who
 * can see it.
 */
export const hardenFolderAccess = <T extends { access?: Record<string, unknown> }>({
  collection,
}: {
  collection: T
}): T => ({
  ...collection,
  access: {
    ...collection.access,
    create: isStaff,
    update: isStaff,
    delete: isAdmin,
  },
})
