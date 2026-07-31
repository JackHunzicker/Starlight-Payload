'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createBackgroundField,
    createDimensionsField,
    createTransformField,
    createAnimationField,
    createMarginField,
    createPaddingField,
    backgroundValueToCSS,
    transformValueToCSS,
} from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'

interface ExternalFeedBlockProps {
    visibility?: any
    feedType: 'sharkey' | 'generic'
    apiUrl?: string
    limit: number
    refreshInterval: number
    background?: any
    dimensions?: any
    transform?: any
    animation?: any
    margin?: any
    customPadding?: any
}

interface BaseNote {
    id: string
    createdAt: string
    text: string | null
    cw?: string | null
    user: {
        id: string
        name: string | null
        username: string
        avatarUrl?: string | null
    }
    files?: Array<{
        id: string
        url: string
        type: string
        isSensitive: boolean
    }>
    replyCount?: number
    renoteCount?: number
    reactions?: Record<string, number>
}


/**
 * Sharkey serves avatars through its media proxy, but that proxy refuses
 * http:// sources ("unsupported protocol http:") and 500s on a local http
 * instance. The proxy URL carries the real file URL in its `url` parameter, and
 * the direct /files/ route serves fine, so unwrap it and point at the origin we
 * are already talking to. Non-proxy URLs pass through untouched.
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined, apiOrigin: string): string | null {
    if (!avatarUrl) return null
    if (!avatarUrl.includes('/proxy/')) return avatarUrl
    try {
        const inner = new URL(avatarUrl).searchParams.get('url')
        if (!inner) return avatarUrl
        const file = new URL(inner)
        const origin = new URL(apiOrigin)
        // Set hostname and port separately: assigning `.host` without a port
        // leaves the previous port in place (e.g. social.example.com:7777).
        file.protocol = origin.protocol
        file.hostname = origin.hostname
        file.port = origin.port
        return file.toString()
    } catch {
        return avatarUrl
    }
}

const defaultProps: ExternalFeedBlockProps = {
    visibility: null,
    feedType: 'sharkey',
    limit: 20,
    refreshInterval: 0,
    apiUrl: 'http://localhost:7777',
    background: null,
    dimensions: null,
    transform: null,
    animation: null,
    margin: null,
    customPadding: null,
}

export const ExternalFeedBlockConfig: ComponentConfig<ExternalFeedBlockProps> = {
    label: 'External Feed',
    fields: {
        ...standardBlockFields({ defaultProps }),
        feedType: {
            type: 'select',
            label: 'Feed Type',
            options: [
                { label: 'Sharkey / Misskey API', value: 'sharkey' },
                { label: 'Generic JSON (Future Support)', value: 'generic' },
            ]
        },
        apiUrl: { type: 'text', label: 'Feed API URL' },
        limit: { type: 'number', label: 'Item Limit', min: 1, max: 50 },
        refreshInterval: { type: 'number', label: 'Refresh Interval (seconds, 0 to disable)', min: 0 },
        background: createBackgroundField({ label: 'Background' }),
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        transform: createTransformField({ label: 'Transform' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: ExternalFeedBlockRender,
}

function ExternalFeedBlockRender({ visibility, feedType, limit, refreshInterval, apiUrl, margin, background, dimensions, transform, customPadding, animation }: ExternalFeedBlockProps) {
        const [notes, setNotes] = useState<BaseNote[]>([])
        // Avatar hosts can fail independently of the feed itself — Sharkey's media
        // proxy, for one, rejects http:// sources and returns 500 in local dev.
        // A failed avatar must degrade to initials, never a broken image.
        const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({})
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState<string | null>(null)

        // `fetchNotes` is a useCallback shared by the initial load and the refresh
        // interval, so cancellation lives in a ref rather than an effect-local
        // flag. Without it a request that settles after unmount calls setState on
        // a torn-down tree — React then throws "window is not defined".
        const mounted = useRef(true)
        useEffect(() => {
            mounted.current = true
            return () => {
                mounted.current = false
            }
        }, [])

        const fetchNotes = useCallback(async () => {
            try {
                const targetUrl = apiUrl || 'http://localhost:7777'

                if (feedType === 'sharkey') {
                    const response = await fetch(`${targetUrl}/api/notes/local-timeline`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ limit }),
                    })
                    if (!response.ok) throw new Error(`Sharkey API Error: ${response.status}`)
                    const data = await response.json()
                    if (!mounted.current) return
                    setNotes(data)
                } else {
                    const response = await fetch(targetUrl)
                    if (!response.ok) throw new Error(`Feed API Error: ${response.status}`)
                    const data = await response.json()
                    if (!mounted.current) return

                    if (Array.isArray(data)) {
                        setNotes(data.slice(0, limit).map((d: any, i: number) => ({
                            id: d.id || `${i}`,
                            createdAt: d.createdAt || d.date || new Date().toISOString(),
                            text: d.text || d.content || d.title || JSON.stringify(d),
                            user: {
                                id: d.userId || 'system',
                                username: d.author || 'System',
                                name: null
                            }
                        })))
                    }
                }

                if (!mounted.current) return
                setError(null)
            } catch (err) {
                if (!mounted.current) return
                console.error('Failed to fetch external feed:', err)
                setError('Failed to load external feed.')
            } finally {
                if (mounted.current) setLoading(false)
            }
        }, [apiUrl, feedType, limit])

        useEffect(() => {
            fetchNotes()
            if (refreshInterval && refreshInterval > 0) {
                const intervalId = setInterval(fetchNotes, refreshInterval * 1000)
                return () => clearInterval(intervalId)
            }
        }, [fetchNotes, refreshInterval])

        // Positioning layer (margin, dimensions, transform) via field helpers
        const wrapperStyle: React.CSSProperties = {}
        const transformCSS = transformValueToCSS(transform)
        if (transformCSS) Object.assign(wrapperStyle, transformCSS)

        // Background is a FLAT (non-responsive) field, so it is applied here on the
        // inner content layer. Padding is RESPONSIVE and is owned by BlockShell —
        // applying it here too would double it.
        const contentStyle: React.CSSProperties = {}
        const bgCSS = backgroundValueToCSS(background)
        if (bgCSS) Object.assign(contentStyle, bgCSS)

        if (loading && notes.length === 0) {
            return (
                <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-external-feed" animation={animation} style={wrapperStyle}>
                    <div className="flex items-center justify-center p-10 text-muted-foreground">
                        Loading external feed...
                    </div>
                </BlockShell>
            )
        }
        if (error && notes.length === 0) {
            return (
                <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-external-feed" animation={animation} style={wrapperStyle}>
                    <div className="flex items-center justify-center p-10 text-destructive">
                        {error}
                    </div>
                </BlockShell>
            )
        }

        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-external-feed" animation={animation} style={wrapperStyle}>
                <div className="flex flex-col gap-6 w-full" style={contentStyle}>
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            className="rounded-2xl border border-border bg-card/50 p-6 shadow-md backdrop-blur-xl"
                        >
                            {/* Note header: avatar + user info */}
                            <div className="mb-4 flex items-center">
                                {resolveAvatarUrl(note.user.avatarUrl, apiUrl || 'http://localhost:7777') && !brokenAvatars[note.user.id] ? (
                                    <img
                                        src={resolveAvatarUrl(note.user.avatarUrl, apiUrl || 'http://localhost:7777') as string}
                                        alt={note.user.username}
                                        onError={() => setBrokenAvatars(prev => ({ ...prev, [note.user.id]: true }))}
                                        className="h-12 w-12 shrink-0 rounded-full border-2 border-border object-cover"
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-semibold text-foreground">
                                        {note.user.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="ml-4">
                                    <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                                        {note.user.name || note.user.username}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        @{note.user.username} &middot; {new Date(note.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            {/* Content warning */}
                            {note.cw && (
                                <div className="mb-3 rounded border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-foreground">
                                    <strong>Content Warning:</strong> {note.cw}
                                </div>
                            )}

                            {/* Note body */}
                            <div className="mb-4 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground/90">
                                {note.text}
                            </div>

                            {/* Attachments */}
                            {note.files && note.files.length > 0 && (
                                <div
                                    className={`mb-4 grid gap-2 overflow-hidden rounded-xl ${
                                        note.files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                                    }`}
                                >
                                    {note.files.map((file) => (
                                        file.type.startsWith('image/') ? (
                                            <img
                                                key={file.id}
                                                src={file.url}
                                                alt="Attachment"
                                                className={`w-full max-h-[400px] rounded-lg object-cover ${
                                                    file.isSensitive ? 'blur-xl' : ''
                                                }`}
                                            />
                                        ) : null
                                    ))}
                                </div>
                            )}

                            {/* Engagement stats */}
                            {(note.replyCount !== undefined || note.renoteCount !== undefined || note.reactions) && (
                                <div className="flex flex-wrap gap-6 border-t border-border pt-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <span>💬</span> {note.replyCount || 0}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>🔁</span> {note.renoteCount || 0}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(note.reactions || {}).map(([emoji, count]) => (
                                            <span
                                                key={emoji}
                                                className="rounded-full bg-muted px-2 py-0.5 text-xs"
                                            >
                                                {emoji.replace('@.', '')} {count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </BlockShell>
        )
}

export default ExternalFeedBlockRender
