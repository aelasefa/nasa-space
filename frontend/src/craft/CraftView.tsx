import { lazy, Suspense } from 'react'
import { webglOK } from '../space/motion'
import type { CraftDesign, CraftEffects } from './Spacecraft'

const Spacecraft = lazy(() => import('./Spacecraft'))

/** 3D spacecraft where WebGL is available; a plain parts list otherwise. */
export function CraftView({ design, focus, effects, label }: { design: CraftDesign; focus?: string; effects?: CraftEffects; label: string }) {
  if (!webglOK()) return <p className="craft-fallback">{label}</p>
  return <Suspense fallback={<p className="craft-fallback">Assembling spacecraft…</p>}>
    <Spacecraft design={design} focus={focus} effects={effects} label={label}/>
  </Suspense>
}
