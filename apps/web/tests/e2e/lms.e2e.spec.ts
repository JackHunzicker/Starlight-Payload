import { test, expect } from '@playwright/test'

/**
 * LMS functional coverage against the seeded `lms-livetest` course
 * (`pnpm --filter web seed:test-course`): the course route renders modules
 * AND launchable activities of every mediaType — a real glTF in a live WebGL
 * canvas, a real Remotion composition, and rich text rendered as readable
 * paragraphs (never raw Lexical JSON). Skips when the fixture course is not
 * seeded rather than failing unrelated runs.
 */

const COURSE_PATH = '/courses/lms-livetest/'

test.describe('LMS: course with working activities', () => {
  test('activities of every media type launch on the course route', async ({ page, request }) => {
    const listed = await request.get('/api/courses/?where[slug][equals]=lms-livetest&limit=1')
    const course = (await listed.json()).docs?.[0]
    test.skip(!course, 'lms-livetest course not seeded (run seed:test-course)')

    const errors: string[] = []
    page.on('pageerror', e => {
      const text = String(e)
      if (!/WebGL context lost/i.test(text)) errors.push(text.split('\n')[0])
    })
    page.on('console', message => {
      const text = message.text()
      if (message.type() === 'error' && !/WebGL context lost|Failed to load resource/i.test(text)) {
        errors.push(text.slice(0, 120))
      }
    })

    await page.goto(COURSE_PATH, { waitUntil: 'networkidle' })
    await expect(page.getByText('LMS Livetest Course').first()).toBeVisible()
    await expect(page.getByText('2 Modules').first()).toBeVisible()

    // The description is Lexical richText — it must render as paragraphs,
    // never as serialized JSON (the pre-fix behavior).
    expect(await page.content()).not.toContain('"root"')

    // Start Learning launches the first activity: the glTF, in a REAL WebGL
    // canvas with non-zero drawing buffer.
    await page.getByTestId('start-learning').click()
    const player = page.getByTestId('activity-player')
    await expect(player).toBeVisible()
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>('[data-testid=activity-player] canvas')
            return canvas ? canvas.width > 0 && canvas.height > 0 : false
          }),
        { timeout: 20_000, message: 'gltf activity never produced a sized canvas' },
      )
      .toBe(true)

    // The Remotion activity renders its real composition.
    await page.getByText('Motion Explainer').first().click()
    await expect(page.getByTestId('remotion-title')).toBeVisible({ timeout: 15_000 })

    // The reading activity renders its rich text as paragraphs.
    await page.getByText('Reading: Particles 101').first().click()
    await expect(page.getByText('size and loading are the two numbers').first()).toBeVisible()

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('a draft course stays invisible to visitors', async ({ request }) => {
    // Anonymous course listings are exactly the published subset; the legacy
    // demo courses are drafts and must not leak through the API.
    const anonymous = await request.get('/api/courses/')
    const docs = (await anonymous.json()).docs ?? []
    for (const course of docs) {
      expect(course.status).toBe('published')
    }
  })
})
