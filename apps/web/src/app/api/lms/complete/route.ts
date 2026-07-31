import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const relationshipId = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/**
 * Marks one activity complete for the signed-in learner and recomputes
 * progress from the course's real activity count.
 *
 * Same posture as the enrollment route: Enrollments writes are staff-only, so
 * this route authenticates, verifies the learner owns the enrollment AND that
 * the activity actually belongs to that course, then writes with
 * `overrideAccess: true`. Without the ownership check a learner could mark
 * activities complete on someone else's enrollment.
 *
 * POST { activityId } → { progress, completed, total }
 */
export async function POST(request: Request) {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return Response.json({ error: 'Sign in to track progress.' }, { status: 401 })
  }

  let activityId: unknown
  try {
    activityId = (await request.json())?.activityId
  } catch {
    return Response.json({ error: 'Expected a JSON body with activityId.' }, { status: 400 })
  }
  const activityIdNumber = Number(activityId)
  if (!Number.isFinite(activityIdNumber)) {
    return Response.json({ error: 'activityId is required.' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // getCurrentUser resolved this from the Vendure customer id, which survives a
  // verified email change — an email lookup could fork the account in two.
  const user = sessionUser

  // Which course owns this activity? sections hold activities; courses hold
  // sections. depth: 0 keeps these as id lists.
  const sections = await payload.find({
    collection: 'course-sections',
    where: { activities: { in: [activityIdNumber] } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const sectionIds = sections.docs.map((section) => section.id)
  if (sectionIds.length === 0) {
    return Response.json({ error: 'Activity not found.' }, { status: 404 })
  }

  const courses = await payload.find({
    collection: 'courses',
    where: { sections: { in: sectionIds } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const course = courses.docs[0]
  if (!course) {
    return Response.json({ error: 'Activity not found.' }, { status: 404 })
  }

  const enrollments = await payload.find({
    collection: 'enrollments',
    where: { and: [{ user: { equals: user.id } }, { course: { equals: course.id } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const enrollment = enrollments.docs[0]
  if (!enrollment) {
    return Response.json({ error: 'Enroll in this course first.' }, { status: 403 })
  }

  const alreadyCompleted = (enrollment.completedActivities ?? [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
  const completed = alreadyCompleted.includes(activityIdNumber)
    ? alreadyCompleted
    : [...alreadyCompleted, activityIdNumber]

  // Total = every activity across the course's sections, so progress reflects
  // the real denominator rather than a stored guess.
  const courseSections = await payload.find({
    collection: 'course-sections',
    where: { id: { in: (course.sections ?? []).map(relationshipId).filter(Boolean) as number[] } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const allActivityIds = new Set(
    courseSections.docs.flatMap((section) =>
      (section.activities ?? []).map(relationshipId).filter((id): id is number => id !== null),
    ),
  )
  const total = allActivityIds.size
  const countedCompleted = completed.filter((id) => allActivityIds.has(id))
  const progress = total === 0 ? 0 : Math.round((countedCompleted.length / total) * 100)

  await payload.update({
    collection: 'enrollments',
    id: enrollment.id,
    data: {
      completedActivities: completed,
      progress,
      status: progress === 100 ? 'completed' : enrollment.status,
    },
    overrideAccess: true,
  })

  return Response.json({ progress, completed: countedCompleted.length, total })
}
