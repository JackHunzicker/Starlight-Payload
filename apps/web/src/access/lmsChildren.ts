import type { Access, PayloadRequest } from 'payload'
import { hasRole, STAFF_ROLES } from './index'

/**
 * Read access for the LMS child collections (course-sections, activities).
 *
 * The children carry no parent pointer — courses own the relationship
 * (courses.sections → course-sections.activities) — so `read: anyone` let any
 * anonymous REST/GraphQL query enumerate every section and activity, including
 * those belonging to draft or premium courses (the infra audit's LMS leak).
 *
 * Policy, derived per request from the owning courses:
 *   staff                → everything
 *   anonymous            → children of PUBLISHED + FREE courses
 *   authenticated user   → children of PUBLISHED courses that are FREE or that
 *                          the user holds an active/completed enrollment for
 *
 * Enforced at the data layer as an id-set constraint, so both list queries and
 * by-id reads obey it, and relationship population (course detail at depth)
 * filters identically. The player's enrollment UX is the deferred phase-2
 * half — this closes the leak regardless of what the player does.
 *
 * Scale note: this costs 1–3 small internal queries per non-staff read of the
 * child collections. Fine at launch scale (single-digit courses); revisit with
 * a request-scoped cache if the catalogue ever grows enough to matter.
 */

type CourseChildKind = 'sections' | 'activities'

const relationshipIds = (value: unknown): number[] =>
    Array.isArray(value)
        ? value
              .map((entry) =>
                  typeof entry === 'object' && entry !== null
                      ? (entry as { id?: unknown }).id
                      : entry,
              )
              .filter((id): id is number => typeof id === 'number')
        : []

const unique = (ids: number[]): number[] => [...new Set(ids)]

async function readableChildIds(req: PayloadRequest, kind: CourseChildKind): Promise<number[]> {
    // overrideAccess is deliberate on these internal lookups: this function IS
    // the access policy, and it must see draft/premium courses to exclude them.
    const published = await req.payload.find({
        collection: 'courses',
        where: { status: { equals: 'published' } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
    })

    let courses = published.docs
    if (!req.user) {
        courses = courses.filter((course) => (course.accessLevel ?? 'free') === 'free')
    } else {
        const enrollments = await req.payload.find({
            collection: 'enrollments',
            where: {
                and: [
                    { user: { equals: req.user.id } },
                    { status: { in: ['active', 'completed'] } },
                ],
            },
            depth: 0,
            pagination: false,
            overrideAccess: true,
        })
        const enrolledCourseIds = new Set(
            enrollments.docs.flatMap((enrollment) => relationshipIds([enrollment.course])),
        )
        courses = courses.filter(
            (course) =>
                (course.accessLevel ?? 'free') === 'free' || enrolledCourseIds.has(course.id),
        )
    }

    const sectionIds = unique(courses.flatMap((course) => relationshipIds(course.sections)))
    if (kind === 'sections') return sectionIds
    if (sectionIds.length === 0) return []

    const sections = await req.payload.find({
        collection: 'course-sections',
        where: { id: { in: sectionIds } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
    })
    return unique(sections.docs.flatMap((section) => relationshipIds(section.activities)))
}

export const courseChildrenRead =
    (kind: CourseChildKind): Access =>
    async ({ req }) => {
        if (hasRole(req.user, ...STAFF_ROLES)) return true
        const ids = await readableChildIds(req, kind)
        // No reachable children: refuse outright rather than emit `in: []`,
        // whose semantics vary by adapter. Nothing exists to see anyway.
        if (ids.length === 0) return false
        return { id: { in: ids } }
    }
