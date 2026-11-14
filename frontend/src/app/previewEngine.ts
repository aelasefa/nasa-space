import type {
  MissionEngine, MissionInput, MissionResult, ResolvedEvent, ResourceReport, SpacecraftConfig,
} from './contracts'
import { configFields, label } from './options'
import { estimateResources } from './planning'

/**
 * Stand-in for the shared simulation engine while `src/domain` is not in this checkout.
 *
 * It exists only so the frontend loop can be played end to end. It does NOT simulate:
 * flight outcomes, science and scores are fixed placeholders, and feasibility is not
 * evaluated. Review gates only check the evidence the player recorded. The app labels
 * every screen while this adapter is active, and `engine.ts` prefers the real engine
 * as soon as it is present. Delete this file once the domain engine ships.
 */
export const PREVIEW_MODEL_VERSION = 'preview-placeholder'

const notEvaluated = {
  id: 'preview_engine', severity: 'info', sourceField: 'scenario',
  message: 'Preview engine: feasibility is not evaluated until the shared simulation engine is connected.',
} as const

const hashConfig = (config: SpacecraftConfig) => configFields.map(field => config[field]).join('|')

const event = (id: ResolvedEvent['id'], description: string): ResolvedEvent =>
  ({ id, status: 'placeholder', description, metrics: {} })

function placeholderResult(input: MissionInput): MissionResult {
  const { config, decisions } = input
  return {
    outcome: 'partial',
    resources: estimateResources(config),
    observationFraction: 0, collectedSciencePoints: 0, returnedSciencePoints: 0, scienceReturn: 0,
    events: [
      event('arrival', `Placeholder: ${label('trajectoryId', config.trajectoryId)} recorded. Arrival is not simulated.`),
      event('E1', `Placeholder: ${label('observeAction', decisions.observeAction)} recorded. Energy use is not simulated.`),
      event('E2', `Placeholder: ${label('downlinkAction', decisions.downlinkAction)} recorded. Science return is not simulated.`),
    ],
    causes: [{
      id: 'preview_engine', sourceField: 'scenario', constraintId: 'engine_not_connected', eventId: 'E2', severity: 'info',
      effect: 'The shared simulation engine is not connected, so outcome, science and score are placeholders.',
      modelSource: 'illustrative',
    }],
    score: {
      science: 0, efficiency: 0, reliability: 0, engineering: 0, operations: 0,
      rawMPI: 0, mpi: 0, cap: 749, resourceUse: 0, rawSciencePerResource: 0,
    },
  }
}

const subtract = (a: ResourceReport, b: ResourceReport) =>
  Object.fromEntries(Object.keys(a).map(key => [key, b[key as keyof ResourceReport] - a[key as keyof ResourceReport]])) as unknown as ResourceReport

export const previewEngine: MissionEngine = {
  modelVersion: PREVIEW_MODEL_VERSION,
  computeResources: estimateResources,
  evaluateFeasibility: () => ({ eligible: true, blockers: [], warnings: [] }),
  hashConfig,
  evaluateReviews(config, evidence) {
    const configHash = hashConfig(config)
    const trade = evidence.tradeStudy
    const gates = {
      CML1: config.payloadId === 'ice_spectrometer' ? { passed: true, findings: [] } : { passed: false, findings: [{
        id: 'objective', severity: 'blocker', sourceField: 'payloadId',
        message: 'The mission objective is water ice. Select the ice-sensitive spectrometer.',
      } as const] },
      CML2: { passed: true, findings: [notEvaluated] },
      CML3: trade && trade.configHashA !== trade.configHashB && trade.chosenConfigHash === configHash
        ? { passed: true, findings: [] }
        : { passed: false, findings: [{ id: 'trade', severity: 'warning', sourceField: 'scenario',
          message: 'Record a trade study that compares your saved candidate with this design.' } as const] },
      CML4: { passed: evidence.configHash === configHash, findings: [] },
    }
    return { configHash, gates, authorized: Object.values(gates).every(gate => gate.passed) }
  },
  resolveObservation: (_config, action) => ({
    event: event('E1', `Placeholder: ${label('observeAction', action)} recorded. Energy use is not simulated.`),
  }),
  simulateMission: input => ({ kind: 'completed', input, result: placeholderResult(input) }),
  createRootUniverse: (attempt, id, createdAt) =>
    ({ id, createdAt, parentId: null, change: null, input: attempt.input, result: attempt.result }),
  branchUniverse(parent, change, _collection, id, createdAt) {
    const current = change.field in parent.input.config
      ? parent.input.config[change.field as keyof SpacecraftConfig]
      : parent.input.decisions[change.field as keyof MissionInput['decisions']]
    if (current === change.to) return { kind: 'rejected', reason: 'Choose a different value to create an alternate universe.' }
    const input: MissionInput = change.field in parent.input.config
      ? { ...parent.input, config: { ...parent.input.config, [change.field]: change.to } }
      : { ...parent.input, decisions: { ...parent.input.decisions, [change.field]: change.to } }
    return { kind: 'created', universe: { id, createdAt, parentId: parent.id, change, input, result: placeholderResult(input) } }
  },
  compareUniverses: (a, b) => ({
    changedFields: b.change ? [b.change] : [],
    resourceDeltas: subtract(a.result.resources, b.result.resources),
    scienceDelta: 0, mpiDelta: 0,
    outcomeTransition: { from: a.result.outcome, to: b.result.outcome },
    eventChanges: {},
  }),
}
