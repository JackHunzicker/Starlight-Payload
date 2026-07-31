/**
 * Seeds the LMS livetest fixture (the owner ruling 2026-07-29: a REAL test course
 * with WORKING activities, functionally verified — placeholders are not an
 * implementation):
 *
 *   - uploads the repo's triangle.gltf fixture into Media (a real, served
 *     model URL — the e2e fixture was previously only ever request-intercepted),
 *   - creates three activities covering every mediaType (gltf / remotion /
 *     none-with-content),
 *   - two ordered sections, and the PUBLISHED course `lms-livetest`
 *     (published is what makes it anonymously readable),
 *   - and the DRAFT Puck page `tlr/livetest-lms` carrying CourseCatalogBlock +
 *     CourseDetailBlock wired to the course.
 *
 * REST-only against a RUNNING server (never local getPayload):
 *   pnpm --filter web seed:test-course
 * Env: SEED_BASE_URL (default http://localhost:7773),
 *      PAYLOAD_ADMIN_EMAIL, PAYLOAD_ADMIN_PASSWORD.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.SEED_BASE_URL || 'http://localhost:7773'
const EMAIL = process.env.PAYLOAD_ADMIN_EMAIL
const PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD

const COURSE_SLUG = 'lms-livetest'
const PAGE_SLUG = 'tlr/livetest-lms'

type Json = Record<string, any>

const paragraph = (text: string) => ({
    root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
            {
                type: 'paragraph',
                version: 1,
                format: '',
                indent: 0,
                direction: 'ltr',
                children: [{ type: 'text', text, version: 1, format: 0, style: '', mode: 'normal', detail: 0 }],
            },
        ],
    },
})

async function main() {
    if (!EMAIL || !PASSWORD) throw new Error('PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD are required')

    const login = await fetch(`${BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const { token } = (await login.json()) as Json
    if (!token) throw new Error('Payload admin login failed')
    const auth = { Authorization: `JWT ${token}` }

    const api = async (path: string, init: RequestInit = {}): Promise<Json> => {
        const response = await fetch(`${BASE}/api${path}`, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...auth, ...(init.headers ?? {}) },
        })
        const body = (await response.json()) as Json
        if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body).slice(0, 300)}`)
        return body
    }

    const upsert = async (collection: string, where: string, data: Json): Promise<Json> => {
        const found = await api(`/${collection}?where${where}&limit=1`)
        const existing = found.docs?.[0]
        if (existing) {
            const updated = await api(`/${collection}/${existing.id}`, { method: 'PATCH', body: JSON.stringify(data) })
            return updated.doc ?? updated
        }
        const created = await api(`/${collection}`, { method: 'POST', body: JSON.stringify(data) })
        return created.doc ?? created
    }

    // --- 1. A REAL served glTF: upload the test fixture into Media ----------
    const gltfAlt = 'LMS livetest glTF model (triangle fixture)'
    const existingModel = await api(`/media?where[alt][equals]=${encodeURIComponent(gltfAlt)}&limit=1`)
    let modelUrl: string = existingModel.docs?.[0]?.url
    if (!modelUrl) {
        // Node fetch streams FormData chunked, which busboy rejects with
        // "Unexpected end of form" — build the multipart body as one Buffer so
        // Content-Length is known.
        const bytes = readFileSync(join(process.cwd(), 'tests/fixtures/triangle.gltf'))
        const boundary = `----lmslivetest${Math.random().toString(36).slice(2)}`
        const multipart = Buffer.concat([
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="lms-livetest-triangle.gltf"\r\nContent-Type: model/gltf+json\r\n\r\n`,
            ),
            bytes,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="_payload"\r\n\r\n${JSON.stringify({ alt: gltfAlt })}\r\n--${boundary}--\r\n`),
        ])
        const uploaded = await fetch(`${BASE}/api/media/`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: multipart,
        }).catch((error) => {
            // Node-version-dependent undici multipart quirks land here. The
            // upload is idempotent — do it once with curl and re-run:
            //   curl -sL -X POST $BASE/api/media/ -H "Authorization: JWT <token>" \
            //     -F 'file=@tests/fixtures/triangle.gltf;type=model/gltf+json;filename=lms-livetest-triangle.gltf' \
            //     -F '_payload={"alt":"LMS livetest glTF model (triangle fixture)"}'
            throw new Error(`media upload failed (${String(error)}) — see the curl fallback in seed-test-course.ts`)
        })
        const body = (await uploaded.json()) as Json
        if (!uploaded.ok) throw new Error(`media upload -> ${uploaded.status}: ${JSON.stringify(body).slice(0, 300)}`)
        modelUrl = body.doc?.url
        console.log(`uploaded model -> ${modelUrl}`)
    }
    if (!modelUrl) throw new Error('no model URL after upload')
    // Store a RELATIVE path: Payload returns an absolute URL built from the
    // current serverURL, and persisting http://localhost:7773/... would break
    // the moment the site serves from a real domain.
    modelUrl = modelUrl.replace(/^https?:\/\/[^/]+/, '')

    // --- 2. Activities: one of every mediaType ------------------------------
    const activityGltf = await upsert('activities', `[title][equals]=${encodeURIComponent('3D Model Walkthrough')}`, {
        title: '3D Model Walkthrough',
        mediaType: 'gltf',
        gltfUrl: modelUrl,
        content: paragraph('Rotate and inspect the reference geometry. A production course loads a real product model here.'),
        order: 1,
        duration: 10,
    })
    const activityRemotion = await upsert('activities', `[title][equals]=${encodeURIComponent('Motion Explainer')}`, {
        title: 'Motion Explainer',
        mediaType: 'remotion',
        remotionComposition: 'title-reveal',
        content: paragraph('A rendered motion sequence introduces the module.'),
        order: 2,
        duration: 5,
    })
    const activityReading = await upsert('activities', `[title][equals]=${encodeURIComponent('Reading: Particles 101')}`, {
        title: 'Reading: Particles 101',
        mediaType: 'none',
        content: paragraph(
            'Particle carriers make hydrophobic compounds usable by the body. This reading covers why size and loading are the two numbers that matter.',
        ),
        order: 3,
        duration: 5,
    })
    console.log(`activities ready: ${activityGltf.id}, ${activityRemotion.id}, ${activityReading.id}`)

    // --- 3. Sections --------------------------------------------------------
    const sectionOne = await upsert('course-sections', `[title][equals]=${encodeURIComponent('LMS Livetest Module 1: Media')}`, {
        title: 'LMS Livetest Module 1: Media',
        description: 'One activity of every media type the platform supports.',
        order: 1,
        activities: [activityGltf.id, activityRemotion.id],
    })
    const sectionTwo = await upsert('course-sections', `[title][equals]=${encodeURIComponent('LMS Livetest Module 2: Theory')}`, {
        title: 'LMS Livetest Module 2: Theory',
        description: 'Reading material rendered from rich text.',
        order: 2,
        activities: [activityReading.id],
    })
    console.log(`sections ready: ${sectionOne.id}, ${sectionTwo.id}`)

    // --- 4. The published course -------------------------------------------
    // Thumbnail comes from the CURRENT branding suite (the Feb-era Media
    // uploads are flagged DEPRECATED in their alt text — never reuse them).
    // Upload once from the internal branding folder if missing:
    //   Orbit/assets/seals/png/emblem-microtext-dark-2048.png
    //   alt: "Orbit emblem — current branding suite (dark, 2048px)"
    const thumbAlt = 'Orbit emblem — current branding suite (dark, 2048px)'
    const thumb = await api(`/media?where[alt][equals]=${encodeURIComponent(thumbAlt)}&limit=1`)
    const thumbnailId = thumb.docs?.[0]?.id
    if (!thumbnailId) throw new Error(`branding-suite thumbnail not in Media (alt: "${thumbAlt}") — upload it first`)

    const course = await upsert('courses', `[slug][equals]=${COURSE_SLUG}`, {
        title: 'LMS Livetest Course',
        slug: COURSE_SLUG,
        description: paragraph(
            'A functional test course: every activity type is real and launchable. Verifies the LMS end to end before real course material lands.',
        ),
        thumbnail: thumbnailId,
        sections: [sectionOne.id, sectionTwo.id],
        accessLevel: 'free',
        status: 'published',
    })
    console.log(`course ready: id=${course.id} slug=${course.slug} status=${course.status}`)

    // --- 5. The DRAFT livetest page ----------------------------------------
    const tenants = await api(`/tenants?where[code][equals]=tlr&limit=1`)
    const folders = await api(`/payload-folders?where[name][equals]=tlr&limit=1`)
    const puckData = {
        root: {
            props: {
                slug: PAGE_SLUG,
                title: 'Livetest LMS',
                folder: null,
                noindex: true,
                nofollow: true,
                metaTitle: 'LIVETEST — LMS functional test page',
                metaDescription: 'Unpublished test page: course catalogue + detail with working activities.',
                isHomepage: false,
                pageLayout: 'default',
                showHeader: 'hide',
                showFooter: 'hide',
                pageSegment: null,
                pageMaxWidth: 'default',
                conversionType: null,
                pageBackground: null,
                conversionValue: 0,
                isConversionPage: false,
                excludeFromSitemap: true,
            },
        },
        content: [
            { type: 'SiteHeaderBlock', props: { id: 'lt-lms-header', visibility: null, brand: 'tlr', hasCommerce: 'yes' } },
            { type: 'CourseCatalogBlock', props: { id: 'lt-lms-catalog', visibility: null, limit: 12, accessLevel: 'all', margin: null, dimensions: null, animation: null, customPadding: null } },
            { type: 'CourseDetailBlock', props: { id: 'lt-lms-detail', visibility: null, courseId: String(course.id), margin: null, dimensions: null, animation: null, customPadding: null } },
            { type: 'SiteFooterBlock', props: { id: 'lt-lms-footer', visibility: null, brand: 'tlr' } },
        ],
    }
    const existingPage = await api(`/pages?where[slug][equals]=${encodeURIComponent(PAGE_SLUG)}&draft=true&limit=1`)
    const pageDoc = existingPage.docs?.[0]
    let page: Json
    if (pageDoc) {
        const updated = await api(`/pages/${pageDoc.id}?draft=true`, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Livetest LMS', puckData, _status: 'draft' }),
        })
        page = updated.doc ?? updated
    } else {
        const created = await api(`/pages?draft=true`, {
            method: 'POST',
            body: JSON.stringify({
                title: 'Livetest LMS',
                pageSegment: 'livetest-lms',
                folder: folders.docs?.[0]?.id,
                tenant: tenants.docs?.[0]?.id,
                puckData,
                editorVersion: 'puck',
                _status: 'draft',
            }),
        })
        page = created.doc ?? created
    }
    if (page.slug !== PAGE_SLUG) throw new Error(`page slug mismatch: ${page.slug}`)
    console.log(`page ready: id=${page.id} slug=${page.slug} (draft)  editor: ${BASE}/admin/puck-editor/pages/${page.id}/`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
