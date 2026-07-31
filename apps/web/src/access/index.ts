import type { Access, FieldAccess } from 'payload'

/**
 * Role-based access control.
 *
 * Why this exists: `users` is a single `auth: true` collection shared by CMS staff
 * and public SSO customers (see `src/auth.ts` — the Authentik signIn callback creates
 * a Payload user on first login). Before roles, "authenticated" was the only gate, so
 * every customer who ever signed in could create, publish and delete any page, course
 * or enrollment. Authentication is not authorization — these helpers are the boundary.
 */

export type Role = 'admin' | 'editor' | 'customer'

/** Staff roles — everything except `customer`. Kept in one place so it stays honest. */
export const STAFF_ROLES: Role[] = ['admin', 'editor']

type MaybeUser = { roles?: unknown } | null | undefined

/**
 * True when `user` holds at least one of `roles`.
 *
 * Defensive by design: a user document predating the roles field, or one whose roles
 * failed to load, has no roles and therefore no permissions. Absence never grants.
 */
export const hasRole = (user: MaybeUser, ...roles: Role[]): boolean => {
  if (!user) return false
  const held = (user as { roles?: unknown }).roles
  if (!Array.isArray(held)) return false
  return roles.some((role) => held.includes(role))
}

export const isAdmin: Access = ({ req }) => hasRole(req.user, 'admin')

export const isStaff: Access = ({ req }) => hasRole(req.user, ...STAFF_ROLES)

/** Field-level variants. Payload types these separately from collection access. */
export const isAdminField: FieldAccess = ({ req }) => hasRole(req.user, 'admin')

export const isStaffField: FieldAccess = ({ req }) => hasRole(req.user, ...STAFF_ROLES)

export const anyone: Access = () => true

/**
 * Public reads see published documents only; staff see everything.
 *
 * Returns a Payload query constraint rather than `false` for anonymous users, so
 * drafts stay invisible without turning the whole collection into a 403.
 */
export const publishedOrStaff =
  (statusField = '_status'): Access =>
  ({ req }) => {
    if (hasRole(req.user, ...STAFF_ROLES)) return true
    return { [statusField]: { equals: 'published' } }
  }

/**
 * A signed-in user may reach their own document; staff may reach any.
 * Used for `users` (self-service profile) and `enrollments` (own progress).
 */
export const isSelfOrStaff =
  (userField = 'id'): Access =>
  ({ req }) => {
    if (hasRole(req.user, ...STAFF_ROLES)) return true
    if (!req.user) return false
    return { [userField]: { equals: req.user.id } }
  }
