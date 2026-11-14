import type { MissionEngine, MissionInput, MissionResult, ResolvedEvent, ResourceReport } from '../../src/app/contracts'

const resources: ResourceReport = {
  costBU: 115, launchMassKg: 395, sunlitScienceLoadW: 115, sunlitScienceMarginW: 75,
  downlinkLoadW: 70, sunlitDownlinkMarginW: 120, deltaVMarginMps: 150, batteryWh: 400,
}
const arrival: ResolvedEvent = { id: 'arrival', status: 'arrived', description: 'Orbit acquired.', metrics: {} }
const observation: ResolvedEvent = { id: 'E1', status: 'nominal', description: 'Observation complete.', metrics: {} }
const downlink: ResolvedEvent = { id: 'E2', status: 'nominal', description: 'Science transfer complete.', metrics: {} }
const result: MissionResult = {
  outcome: 'success', resources, observationFraction: 1, collectedSciencePoints: 100,
  returnedSciencePoints: 100, scienceReturn: 1, events: [arrival, observation, downlink],
  causes: [{ id: 'nominal', eventId: 'E1', sourceField: 'powerId', constraintId: 'energy', severity: 'info',
    effect: 'Stored energy sustained the observation.', modelSource: 'illustrative' }],
  score: { science: 100, efficiency: 100, reliability: 100, engineering: 100, operations: 100, rawMPI: 1000,
    mpi: 1000, cap: 1000, resourceUse: .9, rawSciencePerResource: 1.1 },
}
const alternateDownlink: ResolvedEvent = { ...downlink, status: 'limited', description: 'The link capped science return.' }
const alternateResources = { ...resources, costBU: 105, launchMassKg: 380, downlinkLoadW: 50, sunlitDownlinkMarginW: 140 }
const alternate: MissionResult = {
  ...result, outcome: 'partial', returnedSciencePoints: 60, scienceReturn: .6, resources: alternateResources,
  events: [arrival, observation, alternateDownlink],
  causes: [{ id: 'limited', eventId: 'E2', sourceField: 'commsId', constraintId: 'downlink_capacity', severity: 'warning',
    effect: 'The basic antenna limited the returned science.', modelSource: 'illustrative' }],
  score: { ...result.score, mpi: 749, cap: 749 },
}
const feasibility = { eligible: true, blockers: [], warnings: [
  { id: 'battery_endurance', severity: 'warning', sourceField: 'powerId', message: 'Check endurance' },
] } as const
const report = () => ({ ...feasibility, blockers: [], warnings: [...feasibility.warnings] })

// Fixed UI test data. This fixture is never imported by application code.
export const fixture: MissionEngine = {
  modelVersion: 'frontend-fixture',
  computeResources: config => config.commsId === 'comms_basic' ? alternateResources : resources,
  evaluateFeasibility: report,
  hashConfig: config => JSON.stringify(config),
  evaluateReviews(config, evidence) {
    const configHash = this.hashConfig(config)
    const gate = (passed: boolean) => ({ passed, findings: [] })
    const gates = {
      CML1: gate(config.payloadId === 'ice_spectrometer'),
      CML2: gate(true),
      CML3: gate(Boolean(evidence.tradeStudy && evidence.tradeStudy.configHashA !== evidence.tradeStudy.configHashB &&
        evidence.tradeStudy.chosenConfigHash === configHash)),
      CML4: gate(evidence.configHash === configHash && evidence.acknowledgedWarnings.includes('battery_endurance')),
    }
    return { configHash, gates, authorized: Object.values(gates).every(item => item.passed) }
  },
  resolveObservation: () => ({ event: observation }),
  simulateMission: input => ({ kind: 'completed', input, result }),
  createRootUniverse: (attempt, id, createdAt) => ({ id, createdAt, parentId: null, change: null, input: attempt.input, result: attempt.result }),
  branchUniverse(parent, change, _collection, id, createdAt) {
    if (change.field !== 'commsId') return { kind: 'rejected', reason: 'Fixture rejects this change.' }
    const input: MissionInput = { ...parent.input, config: { ...parent.input.config, commsId: 'comms_basic' } }
    return { kind: 'created', universe: { id, createdAt, parentId: parent.id, change, input, result: alternate } }
  },
  compareUniverses: (_a, b) => ({
    changedFields: b.change ? [b.change] : [], resourceDeltas: {
      costBU: -10, launchMassKg: -15, sunlitScienceLoadW: 0, sunlitScienceMarginW: 0,
      downlinkLoadW: -20, sunlitDownlinkMarginW: 20, deltaVMarginMps: 0, batteryWh: 0,
    }, scienceDelta: -40, mpiDelta: -251, outcomeTransition: { from: 'success', to: 'partial' },
    eventChanges: { E2: { from: downlink, to: alternateDownlink } },
  }),
}
