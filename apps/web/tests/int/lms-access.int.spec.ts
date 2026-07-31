import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

/**
 * Standing guard on the LMS child-collection leak (2026-07-29 infra audit).
 *
 * course-sections and activities shipped `read: anyone`, so a direct anonymous
 * REST/GraphQL query could enumerate every section and activity — including
 * children of draft and premium courses — regardless of what the player
 * rendered. Community had no publication gate at all.
 *
 * These tests exercise the real access functions through the local API with
 * overrideAccess: false, exactly as the REST layer does. Fixtures are
 * timestamped and deleted in afterAll (the int suite runs against the live
 * shared database).
 */

let payload: Payload
const stamp = Date.now()

type Ids = { [key: string]: number }
const ids: Ids = {}

let learner: { id: number; email: string; roles: string[]; collection: 'users' }

const anonRead = { overrideAccess: false as const, user: undefined }

beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const draftActivity = await payload.create({
        collection: 'activities',
        data: { title: `lms-guard draft activity ${stamp}`, mediaType: 'none' },
    })
    ids.draftActivity = draftActivity.id
    const draftSection = await payload.create({
        collection: 'course-sections',
        data: { title: `lms-guard draft section ${stamp}`, activities: [draftActivity.id] },
    })
    ids.draftSection = draftSection.id
    const draftCourse = await payload.create({
        collection: 'courses',
        data: {
            title: `lms-guard draft course ${stamp}`,
            slug: `lms-guard-draft-${stamp}`,
            status: 'draft',
            accessLevel: 'free',
            sections: [draftSection.id],
        },
    })
    ids.draftCourse = draftCourse.id

    const premiumActivity = await payload.create({
        collection: 'activities',
        data: { title: `lms-guard premium activity ${stamp}`, mediaType: 'none' },
    })
    ids.premiumActivity = premiumActivity.id
    const premiumSection = await payload.create({
        collection: 'course-sections',
        data: { title: `lms-guard premium section ${stamp}`, activities: [premiumActivity.id] },
    })
    ids.premiumSection = premiumSection.id
    const premiumCourse = await payload.create({
        collection: 'courses',
        data: {
            title: `lms-guard premium course ${stamp}`,
            slug: `lms-guard-premium-${stamp}`,
            status: 'published',
            accessLevel: 'premium',
            sections: [premiumSection.id],
        },
    })
    ids.premiumCourse = premiumCourse.id

    const freeActivity = await payload.create({
        collection: 'activities',
        data: { title: `lms-guard free activity ${stamp}`, mediaType: 'none' },
    })
    ids.freeActivity = freeActivity.id
    const freeSection = await payload.create({
        collection: 'course-sections',
        data: { title: `lms-guard free section ${stamp}`, activities: [freeActivity.id] },
    })
    ids.freeSection = freeSection.id
    const freeCourse = await payload.create({
        collection: 'courses',
        data: {
            title: `lms-guard free course ${stamp}`,
            slug: `lms-guard-free-${stamp}`,
            status: 'published',
            accessLevel: 'free',
            sections: [freeSection.id],
        },
    })
    ids.freeCourse = freeCourse.id

    const learnerDoc = await payload.create({
        collection: 'users',
        data: {
            email: `lms-guard-${stamp}@example.invalid`,
            password: `lms-guard-${stamp}-Aa1!`,
            roles: ['customer'],
        },
    })
    ids.learner = learnerDoc.id
    learner = {
        id: learnerDoc.id,
        email: learnerDoc.email,
        roles: ['customer'],
        collection: 'users',
    }

    const enrollment = await payload.create({
        collection: 'enrollments',
        data: {
            user: learnerDoc.id,
            course: premiumCourse.id,
            role: 'student',
            status: 'active',
        },
    })
    ids.enrollment = enrollment.id

    const publishedPost = await payload.create({
        collection: 'community',
        data: {
            title: `lms-guard published post ${stamp}`,
            publishedAt: new Date(Date.now() - 60_000).toISOString(),
        },
    })
    ids.publishedPost = publishedPost.id
    const unpublishedPost = await payload.create({
        collection: 'community',
        data: { title: `lms-guard unpublished post ${stamp}` },
    })
    ids.unpublishedPost = unpublishedPost.id
})

