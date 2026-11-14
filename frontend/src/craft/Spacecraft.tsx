import { useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/*
 * Stylized, low-poly spacecraft renderer.
 *
 * Generic by design: a spacecraft is a set of slots (fixed attachment points), each
 * showing one named variant. Missions map their own configuration to `design`
 * (slot → variant) and can add slots or variants to the registry below; nothing here
 * knows about the Moon or about LUNA-01's rules. Shapes are illustrative and not to scale.
 */

export type CraftDesign = Record<string, string>
export interface CraftEffects {
  /** In shadow: sunlight off, cool fill light only. */
  shadow?: boolean
  /** Instrument is observing: show its field of view. */
  scanning?: boolean
  /** Antenna is transmitting: show link pulses. */
  downlink?: boolean
}

interface Slot { position: [number, number, number]; yaw: number; ring: number; variants: Record<string, () => ReactNode> }

const flat = { flatShading: true } as const
const Panel = ({ x, w }: { x: number; w: number }) => <mesh position={[x, 0, 0]}>
  <boxGeometry args={[w, 0.04, 0.62]}/><meshStandardMaterial color="#2f5fd0" metalness={0.3} roughness={0.45} {...flat}/>
</mesh>
const wings = (count: number) => () => <>
  {[-1, 1].map(side => <group key={side} position={[side * 0.62, 0, 0]}>
    <mesh position={[side * 0.06, 0, 0]}><boxGeometry args={[0.12, 0.05, 0.08]}/><meshStandardMaterial color="#c9d2d8" {...flat}/></mesh>
    {Array.from({ length: count }, (_, i) => <Panel key={i} x={side * (0.42 + i * 0.62)} w={0.58}/>)}
  </group>)}
</>

/** Slots and their variants. Add entries here for new missions (legs, wheels, RTGs, ...). */
const slots: Record<string, Slot> = {
  bus: { position: [0, 0, 0], yaw: 0.5, ring: 0.95, variants: {
    standard: () => <>
      <mesh><boxGeometry args={[1, 1, 1.25]}/><meshStandardMaterial color="#e2b65a" metalness={0.55} roughness={0.42} {...flat}/></mesh>
      <mesh position={[0, 0.51, 0]}><boxGeometry args={[0.86, 0.03, 1.1]}/><meshStandardMaterial color="#f3ead2" {...flat}/></mesh>
    </>,
  } },
  solar: { position: [0, 0.1, 0], yaw: 0, ring: 1.5, variants: { compact: wings(1), extended: wings(2) } },
  battery: { position: [0, -0.62, 0.1], yaw: 0.9, ring: 0.5, variants: {
    small: () => <mesh><boxGeometry args={[0.34, 0.22, 0.34]}/><meshStandardMaterial color="#59c58f" {...flat}/></mesh>,
    large: () => <>{[-0.24, 0.24].map(x => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.4, 0.26, 0.7]}/><meshStandardMaterial color="#59c58f" {...flat}/></mesh>)}</>,
  } },
  propulsion: { position: [0, 0, -0.66], yaw: Math.PI * 0.82, ring: 0.6, variants: {
    small: () => <>
      <mesh position={[0, 0, -0.14]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.2, 0.3, 8, 1, true]}/><meshStandardMaterial color="#f08a4b" side={THREE.DoubleSide} {...flat}/></mesh>
      <mesh position={[0, 0, 0.05]}><icosahedronGeometry args={[0.2, 0]}/><meshStandardMaterial color="#eef2f4" {...flat}/></mesh>
    </>,
    large: () => <>
      <mesh position={[0, 0, -0.22]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.3, 0.46, 8, 1, true]}/><meshStandardMaterial color="#f08a4b" side={THREE.DoubleSide} {...flat}/></mesh>
      {[-0.3, 0.3].map(x => <mesh key={x} position={[x, 0, 0.02]}><icosahedronGeometry args={[0.27, 0]}/><meshStandardMaterial color="#eef2f4" {...flat}/></mesh>)}
    </>,
  } },
  antenna: { position: [0, 0.56, -0.2], yaw: 0.3, ring: 0.55, variants: {
    low_gain: () => <>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.025, 0.025, 0.32, 6]}/><meshStandardMaterial color="#dfe6ea" {...flat}/></mesh>
      <mesh position={[0, 0.34, 0]}><coneGeometry args={[0.07, 0.1, 6]}/><meshStandardMaterial color="#dfe6ea" {...flat}/></mesh>
    </>,
    dish: () => <>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.03, 0.03, 0.28, 6]}/><meshStandardMaterial color="#c9d2d8" {...flat}/></mesh>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI * 0.94, 0, 0]}><coneGeometry args={[0.42, 0.2, 12, 1, true]}/><meshStandardMaterial color="#f4f7f8" side={THREE.DoubleSide} {...flat}/></mesh>
      <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.045, 6, 6]}/><meshStandardMaterial color="#f08a4b" {...flat}/></mesh>
    </>,
  } },
  instrument: { position: [0, 0, 0.66], yaw: -0.35, ring: 0.55, variants: {
    camera: () => <>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}><cylinderGeometry args={[0.17, 0.2, 0.3, 10]}/><meshStandardMaterial color="#39424d" {...flat}/></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.26]}><cylinderGeometry args={[0.12, 0.12, 0.03, 10]}/><meshStandardMaterial color="#8fd0ff" emissive="#1b4a66" {...flat}/></mesh>
    </>,
    spectrometer: () => <>
      <mesh position={[0, 0, 0.14]}><boxGeometry args={[0.5, 0.42, 0.34]}/><meshStandardMaterial color="#3fb7a6" {...flat}/></mesh>
      <mesh position={[0, 0, 0.32]}><boxGeometry args={[0.26, 0.16, 0.04]}/><meshStandardMaterial color="#12303a" emissive="#0d5c66" {...flat}/></mesh>
      <mesh position={[0, 0.3, 0.12]}><boxGeometry args={[0.56, 0.04, 0.38]}/><meshStandardMaterial color="#f3ead2" {...flat}/></mesh>
    </>,
  } },
}

