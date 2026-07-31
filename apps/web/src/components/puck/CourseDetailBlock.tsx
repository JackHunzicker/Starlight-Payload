'use client'
import React from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createDimensionsField,
    createMarginField,
    createPaddingField,
    createAnimationField,
} from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'
import Scene3DBlockRender from './Scene3DBlock'
import RemotionBlockRender from './RemotionBlock'
import { lexicalParagraphs } from './lexicalText'

interface CourseActivity {
    id: string | number
    title: string
    content?: unknown
    mediaType: 'gltf' | 'remotion' | 'none'
    gltfUrl?: string | null
    remotionComposition?: string | null
    order?: number
    duration?: number | null
}

const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0)

/** The activity player: renders whichever media the activity carries. */
function ActivityPlayer({ activity }: { activity: CourseActivity }) {
    return (
        <div data-testid="activity-player" className="mt-6 p-6 rounded-2xl border bg-card shadow-sm">
            <div className="flex items-baseline justify-between gap-4 mb-4">
                <h3 className="font-semibold text-lg">{activity.title}</h3>
                {activity.duration ? (
                    <span className="text-sm text-muted-foreground shrink-0">{activity.duration} min</span>
                ) : null}
            </div>
            {activity.mediaType === 'gltf' && activity.gltfUrl ? (
                <Scene3DBlockRender
                    visibility={null}
                    gltfUrl={activity.gltfUrl}
                    height={400}
                    environmentPreset="studio"
                />
            ) : activity.mediaType === 'remotion' && activity.remotionComposition ? (
                <RemotionBlockRender
                    visibility={null}
                    compositionName={activity.remotionComposition}
                    durationInFrames={150}
                    width={1280}
                    height={720}
                    fps={30}
                    showControls={true}
                />
            ) : null}
            {lexicalParagraphs(activity.content).map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed mt-4 first:mt-0">
                    {paragraph}
                </p>
            ))}
            {activity.mediaType === 'none' && lexicalParagraphs(activity.content).length === 0 ? (
                <p className="text-muted-foreground italic">This activity has no content yet.</p>
            ) : null}
        </div>
    )
}

interface CourseDetailBlockProps {
    visibility?: any
    courseId: string
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
}

// Custom Puck field: dynamic course selector dropdown
function CourseIdField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [courses, setCourses] = React.useState<{ id: string; title: string; status: string }[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        const fetchCourses = async () => {
            try {
                const res = await fetch('/api/courses/?limit=100&sort=-createdAt')
                const data = await res.json()
                setCourses(
                    (data.docs || []).map((c: any) => ({
                        id: String(c.id),
                        title: c.title,
                        status: c.status || 'draft',
                    }))
                )
            } catch (err) {
                console.error('Failed to load courses for selector:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchCourses()
    }, [])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--puck-color-grey-04, #666)' }}>
                Course
            </label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Select a course"
                style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--puck-color-grey-09, #ccc)',
                    background: 'var(--puck-color-white, #fff)',
                    fontSize: '14px',
                    width: '100%',
                }}
            >
                <option value="">{loading ? 'Loading courses...' : '— Select a course —'}</option>
                {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.title} (ID: {c.id}) [{c.status}]
                    </option>
                ))}
            </select>
        </div>
    )
}

