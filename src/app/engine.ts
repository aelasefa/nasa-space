import type { MissionEngine } from './contracts'

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
