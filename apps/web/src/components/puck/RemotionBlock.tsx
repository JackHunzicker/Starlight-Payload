'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createDimensionsField,
    createMarginField,
    createPaddingField,
    createAnimationField,
} from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'
import { REMOTION_COMPOSITION_OPTIONS, resolveComposition } from './remotionCompositions'
import './puck-blocks.css'

// Dynamic import for Remotion Player to avoid SSR issues
const Player = dynamic(
    () => import('@remotion/player').then((mod) => mod.Player),
    { ssr: false }
)

interface RemotionBlockProps {
    visibility?: any
    compositionName: string
    durationInFrames: number
    width: number
    height: number
    fps: number
    showControls: boolean
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
}

function RemotionBlockRender({
    visibility,
    compositionName,
    durationInFrames,
    width,
    height,
    fps,
    showControls,
    margin,
    dimensions,
    customPadding,
    animation,
}: RemotionBlockProps) {

    if (!compositionName) {
        return (
            <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-remotion" animation={animation} className="remotion-block-wrapper">
                <div className="remotion-empty" style={{ width, height }}>
                    <span>🎥 Add composition name to display video</span>
                </div>
            </BlockShell>
        )
    }

    return (
        <BlockShell visibility={visibility} dimensions={dimensions} margin={margin} padding={customPadding} prefix="puck-remotion" animation={animation} className="remotion-block-wrapper">
            <div className="remotion-container">
                <Player
                    component={resolveComposition(compositionName)}
                    durationInFrames={durationInFrames}
                    compositionWidth={width}
                    compositionHeight={height}
                    fps={fps}
                    controls={showControls}
                    style={{ width: '100%' }}
                />
            </div>
        </BlockShell>
    )
}

const defaultProps: RemotionBlockProps = {
    visibility: null,
    compositionName: '',
    durationInFrames: 120,
    width: 1920,
    height: 1080,
    fps: 30,
    showControls: true,
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const RemotionBlockConfig: ComponentConfig<RemotionBlockProps> = {
    label: 'Video Player',
    fields: {
        ...standardBlockFields({ defaultProps }),
        compositionName: {
            type: 'select',
            label: 'Composition',
            options: [{ label: 'None', value: '' }, ...REMOTION_COMPOSITION_OPTIONS],
        },
        durationInFrames: { type: 'number', label: 'Duration (frames)' },
        width: { type: 'number', label: 'Width (px)' },
        height: { type: 'number', label: 'Height (px)' },
        fps: { type: 'number', label: 'FPS' },
        showControls: {
            type: 'radio',
            label: 'Show Controls',
            options: [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
        },
        // Styling — Image analogue (media block)
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: RemotionBlockRender,
}

export default RemotionBlockRender
