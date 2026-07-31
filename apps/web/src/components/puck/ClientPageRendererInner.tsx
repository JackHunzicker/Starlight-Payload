'use client'

/**
 * Client-side Puck Page Renderer (inner component)
 * 
 * This is the actual renderer that uses Puck's Render component.
 * It's dynamically imported with ssr:false to ensure it only renders on the client.
 * 
 * Uses the unified puckConfig which includes all custom components
 * and the fixed Accordion.
 */

import { Render } from '@puckeditor/core'
import type { Data } from '@puckeditor/core'
import { puckConfig } from './puckConfig'
import { migrateLegacyPuckData } from '@/lib/migrateLegacyPuckData'
import { useMemo } from 'react'

interface ClientPageRendererInnerProps {
    data: Data
    className?: string
}

export function ClientPageRendererInner({ data, className }: ClientPageRendererInnerProps) {
    const renderData = useMemo(() => migrateLegacyPuckData(data), [data])

    if (!data || !data.content) {
        return (
            <div className={className}>
                <p>No content available</p>
            </div>
        )
    }

    return (
        <div className={className}>
            <Render config={puckConfig} data={renderData} />
        </div>
    )
}
