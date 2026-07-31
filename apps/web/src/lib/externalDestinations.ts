/**
 * Editor-authored links that must resolve to a DIFFERENT service per
 * environment.
 *
 * The community instance lives on its own hostname (localhost:7777 in dev,
 * community.<domain> in production), so a stored absolute URL would be wrong
 * in one of them and a stored relative path (`/community`) silently
 * self-links back to the marketing page — which is exactly the bug this
 * fixes. Editors write the `{community}` token instead and it resolves here.
 *
 * Deliberately tiny and explicit: one token, documented in the block's field
 * description. NOT a templating language.
 */

const COMMUNITY_TOKEN = '{community}'

export function resolveDestination(href?: string | null): string {
  if (!href) return ''
  if (!href.startsWith(COMMUNITY_TOKEN)) return href
  const base = (process.env.NEXT_PUBLIC_COMMUNITY_URL || '').replace(/\/+$/, '')
  const rest = href.slice(COMMUNITY_TOKEN.length)
  // With no community URL configured, fall back to the marketing page rather
  // than emitting a broken `{community}` href.
  if (!base) return rest || '/community/'
  return `${base}${rest}`
}
