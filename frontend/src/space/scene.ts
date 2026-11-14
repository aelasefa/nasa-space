import * as THREE from 'three'
import gsap from 'gsap'

export type SceneMode = 'intro' | 'app'

export interface SpaceScene {
  setMode(mode: SceneMode): void
  warp(): Promise<void>
  dispose(): void
}

/* Deterministic randomness so the Moon looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Draw a feature three times so it tiles across the texture's longitude seam. */
function wrapped(width: number, draw: (dx: number) => void) {
  for (const dx of [-width, 0, width]) draw(dx)
}

function moonTexture() {
  const random = rng(7)
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#9aa1a6'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // Fine regolith grain.
  for (let i = 0; i < 26000; i++) {
    const shade = 120 + random() * 70
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 4},${0.05 + random() * 0.08})`
    ctx.fillRect(random() * 2048, random() * 1024, 2 + random() * 3, 2 + random() * 3)
  }
  // Dark maria.
  for (let i = 0; i < 22; i++) {
    const x = random() * 2048, y = 220 + random() * 560, r = 60 + random() * 190
    const rx = r * (1.2 + random()), turn = random() * Math.PI
    wrapped(2048, dx => {
      // Squash a soft circle into an ellipse so the edge stays feathered.
      ctx.setTransform(1, 0, 0, 1, x + dx, y)
      ctx.rotate(turn)
      ctx.scale(rx / r, 1)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      g.addColorStop(0, 'rgba(58,64,72,.5)')
      g.addColorStop(1, 'rgba(58,64,72,0)')
      ctx.fillStyle = g
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    })
  }
  // Highlands: broad, low-contrast albedo variation.
  for (let i = 0; i < 160; i++) {
    const x = random() * 2048, y = random() * 1024, r = 30 + random() * 120
    const light = random() < 0.5
    wrapped(2048, dx => {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r)
      g.addColorStop(0, light ? 'rgba(205,208,210,.10)' : 'rgba(70,76,84,.10)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2)
    })
  }
  // Craters: soft bowls with a faint lit rim; sizes follow a power law.
  for (let i = 0; i < 1400; i++) {
    const r = 1.5 + Math.pow(random(), 4) * 46
    const x = random() * 2048, y = 12 + random() * 1000
    // Widen craters toward the poles so they look round once wrapped on the sphere.
    const stretch = 1 / Math.max(0.12, Math.cos((y / 1024 - 0.5) * Math.PI))
    const rim = 0.06 + random() * 0.1
    wrapped(2048, dx => {
      ctx.setTransform(stretch, 0, 0, 1, x + dx, y)
      const bowl = ctx.createRadialGradient(r * 0.15, r * 0.15, 0, 0, 0, r)
      bowl.addColorStop(0, 'rgba(60,64,70,.28)')
      bowl.addColorStop(0.75, 'rgba(70,74,80,.18)')
      bowl.addColorStop(1, 'rgba(70,74,80,0)')
      ctx.fillStyle = bowl
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(222,224,226,${rim})`
      ctx.lineWidth = Math.max(0.6, r * 0.08)
      ctx.beginPath(); ctx.arc(0, 0, r * 0.92, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke()
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function earthTexture() {
  const random = rng(42)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#123a74'
  ctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = random() < 0.5 ? '#2f6b45' : '#7a6b46'
    ctx.beginPath()
    ctx.ellipse(random() * 512, 40 + random() * 176, 10 + random() * 40, 6 + random() * 24, random() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + random() * 0.4})`
    ctx.beginPath()
    ctx.ellipse(random() * 512, random() * 256, 12 + random() * 50, 2 + random() * 6, random() * 0.6 - 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function starSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

/** Soft Fresnel halo used for the Moon's limb and Earth's atmosphere. */
function halo(radius: number, color: string, power: number, strength: number) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 glow; uniform float power; uniform float strength; varying vec3 vNormal; varying vec3 vView;
        void main() { float f = pow(abs(dot(vNormal, vView)), power) * strength; gl_FragColor = vec4(glow, f); }`,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    }),
  )
}

function orbiter() {
  const craft = new THREE.Group()
  const foil = new THREE.MeshStandardMaterial({ color: '#d9a94e', metalness: 0.85, roughness: 0.32, emissive: '#3a2a08' })
  const panel = new THREE.MeshStandardMaterial({ color: '#1c3f8f', metalness: 0.4, roughness: 0.35, emissive: '#0b1a3d' })
  const white = new THREE.MeshStandardMaterial({ color: '#e8eef2', metalness: 0.2, roughness: 0.5 })
  craft.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), foil))
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.075), panel)
    wing.position.x = side * 0.15
    craft.add(wing)
  }
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.02, 24, 1, true), white)
  dish.position.y = 0.05
  craft.add(dish)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: '#b0e3d9' }))
  beacon.position.set(0, -0.045, 0.05)
  craft.add(beacon)
  return craft
}