function CourseDetailBlockRender({
    visibility,
    courseId,
    margin,
    dimensions,
    customPadding,
    animation,
}: CourseDetailBlockProps) {
    const [course, setCourse] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeActivity, setActiveActivity] = React.useState<CourseActivity | null>(null)
    const [enrollment, setEnrollment] = React.useState<{ progress: number } | null>(null)
    const [enrollBusy, setEnrollBusy] = React.useState(false)
    const [enrollNote, setEnrollNote] = React.useState<string | null>(null)
    const playerRef = React.useRef<HTMLDivElement | null>(null)

    const launchActivity = (activity: CourseActivity) => {
        setActiveActivity(activity)
        requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }

    // Enroll through the server route — Enrollments writes are staff-only by
    // design, so the route is the only sanctioned path (it checks eligibility
    // then writes with overrideAccess).
    const enroll = async () => {
        if (!courseId) return
        setEnrollBusy(true)
        setEnrollNote(null)
        try {
            const response = await fetch('/api/lms/enroll/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId: Number(courseId) }),
            })
            const body = await response.json()
            if (!response.ok) {
                setEnrollNote(body.error || 'Could not enroll.')
                return
            }
            setEnrollment({ progress: body.enrollment?.progress ?? 0 })
            setEnrollNote(body.existing ? 'You are already enrolled.' : 'Enrolled.')
        } catch {
            setEnrollNote('Could not enroll.')
        } finally {
            setEnrollBusy(false)
        }
    }

    const markComplete = async (activity: CourseActivity) => {
        try {
            const response = await fetch('/api/lms/complete/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activityId: Number(activity.id) }),
            })
            const body = await response.json()
            if (response.ok) setEnrollment({ progress: body.progress ?? 0 })
            else setEnrollNote(body.error || 'Could not save progress.')
        } catch {
            setEnrollNote('Could not save progress.')
        }
    }

    React.useEffect(() => {
        const fetchCourse = async () => {
            if (!courseId) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')

                const response = await fetch(`${baseUrl}/api/courses/${courseId}`)

                if (!response.ok) {
                    if (response.status === 404) throw new Error('Course not found')
                    throw new Error(`API Error: ${response.status}`)
                }

                const data = await response.json()
                setCourse(data)
            } catch (err) {
                // Log the detail for developers, but never render a raw upstream
                // error to visitors — those messages can carry hostnames,
                // connection strings and other internals. Every sibling block
                // already surfaces a generic message; this one did not.
                console.error('Failed to fetch course:', err)
                setError('Failed to load course details.')
            } finally {
                setLoading(false)
            }
        }

        fetchCourse()
    }, [courseId])


    if (!courseId) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-course-detail" animation={animation} className="course-detail-wrapper">
                <div className="course-detail-container flex items-center justify-center p-12 bg-muted text-muted-foreground border rounded-xl">
                    📚 Select a course from the sidebar to display course details
                </div>
            </BlockShell>
        )
    }

    if (loading) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-course-detail" animation={animation} className="course-detail-wrapper">
                <div className="course-detail-container flex items-center justify-center p-24 text-muted-foreground border rounded-xl">
                    Loading course material...
                </div>
            </BlockShell>
        )
    }

    if (error || !course) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-course-detail" animation={animation} className="course-detail-wrapper">
                <div className="course-detail-container flex items-center justify-center p-24 text-destructive border border-destructive/20 rounded-xl bg-destructive/5">
                    {error || 'Course not found'}
                </div>
            </BlockShell>
        )
    }

    const totalSections = course.sections?.length || 0

    return (
        <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-course-detail" animation={animation} className="course-detail-wrapper">
            <div className="course-detail-container max-w-5xl mx-auto py-12 px-6">

                {/* Course Header Banner */}
                <div className="relative rounded-3xl overflow-hidden bg-card/50 border shadow-md mb-12">
                    <div className="aspect-[21/9] bg-muted relative border-b">
                        {course.thumbnail?.url ? (
                            <img
                                src={course.thumbnail.url}
                                alt={course.title}
                                className="object-cover w-full h-full"
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-muted-foreground bg-secondary/30">
                                <span className="text-6xl alpha-50">🎓</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-8 md:p-12">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold uppercase tracking-wider mb-4">
                                {course.accessLevel} Access
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
                                {course.title}
                            </h1>
                            <div className="flex items-center gap-4 mt-6">
                                <span className="px-4 py-2 rounded-lg bg-card/80 border text-sm font-medium backdrop-blur-md">
                                    {totalSections} {totalSections === 1 ? 'Module' : 'Modules'}
                                </span>
                                <span className={`px-4 py-2 rounded-lg border text-sm font-bold backdrop-blur-md ${course.status === 'published' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                    {course.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Main Content Info */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        <section>
                            <h2 className="text-2xl font-bold mb-6">About this course</h2>
                            {lexicalParagraphs(course.description).length > 0 ? (
                                <div className="max-w-none text-muted-foreground space-y-4">
                                    {lexicalParagraphs(course.description).map((paragraph, index) => (
                                        <p key={index} className="leading-relaxed">
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic">No description provided.</p>
                            )}
                        </section>

                        <section className="mt-8">
                            <h2 className="text-2xl font-bold mb-6">Course Outline</h2>
                            {totalSections > 0 ? (
                                <div className="space-y-4">
                                    {[...course.sections].sort(byOrder).map((section: any, idx: number) => (
                                        <div key={section.id || idx} className="p-6 rounded-2xl border bg-card/50 shadow-sm flex items-start gap-4 hover:border-primary/50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{section.title || `Module ${idx + 1}`}</h3>
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                    {section.description || 'Learn module fundamentals and dive deep into specific concepts.'}
                                                </p>
                                                {Array.isArray(section.activities) && section.activities.length > 0 ? (
                                                    <ul className="mt-4 space-y-2">
                                                        {[...section.activities]
                                                            .filter((activity: any) => activity && typeof activity === 'object')
                                                            .sort(byOrder)
                                                            .map((activity: CourseActivity) => (
                                                                <li key={activity.id}>
                                                                    <button
                                                                        type="button"
                                                                        data-testid={`activity-${activity.id}`}
                                                                        onClick={() => launchActivity(activity)}
                                                                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-colors ${activeActivity?.id === activity.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50 bg-card'}`}
                                                                    >
                                                                        <span className="font-medium">{activity.title}</span>
                                                                        <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                                                            <span className="uppercase tracking-wider">
                                                                                {activity.mediaType === 'gltf'
                                                                                    ? '3D'
                                                                                    : activity.mediaType === 'remotion'
                                                                                      ? 'Video'
                                                                                      : 'Reading'}
                                                                            </span>
                                                                            {activity.duration ? <span>{activity.duration} min</span> : null}
                                                                        </span>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 border border-dashed rounded-2xl flex items-center justify-center text-muted-foreground bg-muted/30">
                                    Course material is currently being developed.
                                </div>
                            )}
                            <div ref={playerRef}>
                                {activeActivity ? (
                                    <>
                                        <ActivityPlayer activity={activeActivity} />
                                        {enrollment ? (
                                            <button
                                                type="button"
                                                data-testid="mark-complete"
                                                onClick={() => markComplete(activeActivity)}
                                                className="mt-4 rounded-xl border px-5 py-3 text-sm font-semibold hover:border-primary/50 transition-colors"
                                            >
                                                Mark complete
                                            </button>
                                        ) : null}
                                    </>
                                ) : null}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar action panel */}
                    <div className="flex flex-col gap-6">
                        <div className="p-6 rounded-3xl border bg-card shadow-lg sticky top-8">
                            <h3 className="font-bold text-xl mb-4">Enrollment</h3>
                            <button
                                type="button"
                                data-testid="start-learning"
                                onClick={() => {
                                    const first = [...(course.sections ?? [])]
                                        .sort(byOrder)
                                        .flatMap((section: any) => [...(section.activities ?? [])].filter((a: any) => a && typeof a === 'object').sort(byOrder))[0]
                                    if (first) launchActivity(first)
                                }}
                                className="w-full bg-primary text-primary-foreground px-6 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm text-lg"
                            >
                                Start Learning
                            </button>
                            <button
                                type="button"
                                data-testid="enroll"
                                onClick={enroll}
                                disabled={enrollBusy}
                                className="mt-3 w-full border px-6 py-3 rounded-xl font-semibold hover:border-primary/50 transition-colors disabled:opacity-60"
                            >
                                {enrollBusy ? 'Enrolling…' : enrollment ? 'Enrolled' : 'Enroll to track progress'}
                            </button>
                            {enrollment ? (
                                <div className="mt-4" data-testid="course-progress">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Progress</span>
                                        <span className="font-medium text-foreground">{enrollment.progress}%</span>
                                    </div>
                                    <div
                                        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                                        role="progressbar"
                                        aria-valuenow={enrollment.progress}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label="Course progress"
                                    >
                                        <div className="h-full bg-primary transition-all" style={{ width: `${enrollment.progress}%` }} />
                                    </div>
                                </div>
                            ) : null}
                            {enrollNote ? (
                                <p className="mt-3 text-xs text-center text-muted-foreground" role="status">{enrollNote}</p>
                            ) : null}
                            <p className="text-xs text-center text-muted-foreground mt-4">
                                Requires {course.accessLevel} tier access or higher.
                            </p>
                            <hr className="my-6 border-border" />
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex items-center justify-between">
                                    <span>Format</span>
                                    <span className="font-medium text-foreground">Self-paced</span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span>Modules</span>
                                    <span className="font-medium text-foreground">{totalSections}</span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span>Certificates</span>
                                    <span className="font-medium text-foreground">Yes</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </BlockShell>
    )
}

const defaultProps: CourseDetailBlockProps = {
    visibility: null,
    courseId: '',
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const CourseDetailBlockConfig: ComponentConfig<CourseDetailBlockProps> = {
    label: 'Course Detail',
    fields: {
        ...standardBlockFields({ defaultProps }),
        courseId: {
            type: 'custom',
            label: 'Course',
            render: ({ value, onChange }) => <CourseIdField value={value} onChange={onChange} />,
        },
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: CourseDetailBlockRender,
}

export default CourseDetailBlockRender
