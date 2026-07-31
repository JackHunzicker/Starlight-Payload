'use client'

import { Suspense, memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import type { ComponentConfig } from '@puckeditor/core'
import {
    createDimensionsField,
    createMarginField,
    createPaddingField,
    createAnimationField,
} from '@delmaredigital/payload-puck/fields'
import { BlockShell } from './BlockShell'
import { standardBlockFields } from './blockKit'
import './puck-blocks.css'

// Keep this app's React 19 JSX namespace aware of React Three Fiber's custom
// elements. The augmentation bundled by R3F can be missed in pnpm workspaces
// when React type packages are resolved from different dependency branches.
/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-empty-object-type */
declare global {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements {}
    }
}

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements {}
    }
}
/* eslint-enable @typescript-eslint/no-namespace, @typescript-eslint/no-empty-object-type */

// Dynamic import for R3F to avoid SSR issues
const Canvas = dynamic(
    () => import('@react-three/fiber').then((mod) => mod.Canvas),
    { ssr: false }
)

const OrbitControls = dynamic(
    () => import('@react-three/drei').then((mod) => mod.OrbitControls),
    { ssr: false }
)

const Environment = dynamic(
    () => import('@react-three/drei').then((mod) => mod.Environment),
    { ssr: false }
)

// Model component - memoized to prevent reload
// IMPORTANT: Clone the scene for each instance to prevent Three.js parent stealing
const ModelLoader = memo(function ModelLoader({ url }: { url: string }) {
    const { scene } = useGLTF(url)
    // Clone the scene so each instance has its own copy
    // Without this, only the last-rendered instance would show the model
    const clonedScene = useMemo(() => scene.clone(), [scene])
    return <primitive object={clonedScene} />
})

// Environment wrapper that updates via key change only when necessary
const EnvironmentWrapper = memo(function EnvironmentWrapper({
    preset
}: {
    preset: string
}) {
    return <Environment preset={preset as any} />
}, (prev, next) => prev.preset === next.preset)

interface Scene3DBlockProps {
    visibility?: any
    gltfUrl: string
    height: number
    environmentPreset: 'studio' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'city'
    margin?: any
    dimensions?: any
    animation?: any
    customPadding?: any
}

/**
 * Memoized 3D Canvas that avoids unnecessary model reloads while its inputs
 * remain unchanged.
 */
const StableCanvas = memo(function StableCanvas({
    gltfUrl,
    environmentPreset,
}: {
    gltfUrl: string
    environmentPreset: string
}) {
    const cameraConfig = useMemo(() => ({
        position: [0, 0, 5] as [number, number, number],
        fov: 50
    }), [])

    return (
        <Canvas
            camera={cameraConfig}
            gl={{
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            }}
            // Prevent context loss
            onCreated={({ gl }) => {
                gl.domElement.addEventListener('webglcontextlost', (e) => {
                    e.preventDefault()
                    console.warn('WebGL context lost - will attempt recovery')
                })
            }}
        >
            <Suspense fallback={null}>
                <ModelLoader url={gltfUrl} />
                <EnvironmentWrapper preset={environmentPreset} />
            </Suspense>
            <ambientLight intensity={0.5} />
            <OrbitControls enableDamping dampingFactor={0.05} />
        </Canvas>
    )
}, (prev, next) => {
    // Only re-render if the URL changes (model needs to reload)
    // Environment changes are handled internally
    return prev.gltfUrl === next.gltfUrl && prev.environmentPreset === next.environmentPreset
})

function Scene3DBlockRender({ gltfUrl, height, environmentPreset, margin, dimensions, customPadding, animation, visibility }: Scene3DBlockProps) {
    // Every return path goes through BlockShell so sizing, spacing, visibility
    // and animation behave identically whether or not a model is set.
    const shellProps = {
        visibility,
        dimensions,
        margin,
        padding: customPadding,
        prefix: 'puck-scene3d',
        animation,
        className: 'scene3d-block-wrapper',
    }

    if (!gltfUrl) {
        return (
            <BlockShell {...shellProps}>
                <div className="scene3d-placeholder" style={{ height }}>
                    <span>🎨 Add GLTF/GLB URL to display 3D scene</span>
                </div>
            </BlockShell>
        )
    }

    return (
        <BlockShell {...shellProps}>
            <div
                className="scene3d-container"
                style={{
                    height,
                    pointerEvents: 'auto',
                    contain: 'layout style paint',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
            >
                <StableCanvas
                    gltfUrl={gltfUrl}
                    environmentPreset={environmentPreset}
                />
            </div>
        </BlockShell>
    )
}

const defaultProps: Scene3DBlockProps = {
    visibility: null,
    gltfUrl: '',
    height: 400,
    environmentPreset: 'studio',
    margin: null,
    dimensions: null,
    animation: null,
    customPadding: null,
}

export const Scene3DBlockConfig: ComponentConfig<Scene3DBlockProps> = {
    label: '3D Scene',
    fields: {
        ...standardBlockFields({ defaultProps }),
        gltfUrl: { type: 'text', label: 'GLTF/GLB URL' },
        height: { type: 'number', label: 'Height (px)' },
        environmentPreset: {
            type: 'select',
            label: 'Environment',
            options: [
                { label: 'Studio', value: 'studio' },
                { label: 'Sunset', value: 'sunset' },
                { label: 'Dawn', value: 'dawn' },
                { label: 'Night', value: 'night' },
                { label: 'Warehouse', value: 'warehouse' },
                { label: 'Forest', value: 'forest' },
                { label: 'City', value: 'city' },
            ],
        },
        // Styling — Image analogue (media block)
        dimensions: createDimensionsField({ label: 'Dimensions' }),
        animation: createAnimationField({ label: 'Animation' }),
        margin: createMarginField({ label: 'Margin' }),
        customPadding: createPaddingField({ label: 'Padding' }),
    },
    defaultProps,
    render: Scene3DBlockRender,
}

export default Scene3DBlockRender
