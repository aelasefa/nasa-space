import { createStore } from 'zustand/vanilla'
import type { ConfigField, DownlinkAction, ObserveAction, SpacecraftConfig, TradeStudyEvidence, WarningId } from '../contracts'
import type { Game } from '../controller'
import { engine } from '../engine'
import { initialConfig } from '../options'
import type { RegionId } from '../regions'
import type { Save } from '../save'
import type { PublicRoom } from '../../../../backend/src/multiplayer/contracts'
import type { MultiplayerClient } from './client'

type Runtime = { save: Save; recovery?: string; message?: string; playback: boolean }

function phaseOf(room: PublicRoom): Save['phase'] {
  switch (room.phase) {
    case 'lobby': return 'briefing'
    case 'target': return 'target'
    case 'builder': return 'builder'
    case 'reviews': return 'reviews'
    case 'flight':
    case 'voting': return 'flight'
    case 'debrief': return 'debrief'
    case 'closed': return 'debrief'
    default: {
      const _exhaustive: never = room.phase
      return _exhaustive
    }
  }
}

function collectionFromResult(room: PublicRoom): Save['collection'] {
  const result = room.result as null | { kind: string; input?: unknown; result?: unknown }
  if (!result || result.kind !== 'completed') return null
  const root = engine.createRootUniverse(result as Parameters<typeof engine.createRootUniverse>[0], 'A', new Date().toISOString())
  return { schemaVersion: 1, rootId: root.id, universes: [root] }
}

export function roomToSave(room: PublicRoom): Save {
  return {
    schemaVersion: 1,
    modelVersion: engine.modelVersion,
    phase: phaseOf(room),
    targetId: (room.targetId as RegionId | null) ?? null,
    config: room.config,
    alternative: room.alternative,
    evidence: room.evidence ? {
      configHash: room.evidence.configHash,
      acknowledgedWarnings: room.evidence.acknowledgedWarnings,
      ...(room.evidence.tradeStudy ? { tradeStudy: room.evidence.tradeStudy } : {}),
    } : null,
    observation: room.observation,
    collection: room.phase === 'debrief' || room.phase === 'closed' ? collectionFromResult(room) : null,
  }
}

/** Game-shaped adapter: mutations go to the server; store mirrors confirmed room state. */
export function createMultiplayerGame(client: MultiplayerClient): Game {
  const store = createStore<Runtime>(() => ({
    save: {
      schemaVersion: 1, modelVersion: engine.modelVersion, phase: 'briefing',
      targetId: null, config: initialConfig, alternative: null, evidence: null,
      observation: null, collection: null,
    },
    playback: false,
  }))

  const sync = () => {
    const room = client.room
    if (!room) return
    const save = roomToSave(room)
    const playback = room.phase === 'voting' && room.vote?.kind === 'downlink' && Boolean(room.observation)
    store.setState({ save, message: client.lastError ?? undefined, playback: Boolean(playback && !save.collection) })
  }
  client.subscribe(sync)
  sync()

  const rev = () => client.room?.revision ?? 0
  const you = () => client.room?.you

  return {
    store,
    engine,
    start() { /* lobby → target via set_target */ },
    chooseTarget(id) {
      client.send({ type: 'set_target', targetId: id })
    },
    confirmTarget() {
      client.send({ type: 'confirm_target' })
    },
    retarget() { /* not modeled mid-mission in mp */ },
    select<K extends ConfigField>(field: K, value: SpacecraftConfig[K]) {
      client.send({ type: 'select_field', field, value: String(value), baseRevision: rev() })
    },
    saveAlternative() { client.send({ type: 'save_alternative' }) },
    baselineStarter() { /* server seeds alternative at create */ },
    builder() { /* reviews → builder happens when design edits invalidate */ },
    reviews() { client.send({ type: 'advance_reviews' }) },
    trade(rationale: TradeStudyEvidence['rationale']) {
      client.send({ type: 'record_trade', rationale, baseRevision: rev() })
    },
    acknowledge(id: WarningId, checked: boolean) {
      client.send({ type: 'ack_warning', warningId: id, acknowledged: checked, baseRevision: rev() })
    },
    launch() {
      if (!you()?.canLaunch) {
        store.setState({ message: 'Only the Commander can authorize launch.' })
        return
      }
      client.send({ type: 'set_ready', ready: true })
      client.send({ type: 'launch', baseRevision: rev() })
    },
    observe(action: ObserveAction) {
      client.send({ type: 'cast_vote', kind: 'observe', choice: action, baseRevision: rev() })
    },
    downlink(action: DownlinkAction) {
      client.send({ type: 'cast_vote', kind: 'downlink', choice: action, baseRevision: rev() })
    },
    finishPlayback() { store.setState({ playback: false }) },
    multiverse() {
      const save = store.getState().save
      if (save.phase === 'debrief' && save.collection) {
        store.setState({ save: { ...save, phase: 'multiverse' }, playback: false })
      }
    },
    debrief() {
      const save = store.getState().save
      if (save.phase === 'multiverse') store.setState({ save: { ...save, phase: 'debrief' } })
    },
    branch(parentId, field, to) {
      // Local-only Multiverse after shared debrief — use solo Game logic via engine
      const save = store.getState().save
      const collection = save.collection
      if (!collection || collection.universes.length >= 8) return
      const parent = collection.universes.find(item => item.id === parentId)
      if (!parent) return
      const from = { ...parent.input.config, ...parent.input.decisions }[field]
      if (from === to) return
      const result = engine.branchUniverse(parent, { field, from, to }, collection,
        String.fromCharCode(65 + collection.universes.length), new Date().toISOString())
      if (result.kind === 'rejected') {
        const blockers = result.attempt?.kind === 'rejected'
          ? result.attempt.feasibility.blockers.map(item => item.message) : []
        store.setState({ message: [result.reason, ...blockers].join(' ') })
        return
      }
      store.setState({
        save: { ...save, collection: { ...collection, universes: [...collection.universes, result.universe] } },
      })
      return result.universe.id
    },
    reset() {
      client.send({ type: 'leave' })
      client.disconnect(true)
      store.setState({
        save: {
          schemaVersion: 1, modelVersion: engine.modelVersion, phase: 'briefing',
          targetId: null, config: initialConfig, alternative: null, evidence: null,
          observation: null, collection: null,
        },
        message: undefined, playback: false,
      })
    },
  }
}