const STARS = 2800
const DEPTH = 70
const SPREAD = 34

export function createSpaceScene(canvas: HTMLCanvasElement, initial: SceneMode, reduced: boolean): SpaceScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(0, 0, 6)

  // Starfield: points plus streaks that only appear at warp speed.
  const positions = new Float32Array(STARS * 3)
  const colors = new Float32Array(STARS * 3)
  const streak = new Float32Array(STARS * 6)
  const random = rng(1969)
  const palette = [new THREE.Color('#ffffff'), new THREE.Color('#bcd7ff'), new THREE.Color('#ffe6c4'), new THREE.Color('#b0e3d9')]
  for (let i = 0; i < STARS; i++) {
    positions[i * 3] = (random() - 0.5) * SPREAD * 2
    positions[i * 3 + 1] = (random() - 0.5) * SPREAD * 1.3
    positions[i * 3 + 2] = -random() * DEPTH + 6
    const c = palette[Math.floor(random() * palette.length)].clone().multiplyScalar(0.55 + random() * 0.45)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const sprite = starSprite()
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    size: 0.12, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  const streakGeometry = new THREE.BufferGeometry()
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streak, 3))
  const streakColors = new Float32Array(STARS * 6)
  for (let i = 0; i < STARS; i++) streakColors.set([...colors.subarray(i * 3, i * 3 + 3), 0, 0, 0], i * 6)
  streakGeometry.setAttribute('color', new THREE.BufferAttribute(streakColors, 3))
  const streakMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial)
  const field = new THREE.Group()
  field.add(stars, streaks)
  scene.add(field)

  // Light: a low sun gives the Moon a crisp terminator.
  const sun = new THREE.DirectionalLight('#fff4e6', 3.2)
  sun.position.set(-5, 2.2, 0.6)
  scene.add(sun, new THREE.AmbientLight('#4b6680', 0.12))

  // Moon system: Moon, limb glow, orbit ring and the LUNA-01 orbiter.
  const system = new THREE.Group()
  const lunarMap = moonTexture()
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1, 72, 72),
    new THREE.MeshStandardMaterial({ map: lunarMap, bumpMap: lunarMap, bumpScale: 1.1, roughness: 0.95, metalness: 0 }),
  )
  moon.rotation.x = -0.45 // south pole toward the viewer
  system.add(moon, halo(1.14, '#bcdcff', 2.4, 0.6))

  const orbitPlane = new THREE.Group()
  orbitPlane.rotation.set(1.2, 0.2, -0.38)
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 1.48, 1.48).getPoints(160).map(p => new THREE.Vector3(p.x, p.y, 0))),
    new THREE.LineDashedMaterial({ color: '#b0e3d9', transparent: true, opacity: 0.35, dashSize: 0.05, gapSize: 0.04 }),
  )
  ring.computeLineDistances()
  const craft = orbiter()
  orbitPlane.add(ring, craft)
  system.add(orbitPlane)
  scene.add(system)

  // Earth: a distant blue marble, where the science goes home.
  const earth = new THREE.Group()
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 64, 64), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.7 }))
  earth.add(earthMesh, halo(0.42, '#5fb4ff', 2.2, 1.5))
  scene.add(earth)

  // Animated state, tweened by GSAP.
  const state = { speed: reduced ? 0 : 0.9, fov: 45, mode: initial }
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let scrollSpin = 0

  function layout(mode: SceneMode, instant = false) {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    const h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(22.5))
    const w = h * aspect
    const narrow = aspect < 0.9
    const moonAt = mode === 'intro'
      ? (narrow ? { x: w * 0.18, y: -h / 2 + 0.55, z: 0, s: 1.15 } : { x: w / 2 - 1.05, y: -h * 0.1, z: 0, s: 1.45 })
      : (narrow ? { x: w * 1.4, y: -h * 1.1, z: -10, s: 2 } : { x: w * 1.2, y: -h * 0.85, z: -10, s: 2.4 })
    const earthAt = mode === 'intro'
      ? (narrow ? { x: -w * 0.7, y: h * 0.85, z: -6 } : { x: -w * 0.6, y: h * 0.42, z: -7 })
      : (narrow ? { x: -1.6, y: -3.2, z: -12 } : { x: -6.2, y: -2.6, z: -12 })
    const d = instant || reduced ? 0 : 2.2
    gsap.to(system.position, { x: moonAt.x, y: moonAt.y, z: moonAt.z, duration: d, ease: 'power3.inOut', overwrite: true })
    gsap.to(system.scale, { x: moonAt.s, y: moonAt.s, z: moonAt.s, duration: d, ease: 'power3.inOut', overwrite: true })
    gsap.to(earth.position, { ...earthAt, duration: d, ease: 'power3.inOut', overwrite: true })
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
    layout(state.mode, true)
  }
  resize()

  // Entrance: the Moon drifts in from below.
  if (!reduced) {
    gsap.from(system.position, { y: system.position.y - 3, duration: 3, ease: 'expo.out' })
    gsap.from(moon.rotation, { y: -1.4, duration: 4, ease: 'expo.out' })
  }

  const onPointer = (event: PointerEvent) => {
    pointer.tx = event.clientX / window.innerWidth - 0.5
    pointer.ty = event.clientY / window.innerHeight - 0.5
  }
  const onScroll = () => { scrollSpin = window.scrollY * 0.0009 }
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)

  const clock = new THREE.Clock()
  let angle = 0.6
  let frame = 0
  let lastRender = 0
  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    // The background barely moves behind the app screens: 30 fps is plenty there.
    const warping = state.speed > 1.5
    if (state.mode === 'app' && !warping && now - lastRender < 32) return
    lastRender = now
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    // Stars only fly at the camera during the jump; otherwise the field just drifts.
    // This skips rewriting 2,800 positions and re-uploading them on calm frames.
    streaks.visible = state.speed > 3
    if (warping) {
      const move = state.speed * dt * 4
      const tail = Math.min(state.speed * 0.09, 14)
      for (let i = 0; i < STARS; i++) {
        const k = i * 3
        positions[k + 2] += move
        if (positions[k + 2] > 6) positions[k + 2] -= DEPTH
        const s = i * 6
        streak[s] = streak[s + 3] = positions[k]
        streak[s + 1] = streak[s + 4] = positions[k + 1]
        streak[s + 2] = positions[k + 2]
        streak[s + 5] = positions[k + 2] - tail
      }
      starGeometry.attributes.position.needsUpdate = true
      if (streaks.visible) streakGeometry.attributes.position.needsUpdate = true
      streakMaterial.opacity = Math.min(1, Math.max(0, (state.speed - 3) / 25))
    }
    if (!reduced) field.rotation.z += dt * 0.012

    if (!reduced) {
      moon.rotation.y += dt * 0.04
      angle += dt * 0.32
      earthMesh.rotation.y += dt * 0.1
    }
    moon.rotation.x += (-0.45 + scrollSpin * 0.25 - moon.rotation.x) * 0.06
    system.rotation.y += (scrollSpin * 0.6 - system.rotation.y) * 0.05
    craft.position.set(Math.cos(angle) * 1.48, Math.sin(angle) * 1.48, 0)
    craft.rotation.z = angle + Math.PI / 2
    craft.rotation.x = Math.sin(t * 0.7) * 0.2

    // Gentle parallax with the pointer.
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    camera.position.x = pointer.x * 0.6
    camera.position.y = -pointer.y * 0.4
    camera.lookAt(0, 0, -2)
    if (camera.fov !== state.fov) { camera.fov = state.fov; camera.updateProjectionMatrix() }
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(tick)

  return {
    setMode(mode) {
      if (mode === state.mode) return
      state.mode = mode
      layout(mode)
      if (!reduced) gsap.to(state, { speed: mode === 'intro' ? 0.9 : 0.35, duration: 2, ease: 'power2.out', overwrite: 'auto' })
    },
    warp() {
      if (reduced) return Promise.resolve()
      return new Promise(resolve => {
        gsap.timeline({ onComplete: () => resolve() })
          .to(state, { speed: 140, fov: 68, duration: 1.05, ease: 'power3.in' })
          .to(state, { speed: 0.35, fov: 45, duration: 1.8, ease: 'power3.out', onStart: resolve })
      })
    },
    dispose() {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      gsap.killTweensOf([state, system.position, system.scale, earth.position, moon.rotation])
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        for (const m of Array.isArray(material) ? material : material ? [material] : []) m.dispose()
      })
      lunarMap.dispose()
      sprite.dispose()
      renderer.dispose()
    },
  }
}