/** One attachment point. A new variant pops into place; the focused slot gets a pulsing ring. */
function Part({ slot, variant, focused, motion }: { slot: Slot; variant: string; focused: boolean; motion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const elapsed = useRef(0)
  useFrame((state, delta) => {
    if (!motion) return
    const t = elapsed.current = Math.min(1, elapsed.current + delta / 0.45)
    // Ease-out-back: a small overshoot so the part "clicks" into place.
    const c = 1.9, e = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
    group.current?.scale.setScalar(0.35 + 0.65 * e)
    if (ring.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06
      ring.current.scale.setScalar(pulse)
      ring.current.rotation.z += delta * 0.4
    }
  })
  const render = slot.variants[variant]
  return <group position={slot.position}>
    <group ref={group}>{render?.()}</group>
    {focused && <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[slot.ring, 0.012, 6, 48]}/><meshBasicMaterial color="#ffe08a" transparent opacity={0.9}/>
    </mesh>}
  </group>
}

function Model({ design, focus, effects, motion }: { design: CraftDesign; focus?: string; effects: CraftEffects; motion: boolean }) {
  const craft = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const pulses = useRef<THREE.Group>(null)
  const yaw = focus && slots[focus] ? slots[focus].yaw : 0.5
  useFrame((state, delta) => {
    if (!motion) return
    const t = state.clock.elapsedTime
    if (craft.current) {
      const target = yaw + Math.sin(t * 0.35) * 0.18
      craft.current.rotation.y += (target - craft.current.rotation.y) * Math.min(1, delta * 2.5)
      craft.current.rotation.x = 0.18 + Math.sin(t * 0.5) * 0.03
      craft.current.position.y = Math.sin(t * 0.8) * 0.04
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 4) * 0.06
    pulses.current?.children.forEach((child, i) => {
      const p = (t * 0.6 + i / 3) % 1
      child.position.y = 0.6 + p * 1.6
      child.scale.setScalar(0.4 + p * 1.2)
      ;((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - p)
    })
  })
  const instrument = slots.instrument.position
  const antenna = slots.antenna.position
  return <>
    <ambientLight intensity={effects.shadow ? 0.18 : 0.55} color={effects.shadow ? '#7fa4ff' : '#ffffff'}/>
    <directionalLight position={[4, 5, 3]} intensity={effects.shadow ? 0.12 : 2.2} color="#fff4e0"/>
    <directionalLight position={[-3, -1, -2]} intensity={effects.shadow ? 0.25 : 0.5} color="#8fb6ff"/>
    <group ref={craft} rotation={motion ? undefined : [0.18, yaw, 0]}>
      {Object.entries(design).map(([name, variant]) => slots[name] &&
        <Part key={`${name}:${variant}`} slot={slots[name]} variant={variant} focused={focus === name} motion={motion}/>)}
      {effects.scanning && design.instrument && <mesh ref={beam} position={[instrument[0], instrument[1], instrument[2] + 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.7, 2.1, 20, 1, true]}/><meshBasicMaterial color="#7ff0dc" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false}/>
      </mesh>}
      {effects.downlink && design.antenna && <group ref={pulses} position={[antenna[0], antenna[1], antenna[2]]}>
        {[0, 1, 2].map(i => <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.65 + i * 0.25, 0]}>
          <torusGeometry args={[0.3, 0.015, 6, 32]}/><meshBasicMaterial color="#ffe08a" transparent depthWrite={false}/>
        </mesh>)}
      </group>}
    </group>
  </>
}

export default function Spacecraft({ design, focus, effects = {}, label }: {
  design: CraftDesign; focus?: string; effects?: CraftEffects; label: string
}) {
  const motion = typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <div className="craft" role="img" aria-label={label}>
    <Canvas frameloop={motion ? 'always' : 'demand'} dpr={[1, 1.75]} camera={{ fov: 34, position: [3.6, 2.1, 5.2] }} gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}>
      <Model design={design} focus={focus} effects={effects} motion={motion}/>
    </Canvas>
  </div>
}
