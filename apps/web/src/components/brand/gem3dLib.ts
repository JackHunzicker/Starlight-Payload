/**
 * Trillion-cut gem in the exact 5o crown net, built from the 2D drawing's
 * coordinates. Ported VERBATIM from the canonical
 * `Branding/Logo branding assets suite7/Orbit/3d-models/gem3d-lib.js`
 * (the authoritative geometry source per its README). Only change: typed
 * signatures for the TS build. Do not "improve" values here — the shader
 * spec and the geometry are the brand ruling.
 */

export function buildGem(THREE: any, opts: { cross?: string; crossScale?: number; flareScale?: number; flare?: boolean } = {}) {
  const V = [[200, 52.2], [336.76, 279], [63.24, 279]] // girdle vertices (2D, y-down)
  const C = [[314.08, 143.28], [200, 325.8], [85.92, 143.28]] // quadratic ctrl per side
  const CEN = [200, 199.8], K = 0.5832 // table scale (from 5o)
  const s = 0.016 / 273.52 // 16 mm across
  const q = (i: number, t: number) => {
    const a = V[i], c = C[i], b = V[(i + 1) % 3], u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
  }
  const tab = (p: number[]) => [CEN[0] + (p[0] - CEN[0]) * K, CEN[1] + (p[1] - CEN[1]) * K]
  // 12-node girdle ring: per side vertex, t=.25, .5, .75
  const G: number[][] = []
  for (let i = 0; i < 3; i++) G.push(V[i], q(i, 0.25), q(i, 0.5), q(i, 0.75))
  const T = V.map(tab), TM = [q(0, 0.5), q(1, 0.5), q(2, 0.5)].map(tab)
  // Knife-edge cut: mirrored crowns meet directly at a sharp girdle edge (no flat band).
  const crownH = 0.0022
  const yGB = 0, yGT = 0, yTab = crownH, yBot = -crownH
  const P = (p: number[], y: number) => [(p[0] - CEN[0]) * s, y, (p[1] - CEN[1]) * s]
  const center3 = [0, (yBot + yTab) / 2, 0]
  function tris(list: number[][][]) {
    const pos: number[] = []
    for (const tri of list) {
      const a = tri[0], b = tri[1], c = tri[2]
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
      const fc = [
        (a[0] + b[0] + c[0]) / 3 - center3[0],
        (a[1] + b[1] + c[1]) / 3 - center3[1],
        (a[2] + b[2] + c[2]) / 3 - center3[2],
      ]
      const out = n[0] * fc[0] + n[1] * fc[1] + n[2] * fc[2] >= 0
      const o = out ? [a, b, c] : [a, c, b]
      for (const p of o) pos.push(p[0], p[1], p[2])
    }
    return pos
  }
  const crown: number[][][] = [], table: number[][][] = [], back: number[][][] = []
  const face = (yGirdle: number, yTable: number, crownArr: number[][][], tableArr: number[][][]) => {
    for (let i = 0; i < 3; i++) {
      const v0 = P(G[i * 4], yGirdle), g1 = P(G[i * 4 + 1], yGirdle), g2 = P(G[i * 4 + 2], yGirdle), g3 = P(G[i * 4 + 3], yGirdle), v1 = P(G[(i * 4 + 4) % 12], yGirdle)
      const t0 = P(T[i], yTable), t1 = P(T[(i + 1) % 3], yTable), tm = P(TM[i], yTable)
      crownArr.push([v0, g1, t0], [t0, g1, g2], [t0, g2, tm], [tm, g2, t1], [g2, g3, t1], [g3, v1, t1])
    }
    const tc = [0, yTable, 0], ring6: number[][] = []
    for (let i = 0; i < 3; i++) ring6.push(P(T[i], yTable), P(TM[i], yTable))
    for (let i = 0; i < 6; i++) tableArr.push([tc, ring6[i], ring6[(i + 1) % 6]])
  }
  face(yGT, yTab, crown, table) // front face
  face(yGB, yBot, back, back) // mirrored back face (band + table share a mesh)
  function mesh(list: number[][][], name: string, mat: any) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris(list), 3))
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.name = name
    return m
  }
  const M = (name: string, color: number, o?: object) =>
    Object.assign(
      new THREE.MeshPhysicalMaterial({
        name, color, flatShading: true, metalness: 0.4, roughness: 0.02,
        transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, // see-through: back facets visible through front
        emissive: new THREE.Color(0x0d6275), emissiveIntensity: 0.18,
        clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1.5, envMapIntensity: 2.6,
      }),
      o || {},
    )
  const crownMat = M('crownFacets', 0x6fd8dc)
  const tableMat = M('tableFacet', 0x9ae9ec)
  const backMat = M('backFacets', 0x57c9d2)
  const gem = new THREE.Group()
  gem.name = 'trillionGem'
  gem.add(mesh(crown, 'crown', crownMat), mesh(table, 'table', tableMat), mesh(back, 'back', backMat))
  // The logo's exact light cross, as an inclusion.
  const mode = opts.cross || 'basic'
  let starMat: any
  if (mode === 'mirror') {
    starMat = new THREE.MeshPhysicalMaterial({ name: 'lightStarMat', color: 0xffffff, metalness: 1, roughness: 0.04, envMapIntensity: 3.4, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide })
  } else if (mode === 'holo') {
    starMat = new THREE.ShaderMaterial({
      name: 'lightStarMat', side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 wp = modelMatrix * vec4(position,1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV;
        void main(){ float d = abs(dot(normalize(vN), normalize(vV)));
          vec3 ir = 0.5 + 0.5 * cos(6.2832 * ((1.0 - d) * 1.45 + vec3(0.0, 0.33, 0.67)));
          vec3 col = mix(vec3(1.0), ir, 0.6) + pow(d, 10.0) * 0.55;
          gl_FragColor = vec4(col, 1.0); }`,
    })
  } else if (mode === 'glass') {
    starMat = new THREE.MeshPhysicalMaterial({ name: 'lightStarMat', color: 0xf2feff, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.6, emissive: 0xdffaff, emissiveIntensity: 0.85, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false })
  } else {
    starMat = new THREE.MeshBasicMaterial({ name: 'lightStarMat', color: 0xffffff, toneMapped: false, side: THREE.DoubleSide })
  }
  const e = 0.00035, C2 = [200, 186.12], KS = 0.78 * (opts.crossScale || 1)
  const SC = (p: number[]) => [C2[0] + (p[0] - C2[0]) * KS, C2[1] + (p[1] - C2[1]) * KS]
  const XY = (p: number[]) => [(p[0] - CEN[0]) * s, 0, (p[1] - CEN[1]) * s]
  const ARMS: [string, number[], number[], number[]][] = [
    ['crossArmUp', [200, 31.32], [207.74, 186.12], [192.26, 186.12]],
    ['crossArmDown', [200, 321.12], [192.26, 186.12], [207.74, 186.12]],
    ['crossArmLeft', [66, 186.12], [200, 180.02], [200, 192.22]],
    ['crossArmRight', [332, 186.12], [200, 192.22], [200, 180.02]],
  ]
  const star = new THREE.Group()
  star.name = 'lightStar'
  const corePos = new THREE.Vector3(XY(C2)[0], 0, XY(C2)[2])
  if (mode !== 'none')
    for (const [name, t2, b1, b2] of ARMS) {
      const T2 = XY(SC(t2)), B1 = XY(SC(b1)), B2 = XY(SC(b2)), BC = XY(C2)
      const F = [BC[0], e, BC[2]], Kp = [BC[0], -e, BC[2]]
      const pos: number[] = []
      for (const tri of [[T2, B1, F], [T2, F, B2], [T2, B2, Kp], [T2, Kp, B1]]) for (const p of tri) pos.push(p[0], p[1], p[2])
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      const m = new THREE.Mesh(g, starMat)
      m.name = name
      star.add(m)
    }
  if (mode !== 'none') {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(7.74 * KS * s, 7.74 * KS * s, 2 * e, 32), starMat)
    core.name = 'crossCore'
    core.position.copy(corePos)
    star.add(core)
  }
  // visible point of light: tiny additive flare sprite at the exact cross center
  const fc = document.createElement('canvas')
  fc.width = fc.height = 128
  const fx = fc.getContext('2d')!
  const fg = fx.createRadialGradient(64, 64, 0, 64, 64, 64)
  fg.addColorStop(0, 'rgba(255,255,255,1)')
  fg.addColorStop(0.14, 'rgba(255,255,255,1)')
  fg.addColorStop(0.38, 'rgba(224,250,255,0.6)')
  fg.addColorStop(1, 'rgba(223,250,255,0)')
  fx.fillStyle = fg
  fx.fillRect(0, 0, 128, 128)
  const flare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(fc), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, toneMapped: false,
    }),
  )
  flare.material.name = 'crossFlareMat'
  flare.name = 'crossFlare'
  flare.renderOrder = 9999 // draw after all transparent facets
  const fs = 0.0032 * (opts.flareScale || 1)
  flare.scale.set(fs, fs, 1)
  flare.position.copy(corePos)
  if (opts.flare !== false) star.add(flare)
  gem.add(star)
  gem.rotation.x = Math.PI / 2 // stand upright: apex up, flat face toward viewer
  const bb = new THREE.Box3().setFromObject(gem)
  gem.position.y = -bb.min.y // rest lowest point at y=0
  return gem
}

// Soft studio environment (bright cards around a dark void) so transmission
// and clearcoat have something to reflect — makes the gem read as transcommerce stone.
export function makeStudioEnv(THREE: any, renderer: any) {
  const es = new THREE.Scene()
  es.background = new THREE.Color('#0e1c22')
  const card = (w: number, h: number, x: number, y: number, z: number, intensity: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    es.add(m)
  }
  card(4, 2, -3, 4, 2, 16) // key
  card(3, 3, 4, 2, -1, 7) // fill
  card(6, 1.5, 0, -3, 3, 3.5) // floor bounce
  // ring of strip lights so every facet normal catches a glint
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    card(1.2, 4, 5 * Math.cos(a), ((i % 3) - 1) * 2.5, 5 * Math.sin(a), 2 + (i % 2) * 4)
  }
  const pm = new THREE.PMREMGenerator(renderer)
  const tex = pm.fromScene(es, 0.08).texture // crisp: sharp facet glints
  pm.dispose()
  return tex
}
