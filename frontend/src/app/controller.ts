import { createStore } from 'zustand/vanilla'
import type { ConfigField, DownlinkAction, MissionEngine, MutableField, ObserveAction, SpacecraftConfig, TradeStudyEvidence, WarningId } from './contracts'
import { initialConfig, options } from './options'
import { loadSave, saveKey, type Save, type Storage } from './save'
import { regionById, type RegionId } from './regions'

type Runtime = { save: Save; recovery?: string; message?: string; playback: boolean }
const blankEvidence = (configHash: string) => ({ configHash, acknowledgedWarnings: [] })
const fresh = (modelVersion: string): Save => ({
  schemaVersion: 1, modelVersion, phase: 'briefing', targetId: null, config: initialConfig,
  alternative: null, evidence: null, observation: null, collection: null,
})

export function createGame(engine?: MissionEngine, storage?: Storage) {
  const loaded = storage ? loadSave(storage, engine) : {}
  const store = createStore<Runtime>(() => ({
    save: loaded.save ?? fresh(engine?.modelVersion ?? 'pending'), recovery: loaded.error, playback: false,
  }))
  const current = () => store.getState().save
  const message = (text: string) => store.setState({ message: text })
  const update = (patch: Partial<Save>, playback = false) => {
    if (store.getState().recovery) return
    const save = { ...current(), ...patch }
    store.setState({ save, message: undefined, playback })
    if (storage) {
      try { storage.setItem(saveKey, JSON.stringify(save)) }
      catch { message('Session storage is unavailable. You can continue until you reload.') }
    }
  }
  const authorized = (save: Save) => Boolean(engine && save.evidence &&
    save.evidence.configHash === engine.hashConfig(save.config) &&
    save.alternative && save.evidence.tradeStudy &&
    save.evidence.tradeStudy.configHashA === engine.hashConfig(save.alternative) &&
    save.evidence.tradeStudy.configHashB === engine.hashConfig(save.config) &&
    engine.evaluateReviews(save.config, save.evidence).authorized)

  return {
    store, engine,
    start() { if (current().phase === 'briefing') update({ phase: 'target' }) },
    /** Choose an observation target. It is recorded for the mission; engine v0.1 does not model per-target effects. */
    chooseTarget(id: RegionId) { if (current().phase === 'target' && regionById(id)) update({ targetId: id }) },
    confirmTarget() { const save = current(); if (save.phase === 'target' && regionById(save.targetId)) update({ phase: 'builder' }) },
    retarget() { if (current().phase === 'builder') update({ phase: 'target' }) },
    select<K extends ConfigField>(field: K, value: SpacecraftConfig[K]) {
      const { phase, config } = current()
      if ((phase !== 'builder' && phase !== 'reviews') || config[field] === value ||
        !options[field].some(([id]) => id === value)) return
      const next = { ...config, [field]: value }
      update({ config: next, evidence: engine ? blankEvidence(engine.hashConfig(next)) : null })
    },
    saveAlternative() {
      const save = current()
      if (save.phase === 'builder') update({
        alternative: { ...save.config }, evidence: engine ? blankEvidence(engine.hashConfig(save.config)) : null,
      })
    },
    /** Use the starter design as the comparison baseline, so every build has something to compare against. */
    baselineStarter() {
      const save = current()
      if (save.phase === 'builder' && !save.alternative) update({
        alternative: { ...initialConfig }, evidence: engine ? blankEvidence(engine.hashConfig(save.config)) : null,
      })
    },
    builder() { if (current().phase === 'reviews') update({ phase: 'builder' }) },
    reviews() {
      if (engine && current().phase === 'builder') {
        update({ phase: 'reviews', evidence: current().evidence ?? blankEvidence(engine.hashConfig(current().config)) })
      }
    },
    trade(rationale: TradeStudyEvidence['rationale']) {
      const save = current()
      if (!engine || (save.phase !== 'reviews' && save.phase !== 'builder') || !save.alternative) return
      const a = engine.hashConfig(save.alternative)
      const b = engine.hashConfig(save.config)
      if (a === b) return
      update({ evidence: { ...(save.evidence ?? blankEvidence(b)), tradeStudy: {
        configHashA: a, configHashB: b, chosenConfigHash: b, rationale,
      } } })
    },
    acknowledge(id: WarningId, checked: boolean) {
      const save = current()
      if (!engine || save.phase !== 'reviews' || !save.evidence ||
        !engine.evaluateFeasibility(save.config).warnings.some(warning => warning.id === id)) return
      const warnings = save.evidence.acknowledgedWarnings.filter(item => item !== id)
      update({ evidence: { ...save.evidence, acknowledgedWarnings: checked ? [...warnings, id] : warnings } })
    },
    launch() {
      const save = current()
      if (save.phase === 'reviews' && authorized(save)) update({ phase: 'flight', observation: null })
    },
    observe(action: ObserveAction) {
      const save = current()
      if (save.phase === 'flight' && save.observation === null && authorized(save) &&
        options.observeAction.some(([id]) => id === action)) update({ observation: action })
    },
    downlink(action: DownlinkAction) {
      const save = current()
      if (!engine || save.phase !== 'flight' || !save.observation || !authorized(save) ||
        !options.downlinkAction.some(([id]) => id === action)) return
      const attempt = engine.simulateMission({
        config: save.config, decisions: { observeAction: save.observation, downlinkAction: action },
        scenarioId: 'lunar_south_pole_ice_v1', modelVersion: engine.modelVersion,
      })
      if (attempt.kind === 'rejected') {
        message(attempt.feasibility.blockers.map(item => item.message).join(' ') || 'The engine rejected this mission.')
        return
      }
      const root = engine.createRootUniverse(attempt, 'A', new Date().toISOString())
      update({ phase: 'debrief', collection: { schemaVersion: 1, rootId: root.id, universes: [root] } })
    },
    finishPlayback() { store.setState({ playback: false }) },
    multiverse() {
      const save = current()
      if (save.phase === 'debrief' && save.collection && !store.getState().playback) update({ phase: 'multiverse' })
    },
    debrief() { if (current().phase === 'multiverse') update({ phase: 'debrief' }) },
    branch(parentId: string, field: MutableField, to: string) {
      const save = current()
      const collection = save.collection
      if (!engine || save.phase !== 'multiverse' || !collection || collection.universes.length >= 8) return
      const parent = collection.universes.find(item => item.id === parentId)
      if (!parent || !options[field].some(([id]) => id === to)) return
      const from = { ...parent.input.config, ...parent.input.decisions }[field]
      if (from === to) return
      const result = engine.branchUniverse(parent, { field, from, to }, collection,
        String.fromCharCode(65 + collection.universes.length), new Date().toISOString())
      if (result.kind === 'rejected') {
        const blockers = result.attempt?.kind === 'rejected'
          ? result.attempt.feasibility.blockers.map(item => item.message) : []
        message([result.reason, ...blockers].join(' '))
        return
      }
      update({ collection: { ...collection, universes: [...collection.universes, result.universe] } })
      return result.universe.id
    },
    reset() {
      try { storage?.removeItem(saveKey) }
      catch { message('Session storage could not be cleared.'); return }
      store.setState({ save: fresh(engine?.modelVersion ?? 'pending'), recovery: undefined, message: undefined, playback: false })
    },
  }
}

export type Game = ReturnType<typeof createGame>
