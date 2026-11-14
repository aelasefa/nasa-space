import type { MissionEngine } from './contracts'
import { previewEngine } from './previewEngine'

// Optional during parallel development. This namespace is the sole production integration point.
const entries = import.meta.glob<MissionEngine>('../domain/index.ts', { eager: true })
const domain = entries['../domain/index.ts']
const required = [
  'computeResources', 'evaluateFeasibility', 'hashConfig', 'evaluateReviews', 'resolveObservation',
  'simulateMission', 'createRootUniverse', 'branchUniverse', 'compareUniverses',
] as const

export const engine = typeof domain?.modelVersion === 'string' &&
  domain.modelVersion.length > 0 && required.every(name => typeof domain[name] === 'function')
  ? domain : undefined

/**
 * Engine the app runs with. Uses the shared domain engine when present. Otherwise, in
 * development or when built with VITE_LUNA_PREVIEW=1, it falls back to the labelled
 * placeholder adapter so the loop stays playable. Production builds stay locked by default.
 */
export const activeEngine: MissionEngine | undefined = engine ??
  (import.meta.env.DEV || import.meta.env.VITE_LUNA_PREVIEW === '1' ? previewEngine : undefined)
