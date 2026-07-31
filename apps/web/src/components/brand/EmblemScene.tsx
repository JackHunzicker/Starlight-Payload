'use client'

import React from 'react'
import { buildGem, makeStudioEnv } from './gem3dLib'

/**
 * The 6i Orbit emblem — `bubble-3d-swap.html` ported into the app:
 * the full emblem (trillion gem + holographic cross + light point) inside the
 * soap-film shell, with the TEM-style 20 nm ruler pinned to the sphere's true
 * screen silhouette and the oleogel/nano-capsule callouts in the swapped
 * arrangement. Sources of truth: gem3dLib (geometry), SHADER-SPEC.txt (GLSL),
 * three-d-stage.js (stage: camera framing ×1.35, OrbitControls damping .08,
 * autorotate 1.2 until a real drag). three.js is self-hosted — no CDN.
 */

const R = 0.0165 // bubble radius; diameter labeled 20 nm
const INK = '#cfeef5'
const DIM = 'rgba(207,238,245,0.45)'

export default function OrbitEmblemScene({ background = '#0b1418' }: { background?: string }) {
    const hostRef = React.useRef<HTMLDivElement>(null)
    const svgRef = React.useRef<SVGSVGElement>(null)

    React.useEffect(() => {
        const host = hostRef.current
        const svg = svgRef.current
        if (!host || !svg) return
        let disposed = false
        let raf = 0
        let cleanup: (() => void) | undefined

        const mount = (THREE: any, controlsMod: any) => {
                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
                renderer.shadowMap.enabled = true
                renderer.shadowMap.type = THREE.PCFSoftShadowMap
                host.appendChild(renderer.domElement)
                renderer.domElement.style.display = 'block'

                const scene = new THREE.Scene()
                scene.background = new THREE.Color(background)
                scene.environment = makeStudioEnv(THREE, renderer)

                // Lights, per SHADER-SPEC §5.
                scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0))
                const key = new THREE.DirectionalLight(0xffffff, 2.2)
                key.position.set(4, 7, 5)
                key.castShadow = true
                key.shadow.mapSize.set(2048, 2048)
                key.shadow.bias = -0.0002
                scene.add(key)
                const warm = new THREE.DirectionalLight(0xfff4e6, 0.5)
                warm.position.set(-5, 3, -4)
                scene.add(warm)
                const ground = new THREE.Mesh(
                    new THREE.PlaneGeometry(200, 200),
                    new THREE.ShadowMaterial({ opacity: 0.18 }),
                )
                ground.rotation.x = -Math.PI / 2
                ground.receiveShadow = true
                scene.add(ground)

                // The emblem group, exactly as bubble-3d-swap assembles it.
                const group = new THREE.Group()
                group.name = 'orbitEmblem-holo'
                const gem = buildGem(THREE, { cross: 'holo', crossScale: 0.8, flareScale: 1 })
                const gb = new THREE.Box3().setFromObject(gem)
                gem.position.y += R - (gb.min.y + gb.max.y) / 2 // center gem in the bubble
                const shell = new THREE.Mesh(
                    new THREE.SphereGeometry(R, 96, 64),
                    new THREE.ShaderMaterial({
                        name: 'bubbleShell',
                        transparent: true,
                        depthWrite: false,
                        uniforms: {},
                        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
              void main(){ vec4 wp = modelMatrix * vec4(position,1.0);
                vN = normalize(mat3(modelMatrix) * normal);
                vV = normalize(cameraPosition - wp.xyz); vP = normalize(position);
                gl_Position = projectionMatrix * viewMatrix * wp; }`,
                        fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
              void main(){
                float d = abs(dot(normalize(vN), normalize(vV)));
                float rim = pow(1.0 - d, 4.0) * 0.6;
                float t = atan(vP.y, vP.x) * 0.32 + (1.0 - d) * 1.7;
                vec3 spec = 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67)));
                vec3 col = mix(vec3(1.0), spec, 0.55);
                float a = rim * 0.41 + 0.011;
                gl_FragColor = vec4(col, a); }`,
                    }),
                )
                shell.name = 'bubble'
                shell.position.y = R
                group.add(gem, shell)
                scene.add(group)

                // Camera framed like three-d-stage: bounding sphere × 1.35 along (1,.55,1.25).
                const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500)
                const bb = new THREE.Box3().setFromObject(group)
                const sphere = bb.getBoundingSphere(new THREE.Sphere())
                const dist = (sphere.radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.35
                const dir = new THREE.Vector3(1, 0.55, 1.25).normalize()
                camera.position.copy(sphere.center).addScaledVector(dir, dist)
                camera.lookAt(sphere.center)

                const controls = new controlsMod.OrbitControls(camera, renderer.domElement)
                controls.enableDamping = true
                controls.dampingFactor = 0.08
                controls.target.copy(sphere.center)
                controls.autoRotate = true
                controls.autoRotateSpeed = 1.2
                controls.domElement.addEventListener('pointerdown', () => {
                    controls.autoRotate = false
                })
                controls.update()

                const resize = () => {
                    const w = host.clientWidth
                    const h = host.clientHeight
                    if (!w || !h) return
                    renderer.setSize(w, h)
                    camera.aspect = w / h
                    camera.updateProjectionMatrix()
                }
                resize()
                const ro = new ResizeObserver(resize)
                ro.observe(host)

                // ---- sleek TEM-style nanometer ruler, pinned to the sphere's screen silhouette ----
                const flare = gem.getObjectByName('crossFlare')
                const draw = () => {
                    const w = host.clientWidth
                    const h = host.clientHeight
                    if (!w || !h) return
                    const k = Math.min(1, Math.max(0.55, h / 540))
                    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
                    const c3 = new THREE.Vector3(shell.position.x, shell.position.y, shell.position.z)
                    shell.getWorldPosition(c3)
                    const view = c3.clone().sub(camera.position)
                    const d = view.length()
                    view.normalize()
                    const limbC = c3.clone().addScaledVector(view, (-R * R) / d)
                    const limbR = R * Math.sqrt(Math.max(0, 1 - (R / d) * (R / d)))
                    const u = new THREE.Vector3(0, 1, 0).cross(view).normalize()
                    const v = view.clone().cross(u).normalize()
                    let minY = 1e9, maxY = -1e9, maxX = -1e9, topX = 0, botX = 0
                    const q = new THREE.Vector3()
                    for (let i = 0; i < 96; i++) {
                        const a = (i / 96) * Math.PI * 2
                        q.copy(limbC)
                            .addScaledVector(u, Math.cos(a) * limbR)
                            .addScaledVector(v, Math.sin(a) * limbR)
                            .project(camera)
                        const sx = (q.x * 0.5 + 0.5) * w
                        const sy = (-q.y * 0.5 + 0.5) * h
                        if (sy < minY) { minY = sy; topX = sx }
                        if (sy > maxY) { maxY = sy; botX = sx }
                        if (sx > maxX) maxX = sx
                    }
                    const y0 = minY, y1 = maxY, cy = (y0 + y1) / 2
                    const cx = (topX + botX) / 2, rPx = (y1 - y0) / 2
                    const x = Math.min(maxX + 46, w - 30)
                    let s = ''
                    const line = (xa: number, ya: number, xb: number, yb: number, st: string, sw: number) => {
                        s += `<line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" stroke="${st}" stroke-width="${sw}"/>`
                    }
                    line(x, y0, x, y1, INK, 1.2)
                    for (const [yy, sx] of [
                        [y0, topX],
                        [y1, botX],
                    ] as const) {
                        line(x - 7, yy, x + 7, yy, INK, 1.2)
                        s += `<line x1="${sx}" y1="${yy}" x2="${x - 10}" y2="${yy}" stroke="${DIM}" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>`
                    }
                    // ticks: 5 nm minors across 20 nm
                    for (let i = 1; i < 4; i++) {
                        const yy = y0 + ((y1 - y0) * i) / 4
                        line(x, yy, x + (i === 2 ? 5 : 3.5), yy, i === 2 ? INK : DIM, 1)
                    }
                    s += `<text x="${x + 30 * k}" y="${cy}" fill="${INK}" font-family="Inter,-apple-system,sans-serif" font-size="${18 * k}" font-weight="600" letter-spacing="${3 * k}" text-anchor="middle" transform="rotate(-90 ${x + 30 * k} ${cy})">20 nm</text>`
                    s += `<text x="${x + 51 * k}" y="${cy}" fill="${DIM}" font-family="Inter,-apple-system,sans-serif" font-size="${12 * k}" letter-spacing="${2.2 * k}" text-anchor="middle" transform="rotate(-90 ${x + 51 * k} ${cy})">NANOPARTICLE DIAMETER</text>`
                    // callouts: gem payload anchored at the light point, oleogel at the gem's top, capsule on the shell
                    const fp = new THREE.Vector3(0, R, 0)
                    if (flare) flare.getWorldPosition(fp)
                    const gemP = fp.project(camera)
                    const gx = (gemP.x * 0.5 + 0.5) * w, gy = (-gemP.y * 0.5 + 0.5) * h
                    const bbG = new THREE.Box3().setFromObject(gem)
                    const obc = bbG.getCenter(new THREE.Vector3())
                    const oPr = new THREE.Vector3(obc.x, bbG.max.y, obc.z).project(camera)
                    const ox = (oPr.x * 0.5 + 0.5) * w, oy = (-oPr.y * 0.5 + 0.5) * h
                    const shx = cx - rPx * 0.1392, shy = cy - rPx * 0.9903
                    const callout = (ax: number, ay: number, label: string, ly: number, dx = 0, mid = false) => {
                        const est = label.length * 9.8 * k + 20
                        const ex = Math.max(cx - rPx - 52, est + 20) + dx
                        const tx = ex - 8
                        const anchor = mid ? 'middle' : 'end', ax2 = mid ? ex : tx
                        s += `<line x1="${ax}" y1="${ay}" x2="${ex}" y2="${ly}" stroke="${DIM}" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>`
                        s += `<circle cx="${ax}" cy="${ay}" r="2.4" fill="${INK}"/>`
                        s += `<text x="${ax2}" y="${ly + 4.5}" fill="${INK}" font-family="Inter,-apple-system,sans-serif" font-size="${13 * k}" font-weight="600" letter-spacing="${1.6 * k}" text-anchor="${anchor}">${label}</text>`
                    }
                    const compact = h < 460
                    if (compact) {
                        const stacked = (ax: number, ay: number, label: string, ly: number, dx: number) => {
                            const est2 = label.length * 4.9 * k + 12
                            const lx = Math.min(Math.max(cx + dx, est2), w - est2)
                            const gap = ly < cy ? 7 : -12
                            s += `<line x1="${ax}" y1="${ay}" x2="${lx}" y2="${ly + gap}" stroke="${DIM}" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>`
                            s += `<circle cx="${ax}" cy="${ay}" r="2.2" fill="${INK}"/>`
                            s += `<text x="${lx}" y="${ly + 4}" fill="${INK}" font-family="Inter,-apple-system,sans-serif" font-size="${13 * k}" font-weight="600" letter-spacing="${1.6 * k}" text-anchor="middle">${label}</text>`
                        }
                        stacked(shx, shy, 'SURFACE-ENGINEERED NANO-CAPSULE', Math.max(y0 - 80, 12), rPx * 0.62)
                        stacked(gx, gy, 'ACTIVE PAYLOAD', Math.min(y1 + 26, h - 58), -rPx * 0.55 - 30)
                        stacked(ox, oy, 'CRYSTALLINE OLEOGEL MATRIX', Math.max(y0 - 50, 32), -rPx * 1.05)
                    } else {
                        callout(shx, shy, 'SURFACE-ENGINEERED NANO-CAPSULE', Math.max(cy - rPx * 1.08, 16 * k + 8) - 44 * k, rPx * 1.15, true)
                        callout(ox, oy, 'CRYSTALLINE OLEOGEL MATRIX', Math.max(cy - rPx * 1.08, 16 * k + 8))
                        callout(gx, gy, 'ACTIVE PAYLOAD', Math.min(cy + rPx * 0.85, h - 14))
                    }
                    svg.innerHTML = s
                }

                const loop = () => {
                    controls.update()
                    renderer.render(scene, camera)
                    draw()
                    raf = requestAnimationFrame(loop)
                }
                loop()

                cleanup = () => {
                    cancelAnimationFrame(raf)
                    ro.disconnect()
                    controls.dispose()
                    renderer.dispose()
                    renderer.domElement.remove()
                }
        }

        Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]).then(
            ([THREE, controlsMod]: [any, any]) => {
                if (disposed) return
                try {
                    mount(THREE, controlsMod)
                } catch {
                    // No WebGL (old browser, headless test DOM): the canonical
                    // reservation label underlay stays visible instead.
                }
            },
        )

        return () => {
            disposed = true
            cleanup?.()
        }
    }, [background])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <span
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: 'var(--tl-muted-foreground)',
                }}
            >
                3D crystalline-particle scene · reserved (WebGL)
            </span>
            <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
            <svg
                ref={svgRef}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
            />
        </div>
    )
}
