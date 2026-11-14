/** Shared motion helpers: one place decides whether the cinematic layer runs. */
export function motionOK() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function webglOK() {
  return typeof window !== 'undefined' && 'WebGL2RenderingContext' in window
}

type Warp = () => Promise<void>
let warpHandler: Warp | null = null

/** The mounted 3D scene registers its hyperspace jump here. */
export function registerWarp(handler: Warp | null) { warpHandler = handler }

/** Jump to hyperspace, then continue. Runs `next` synchronously when no scene is mounted. */
export function warpThen(next: () => void) {
  if (!warpHandler || !motionOK()) return next()
  warpHandler().then(next, next)
}