afterAll(async () => {
    const wipe = async (collection: string, id?: number) => {
        if (!id) return
        await payload.delete({ collection: collection as never, id }).catch(() => undefined)
    }
    await wipe('enrollments', ids.enrollment)
    await wipe('users', ids.learner)
    await wipe('courses', ids.draftCourse)
    await wipe('courses', ids.premiumCourse)
    await wipe('courses', ids.freeCourse)
    await wipe('course-sections', ids.draftSection)
    await wipe('course-sections', ids.premiumSection)
    await wipe('course-sections', ids.freeSection)
    await wipe('activities', ids.draftActivity)
    await wipe('activities', ids.premiumActivity)
    await wipe('activities', ids.freeActivity)
    await wipe('community', ids.publishedPost)
    await wipe('community', ids.unpublishedPost)
})

describe('LMS child access: anonymous', () => {
    it('cannot list sections or activities of draft or premium courses', async () => {
        const sections = await payload.find({
            collection: 'course-sections',
            where: { title: { contains: `lms-guard` } },
            pagination: false,
            ...anonRead,
        })
        const sectionIds = sections.docs.map((doc) => doc.id)
        expect(sectionIds).toContain(ids.freeSection)
        expect(sectionIds).not.toContain(ids.draftSection)
        expect(sectionIds).not.toContain(ids.premiumSection)

        const activities = await payload.find({
            collection: 'activities',
            where: { title: { contains: `lms-guard` } },
            pagination: false,
            ...anonRead,
        })
        const activityIds = activities.docs.map((doc) => doc.id)
        expect(activityIds).toContain(ids.freeActivity)
        expect(activityIds).not.toContain(ids.draftActivity)
        expect(activityIds).not.toContain(ids.premiumActivity)
    })

    it('cannot read a draft-course child by id', async () => {
        await expect(
            payload.findByID({ collection: 'course-sections', id: ids.draftSection, ...anonRead }),
        ).rejects.toThrow()
        await expect(
            payload.findByID({ collection: 'activities', id: ids.premiumActivity, ...anonRead }),
        ).rejects.toThrow()
    })

    it('can read a published free course child by id', async () => {
        const section = await payload.findByID({
            collection: 'course-sections',
            id: ids.freeSection,
            ...anonRead,
        })
        expect(section.id).toBe(ids.freeSection)
    })
})

describe('LMS child access: enrolled customer', () => {
    it('sees the enrolled premium children but never draft children', async () => {
        const sections = await payload.find({
            collection: 'course-sections',
            where: { title: { contains: `lms-guard` } },
            pagination: false,
            overrideAccess: false,
            user: learner as never,
        })
        const sectionIds = sections.docs.map((doc) => doc.id)
        expect(sectionIds).toContain(ids.freeSection)
        expect(sectionIds).toContain(ids.premiumSection)
        expect(sectionIds).not.toContain(ids.draftSection)

        const activity = await payload.findByID({
            collection: 'activities',
            id: ids.premiumActivity,
            overrideAccess: false,
            user: learner as never,
        })
        expect(activity.id).toBe(ids.premiumActivity)
    })

    it('a customer without enrollment is refused premium children', async () => {
        const stranger = { id: -1, email: 'stranger@example.invalid', roles: ['customer'], collection: 'users' }
        await expect(
            payload.findByID({
                collection: 'activities',
                id: ids.premiumActivity,
                overrideAccess: false,
                user: stranger as never,
            }),
        ).rejects.toThrow()
    })
})

describe('Community publication gate', () => {
    it('anonymous sees published posts only; unset publishedAt is a draft', async () => {
        const posts = await payload.find({
            collection: 'community',
            where: { title: { contains: `lms-guard` } },
            pagination: false,
            ...anonRead,
        })
        const postIds = posts.docs.map((doc) => doc.id)
        expect(postIds).toContain(ids.publishedPost)
        expect(postIds).not.toContain(ids.unpublishedPost)
    })
})
