import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CourseDetailBlock from '@/components/puck/CourseDetailBlock'

export const dynamic = 'force-dynamic'

/**
 * `/courses/[slug]` — course detail.
 *
 * CourseCatalogBlock has always linked here (`/courses/${course.slug || course.id}`)
 * but the route did not exist, so every course card on the site was a dead link.
 *
 * The catalogue links by slug while CourseDetailBlock addresses courses by id, so
 * this route does the lookup. Access control is left to Payload: `overrideAccess`
 * stays false, and the Courses collection restricts anonymous reads to published
 * courses, so an unpublished slug 404s rather than leaking a draft.
 */
async function findCourse(slug: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const course = await findCourse(slug)
  if (!course) return { title: 'Course not found' }
  return {
    title: course.title,
    description: typeof course.description === 'string' ? course.description : undefined,
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await findCourse(slug)
  if (!course) notFound()

  return <CourseDetailBlock courseId={String(course.id)} />
}
