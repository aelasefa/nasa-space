import * as domain from '../../../backend/src/domain/index'
import type { MissionEngine, ResourceReport, UniverseComparison } from './contracts'

// Translate the domain API into the frontend view model without changing calculations.
export const engine: MissionEngine = {
  ...domain,
  modelVersion: domain.DEFAULT_MODEL_VERSION,
  compareUniverses(a, b) {
    const comparison = domain.compareUniverses(a, b)
    const resourceDeltas = { ...comparison.resourceDeltas,
      sunlitScienceLoadW: b.result.resources.sunlitScienceLoadW - a.result.resources.sunlitScienceLoadW,
      downlinkLoadW: b.result.resources.downlinkLoadW - a.result.resources.downlinkLoadW,
    } satisfies ResourceReport
    const eventChanges: UniverseComparison['eventChanges'] = {}
    for (const from of a.result.events) {
      const to = b.result.events.find(event => event.id === from.id)
      if (to && (from.status !== to.status || from.description !== to.description ||
        JSON.stringify(from.metrics) !== JSON.stringify(to.metrics))) {
        eventChanges[from.id] = { from, to }
      }
    }
    return {
      changedFields: comparison.changes.map(({ field, valueA, valueB }) => ({ field, from: valueA, to: valueB })),
      resourceDeltas,
      scienceDelta: comparison.scienceDelta.returnedSciencePoints,
      mpiDelta: comparison.scoreDelta.mpi,
      outcomeTransition: comparison.outcomeTransition,
      eventChanges,
    }
  },
}

/** Hard limits from the engine's catalog, for displaying spend against caps. */
export const limits = { budget: domain.BUDGET_CAP_BU, mass: domain.LAUNCH_MASS_CAP_KG }
