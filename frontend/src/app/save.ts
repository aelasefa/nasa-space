import { z } from 'zod'
import { regions } from './regions'

const regionIds = regions.map(region => region.id) as [string, ...string[]]
import type { MissionEngine } from './contracts'

const config = z.object({
  payloadId: z.enum(['mapping_camera', 'ice_spectrometer']), powerId: z.enum(['solar_light', 'solar_storage']),
  propulsionId: z.enum(['prop_low', 'prop_high']), commsId: z.enum(['comms_basic', 'comms_high']),
  trajectoryId: z.enum(['direct', 'efficient']),
})
const observe = z.enum(['observe_full', 'conserve'])
const downlink = z.enum(['science_first', 'health_first'])
const field = z.enum(['payloadId', 'powerId', 'propulsionId', 'commsId', 'trajectoryId', 'observeAction', 'downlinkAction'])
const outcome = z.enum(['success', 'partial', 'failure'])
const resources = z.object({
  costBU: z.number(), launchMassKg: z.number(), sunlitScienceLoadW: z.number(), sunlitScienceMarginW: z.number(),
  downlinkLoadW: z.number(), sunlitDownlinkMarginW: z.number(), deltaVMarginMps: z.number(), batteryWh: z.number(),
})
const event = z.object({
  id: z.enum(['arrival', 'E1', 'E2']), status: z.string(), description: z.string(), metrics: z.record(z.string(), z.number()),
})
const universe = z.object({
  id: z.string().min(1), parentId: z.string().nullable(), createdAt: z.iso.datetime(),
  change: z.object({ field, from: z.string(), to: z.string() }).nullable(),
  input: z.object({
    config, decisions: z.object({ observeAction: observe, downlinkAction: downlink }),
    scenarioId: z.literal('lunar_south_pole_ice_v1'), modelVersion: z.string().min(1),
  }),
  result: z.object({
    outcome, resources, observationFraction: z.number().min(0).max(1),
    collectedSciencePoints: z.number().min(0).max(100), returnedSciencePoints: z.number().min(0).max(100),
    scienceReturn: z.number().min(0).max(1), events: z.array(event).refine(events =>
      events.map(item => item.id).join() === 'arrival,E1,E2'),
    causes: z.array(z.object({
      id: z.string(), sourceField: z.union([field, z.literal('scenario')]), constraintId: z.string(),
      eventId: z.string(), effect: z.string(), severity: z.enum(['info', 'warning', 'failure']),
      modelSource: z.literal('illustrative'),
    })),
    score: z.object({
      science: z.number(), efficiency: z.number(), reliability: z.number(), engineering: z.number(), operations: z.number(),
      rawMPI: z.number(), mpi: z.number().int().min(0).max(1000), cap: z.union([z.literal(1000), z.literal(749), z.literal(249)]),
      resourceUse: z.number(), rawSciencePerResource: z.number(),
    }),
  }),
})
const collection = z.object({
  schemaVersion: z.literal(1), rootId: z.string(), universes: z.array(universe).min(1).max(8),
}).refine(({ rootId, universes }) => {
  const seen = new Map<string, z.infer<typeof universe>>()
  for (const item of universes) {
    if (seen.has(item.id)) return false
    if (seen.size === 0) {
      if (item.id !== rootId || item.parentId !== null || item.change !== null) return false
    } else {
      const parent = item.parentId && seen.get(item.parentId)
      if (!parent || !item.change || parent.input.modelVersion !== item.input.modelVersion) return false
      const before = { ...parent.input.config, ...parent.input.decisions }
      const after = { ...item.input.config, ...item.input.decisions }
      const changed = field.options.filter(key => before[key] !== after[key])
      if (changed.length !== 1 || changed[0] !== item.change.field ||
        before[item.change.field] !== item.change.from || after[item.change.field] !== item.change.to) return false
    }
    seen.set(item.id, item)
  }
  return true
})
const evidence = z.object({
  configHash: z.string(),
  tradeStudy: z.object({
    configHashA: z.string(), configHashB: z.string(), chosenConfigHash: z.string(),
    rationale: z.enum(['science', 'mass', 'cost', 'risk']),
  }).optional(),
  acknowledgedWarnings: z.array(z.enum(['power_margin', 'delta_v_margin', 'battery_endurance'])),
})
const saveSchema = z.object({
  schemaVersion: z.literal(1), modelVersion: z.string().min(1),
  phase: z.enum(['briefing', 'target', 'builder', 'reviews', 'flight', 'debrief', 'multiverse']),
  // Observation target (historical Artemis III candidate region). Optional so older saves still load.
  targetId: z.enum(regionIds).nullable().optional(),
  config, alternative: config.nullable(), evidence: evidence.nullable(),
  observation: observe.nullable(), collection: collection.nullable(),
}).refine(save => {
  const completed = save.phase === 'debrief' || save.phase === 'multiverse'
  return completed === Boolean(save.collection)
    && (!save.collection || save.collection.universes.every(item => item.input.modelVersion === save.modelVersion))
    && (save.observation === null || save.phase === 'flight' || completed)
})

export type Save = Omit<z.input<typeof saveSchema>, 'collection'> & { collection: import('./contracts').UniverseCollection | null }
export type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export const saveKey = 'luna01:save:v1'

export function loadSave(storage: Storage, engine?: MissionEngine) {
  try {
    const raw = storage.getItem(saveKey)
    if (raw === null) return {}
    const parsed = saveSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return { error: 'The saved mission is damaged. Reset to begin a new mission.' }
    const save = parsed.data
    if (save.modelVersion === 'pending' && !save.evidence && (save.phase === 'briefing' || save.phase === 'builder')) {
      return { save: { ...save, modelVersion: engine?.modelVersion ?? 'pending' } }
    }
    if (!engine || save.modelVersion !== engine.modelVersion) {
      return { error: 'This save requires a different model version. Reset to begin a new mission.' }
    }
    if (save.phase === 'flight' && (!save.evidence || !save.alternative ||
      save.evidence.configHash !== engine.hashConfig(save.config) ||
      save.evidence.tradeStudy?.configHashA !== engine.hashConfig(save.alternative) ||
      save.evidence.tradeStudy.configHashB !== engine.hashConfig(save.config) ||
      !engine.evaluateReviews(save.config, save.evidence).authorized)) {
      return { error: 'Flight authorization could not be verified. Reset to begin a new mission.' }
    }
    return { save }
  } catch {
    return { error: 'The saved mission could not be read. Reset to begin a new mission.' }
  }
}
