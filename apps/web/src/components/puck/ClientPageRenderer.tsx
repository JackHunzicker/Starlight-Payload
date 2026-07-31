'use client'

/**
 * Client-side Puck Page Renderer
 *
 * Uses dynamic import with ssr:false to ensure the Puck Render
 * component only executes on the client, avoiding hydration issues
 * with interactive components like accordions.
 */

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'
import type { Data } from '@puckeditor/core'

// Dynamically import with ssr:false to prevent hydration mismatch
const ClientPageRendererInner = dynamic(
    () => import('./ClientPageRendererInner').then(mod => mod.ClientPageRendererInner),
    {
        ssr: false,
        loading: () => <div className="animate-pulse">Loading...</div>
    }
)

// One malformed block in puckData must not take down the whole route —
// without this boundary any render error becomes a full-page
// "Application error" screen.
class PuckRenderErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state: { error: Error | null } = { error: null }

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    componentDidCatch(error: Error) {
        console.error('[ClientPageRenderer] Puck content failed to render:', error)
    }

    render() {
        if (this.state.error) {
            return (
                <div className="container mx-auto px-4 py-24 text-center">
                    <h1 className="text-xl font-semibold text-foreground">This page could not be displayed</h1>
                    <p className="mt-2 text-muted-foreground">
                        The page content failed to render. Check the block data for this page in the Puck editor.
                    </p>
                </div>
            )
        }
        return this.props.children
    }
}

interface ClientPageRendererProps {
    data: Data
    className?: string
}

export function ClientPageRenderer({ data, className }: ClientPageRendererProps) {
    return (
        <PuckRenderErrorBoundary>
            <ClientPageRendererInner data={data} className={className} />
        </PuckRenderErrorBoundary>
    )
}
