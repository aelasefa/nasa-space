import { useEffect, useRef } from 'react'
import type { SceneMode, SpaceScene } from './scene'
import { motionOK, registerWarp, webglOK } from './motion'

/** Fixed, decorative WebGL layer behind the whole app. Three.js loads lazily. */
export function SpaceBackdrop({ mode }: { mode: SceneMode }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<SpaceScene | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    if (!webglOK() || !canvas.current) return
    let cancelled = false
    import('./scene').then(({ createSpaceScene }) => {
      if (cancelled || !canvas.current) return
      try {
        scene.current = createSpaceScene(canvas.current, modeRef.current, !motionOK())
        registerWarp(() => scene.current?.warp() ?? Promise.resolve())
        canvas.current.classList.add('space-ready')
      } catch {
        // No GPU context available: the CSS nebula alone is a fine fallback.
      }
    })
    return () => {
      cancelled = true
      registerWarp(null)
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => { scene.current?.setMode(mode) }, [mode])

  return <div className="space-backdrop" aria-hidden="true">
    <canvas ref={canvas}/>
    <div className="space-vignette"/>
  </div>
}
