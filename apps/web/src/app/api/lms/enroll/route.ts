import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Self-service enrollment.
 *
 * The Enrollments collection is deliberately staff-only for writes — a
 * client-side create would let anyone grant themselves any course. This route
 * is the sanctioned path: it authenticates the caller, decides eligibility
 * server-side, and only then writes with `overrideAccess: true`.
 *
 * Eligibility at MVP: published courses whose accessLevel is `free`.
 * Subscriber/premium tiers require an entitlement source that does not exist
 * yet (no subscription product), so they are refused with 403 rather than
 * quietly granted.
 *
 * POST { courseId } → 201 { enrollment } | 200 { enrollment, existing: true }
 */
export async function POST(request: Request) {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return Response.json({ error: 'Sign in to enroll.' }, { status: 401 })
  }

  let courseId: unknown
  try {
    courseId = (await request.json())?.courseId
  } catch {
    return Response.json({ error: 'Expected a JSON body with courseId.' }, { status: 400 })
  }
  const courseIdNumber = Number(courseId)
  if (!Number.isFinite(courseIdNumber)) {
    return Response.json({ error: 'courseId is required.' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // getCurrentUser resolved this from the Vendure customer id, which
  // survives a verified email change — an email lookup could fork the account.
  const user = sessionUser

  const course = await payload
    .findByID({ collection: 'courses', id: courseIdNumber, overrideAccess: true, depth: 0 })
    .catch(() => null)
  if (!course || course.status !== 'published') {
    // Do not distinguish "missing" from "unpublished" — that difference is
    // exactly the draft-enumeration signal the access work closed.
    return Response.json({ error: 'Course not found.' }, { status: 404 })
  }

  if ((course.accessLevel ?? 'free') !== 'free') {
    return Response.json(
      { error: 'This course requires a subscription. Contact us for access.' },
      { status: 403 },
    )
  }

  const existing = await payload.find({
    collection: 'enrollments',
    where: {
      and: [{ user: { equals: user.id } }, { course: { equals: courseIdNumber } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    return Response.json({ enrollment: existing.docs[0], existing: true })
  }

  const enrollment = await payload.create({
    collection: 'enrollments',
    data: {
      user: user.id,
      course: courseIdNumber,
      role: 'student',
      status: 'active',
      progress: 0,
    },
    overrideAccess: true,
  })

  return Response.json({ enrollment }, { status: 201 })
}
