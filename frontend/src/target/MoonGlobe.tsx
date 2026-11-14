import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { footprints, type Footprint } from '../app/regions'
import { boundsOutline, latLonToVector } from './geo'

export type View = 'pole' | 'globe' | { footprintId: string }

const MAP_URL = `${import.meta.env.BASE_URL}moon/lroc_color_2k.jpg`
// The bundled 2k NASA map is ~5 km per pixel; closer than ~1.6 radii it turns to blur, so zoom stops there.
const DISTANCE = { globe: 3.1, pole: 2.05, region: 1.68 }

/** Where the camera sits for each view: a direction from the Moon's center and a distance. */
function viewPose(view: View) {
  if (view === 'globe') return { dir: latLonToVector({ lat: -38, lon: 20 }).normalize(), distance: DISTANCE.globe }
  if (view === 'pole') return { dir: latLonToVector({ lat: -84, lon: 40 }).normalize(), distance: DISTANCE.pole }
  const fp = footprints.find(item => item.id === view.footprintId)
  const center = fp?.center.value ?? { lat: -90, lon: 0 }
  // Look straight down at the region, nudged slightly equatorward so the pole stays in frame.
  return { dir: latLonToVector({ lat: Math.max(-86, center.lat + 5), lon: center.lon }).normalize(), distance: DISTANCE.region }
}

function Moon() {
  const map = useLoader(THREE.TextureLoader, MAP_URL)
  const { gl } = useThree()
  // Runs before the first frame, so the texture uploads with the right color space.
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = gl.capabilities.getMaxAnisotropy()
    map.needsUpdate = true
  }, [map, gl])
  return <mesh>
    <sphereGeometry args={[1, 192, 128]}/>
    <meshStandardMaterial map={map} roughness={1} metalness={0}/>
  </mesh>
}

function Outline({ fp, selected }: { fp: Footprint; selected: boolean }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(boundsOutline(fp.bounds.value!))
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ transparent: true, depthTest: true }))
  }, [fp])
  useEffect(() => {
    const material = line.material as THREE.LineBasicMaterial
    material.color.set(selected ? '#ffe08a' : '#b0e3d9')
    material.opacity = selected ? 1 : 0.65
  }, [line, selected])
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose() }, [line])
  return <primitive object={line}/>
}

/** Camera, controls, gentle idle rotation, fly-to transitions and DOM marker projection. */
function Rig({ view, motion, markers, onInteract }: {
  view: View; motion: boolean; markers: React.RefObject<Map<string, HTMLElement>>; onInteract: () => void
}) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.enablePan = false
    c.minDistance = 1.6
    c.maxDistance = 4.5
    c.rotateSpeed = 0.55
    c.zoomSpeed = 0.7
    c.minPolarAngle = 0.02
    c.maxPolarAngle = Math.PI - 0.02
    return c
  }, [camera, gl])
  const light = useRef<THREE.DirectionalLight>(null)
  const flight = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromD: number; toD: number; t: number } | null>(null)
  const idle = useRef(0)
  const anchors = useMemo(() => new Map(footprints.map(fp => [fp.id, latLonToVector(fp.center.value!, 1.002)])), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const start = () => { flight.current = null; idle.current = 0; onInteract() }
    controls.addEventListener('start', start)
    return () => { controls.removeEventListener('start', start); controls.dispose() }
  }, [controls, onInteract])

  // Fly to the requested view. Reduced motion: jump straight there.
  useEffect(() => {
    const pose = viewPose(view)
    const fromD = camera.position.length()
    if (!motion || fromD === 0) {
      camera.position.copy(pose.dir).multiplyScalar(pose.distance)
      controls.update()
      return
    }
    flight.current = { from: camera.position.clone().normalize(), to: pose.dir, fromD, toD: pose.distance, t: 0 }
    idle.current = 0
  }, [view, motion, camera, controls])

  useFrame((state, delta) => {
    const f = flight.current
    if (f) {
      f.t = Math.min(1, f.t + delta / 1.6)
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2
      const dir = f.from.clone().lerp(f.to, e).normalize()
      // Pull back a little mid-flight so long moves read as travel, not a jump cut.
      const lift = Math.sin(Math.PI * e) * Math.min(0.6, f.from.angleTo(f.to) * 0.5)
      camera.position.copy(dir.multiplyScalar(f.fromD + (f.toD - f.fromD) * e + lift))
      if (f.t >= 1) flight.current = null
    } else if (motion) {
      idle.current += delta
      controls.autoRotate = idle.current > 6
      controls.autoRotateSpeed = 0.35
    }
    controls.update()
    light.current?.position.copy(camera.position).add(tmp.set(0.6, 0.8, 0))

    // Project each region marker into the DOM overlay; hide those on the far side.
    const { width, height } = state.size
    const toCamera = state.camera.position
    for (const [id, anchor] of anchors) {
      const el = markers.current?.get(id)
      if (!el) continue
      const facing = anchor.clone().normalize().dot(tmp.copy(toCamera).sub(anchor).normalize()) > 0.08
      const p = anchor.clone().project(state.camera)
      el.style.transform = `translate(${(p.x * 0.5 + 0.5) * width}px, ${(-p.y * 0.5 + 0.5) * height}px)`
      el.dataset.hidden = facing ? '' : 'true'
    }
  })

  return <>
    <ambientLight intensity={0.32}/>
    <directionalLight ref={light} intensity={1.55}/>
  </>
}

export default function MoonGlobe({ view, selectedFootprint, onSelectFootprint, markerLabel, onInteract }: {
  view: View
  selectedFootprint: string | null
  onSelectFootprint: (id: string) => void
  markerLabel: (fp: Footprint) => string
  onInteract: () => void
  }) {
  const markers = useRef(new Map<string, HTMLElement>())
  const motion = typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const placed = footprints.filter(fp => fp.center.value && fp.bounds.value)
  return <div className="globe">
    <Canvas dpr={[1, 1.75]} camera={{ fov: 40, near: 0.01, far: 50, position: [0, -1.4, 2.6] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }} aria-hidden="true">
      <Suspense fallback={null}>
        <Moon/>
        {placed.map(fp => <Outline key={fp.id} fp={fp} selected={fp.id === selectedFootprint}/>)}
      </Suspense>
      <Rig view={view} motion={motion} markers={markers} onInteract={onInteract}/>
    </Canvas>
    {/* Markers are real buttons laid over the canvas; the region list is the keyboard path. */}
    <div className="globe-markers">{placed.map(fp => <button key={fp.id} type="button" tabIndex={-1} aria-hidden="true"
      className="globe-marker" data-selected={fp.id === selectedFootprint || undefined}
      ref={el => { if (el) markers.current.set(fp.id, el); else markers.current.delete(fp.id) }}
      onClick={() => onSelectFootprint(fp.id)}>
      <span className="globe-dot"/><span className="globe-label">{markerLabel(fp)}</span>
    </button>)}</div>
  </div>
}
