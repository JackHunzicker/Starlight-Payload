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

interface CourseCatalogBlockProps {
    visibility?: any
    limit: number
    accessLevel?: 'all' | 'free' | 'subscriber' | 'premium'
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
}

function CourseCatalogBlockRender({
    visibility,
    limit,
    accessLevel,
    margin,
    dimensions,
    customPadding,
    animation,
}: CourseCatalogBlockProps) {
    const [courses, setCourses] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        // Guards against settling after unmount. Without it the fetch resolves
        // into a torn-down tree and React throws "window is not defined" — noisy
        // in tests, and a real leak when a visitor navigates mid-request.
        let cancelled = false

        const fetchCourses = async () => {
            try {
                setLoading(true)
                // Determine API base url (handles both client and server side absolute URL needs if possible, but defaults to relative on client)
                const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')

                let query = `?limit=${limit}&where[status][equals]=published`
                if (accessLevel && accessLevel !== 'all') {
                    query += `&where[accessLevel][equals]=${accessLevel}`
                }

                const response = await fetch(`${baseUrl}/api/courses${query}`)

                if (!response.ok) throw new Error(`API Error: ${response.status}`)
                const data = await response.json()

                if (cancelled) return
                setCourses(data.docs || [])
            } catch (err) {
                if (cancelled) return
                console.error('Failed to fetch courses:', err)
                setError('Failed to load courses.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchCourses()
        return () => {
            cancelled = true
        }
    }, [limit, accessLevel])


    return (
        <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-course-catalog" animation={animation} className="course-catalog-wrapper">
            <div className="course-catalog-container">
                {loading && courses.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-muted-foreground">
                        Loading courses...
                    </div>
                ) : error && courses.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-destructive">
                        {error}
                    </div>
                ) : courses.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-muted-foreground">
                        No courses found matching criteria.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {courses.map((course) => (
                            <a
                                key={course.id}
                                href={`/courses/${course.slug || course.id}`}
                                className="group rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col hover:border-primary hover:shadow-md transition-all duration-300"
                            >
                                <div className="aspect-video bg-muted relative overflow-hidden border-b">
                                    {course.thumbnail?.url ? (
                                        <img
                                            src={course.thumbnail.url}
                                            alt={course.title}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-muted-foreground bg-secondary/50">
                                            <span className="text-4xl text-muted-foreground/30" aria-hidden="true">📚</span>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border">
                                        {course.accessLevel}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="font-bold text-xl line-clamp-2 leading-tight">
                                        {course.title}
                                    </h3>
                                    <div className="mt-4 pt-4 border-t flex items-center justify-between mt-auto">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {course.sections?.length || 0} Modules
                                        </span>
                                        <span className="text-sm font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                            Enroll →
                                        </span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </BlockShell>
    )
}

const defaultProps: CourseCatalogBlockProps = {
    visibility: null,
    limit: 12,
    accessLevel: 'all',
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const CourseCatalogBlockConfig: ComponentConfig<CourseCatalogBlockProps> = {
    label: 'Course Catalog',
    fields: {
        ...standardBlockFields({ defaultProps }),
        limit: { type: 'number', label: 'Max Courses', min: 1, max: 100 },
        accessLevel: {
            type: 'select',
            label: 'Filter by Access Level',
            options: [
                { label: 'All Courses', value: 'all' },
                { label: 'Free Only', value: 'free' },
                { label: 'Subscriber Only', value: 'subscriber' },
                { label: 'Premium Only', value: 'premium' },
            ],
        },
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: CourseCatalogBlockRender,
}

export default CourseCatalogBlockRender
