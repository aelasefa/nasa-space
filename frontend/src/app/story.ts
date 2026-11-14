import type { MissionResult, MutableField, ResolvedEvent, SpacecraftConfig, Universe } from './contracts'
import { label, options } from './options'

/*
 * Narrative layer. Everything here READS engine results (event statuses, metrics,
 * science points) and turns them into plain language. It never decides an outcome:
 * the engine in backend/src/domain stays the single source of truth.
 */

export const scienceLead = { name: 'Dr. Noor Haddad', role: 'Science lead', initials: 'NH' }

const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`
export const points = (value: number) => Math.round(value)

export const eventById = (result: MissionResult, id: ResolvedEvent['id']) => result.events.find(event => event.id === id)

/** Player-facing names for engine status codes. */
export const statusLabels: Record<string, string> = {
  nominal: 'On plan', arrived: 'Arrived', conserved: 'Paused to save power', science_cutoff: 'Sensor cut off',
  bus_energy_failure: 'Safe mode', downlink_limited: 'Link full',
}
export const statusLabel = (status: string) => statusLabels[status] ?? status.replaceAll('_', ' ')

/** Player-facing names for engine event metrics. */
export const metricLabels: Record<string, [string, (value: number) => string]> = {
  observationFraction: ['Share of the pass observed', pct],
  batteryWh: ['Usable battery', value => `${number(value)} Wh`],
  baseEnergyWh: ['Energy to keep the spacecraft alive', value => `${number(value)} Wh`],
  payloadActiveLoadW: ['Instrument power draw', value => `${number(value)} W`],
  collectedSciencePoints: ['Recorded by the orbiter', value => `${points(value)} points`],
  returnedSciencePoints: ['Received on Earth', value => `${points(value)} points`],
  scienceDownlinkCapacity: ['Link capacity for science', value => `${points(value)} points`],
  deltaVMarginMps: ['Fuel margin (delta-v)', value => `${number(value)} m/s`],
  availableDeltaVMps: ['Fuel available (delta-v)', value => `${number(value)} m/s`],
  requiredDeltaVMps: ['Fuel the route needs (delta-v)', value => `${number(value)} m/s`],
}

/**
 * Replace internal option IDs (e.g. `science_first`) in engine text with their labels.
 * Only snake_case IDs, matched as whole words: single-word IDs such as `direct` or
 * `conserve` are ordinary English and must not be rewritten inside sentences.
 */
export function plain(text: string) {
  let out = text
  for (const list of Object.values(options)) {
    for (const [id, name] of list) {
      if (id.includes('_')) out = out.replace(new RegExp(`\\b${id}\\b`, 'g'), name)
    }
  }
  return out
}

/** Energy picture for the shadow pass, read from the engine's E1 event. */
export function shadowEnergy(event: ResolvedEvent | undefined, hours: number) {
  const m = event?.metrics ?? {}
  if (m.batteryWh === undefined || m.baseEnergyWh === undefined || m.payloadActiveLoadW === undefined) return null
  const needed = m.baseEnergyWh + m.payloadActiveLoadW * hours
  return { available: m.batteryWh, keepAlive: m.baseEnergyWh, needed, coverage: m.observationFraction ?? 0 }
}

export interface ShadowBeat { id: 'entry' | 'draw' | 'science' | 'exit'; title: string; text: string; tone?: 'good' | 'warn' | 'bad' }

/** The four beats of the shadow pass, driven by the engine's E1 result. */
export function shadowBeats(event: ResolvedEvent, hours: number): { beats: ShadowBeat[]; remaining: number | null; battery: number | null } {
  const energy = shadowEnergy(event, hours)
  const fraction = event.metrics.observationFraction ?? 0
  const battery = energy?.available ?? null
  let used: number | null = null
  let science: ShadowBeat
  let draw: string
  switch (event.status) {
    case 'conserved':
      used = energy?.keepAlive ?? null
      draw = energy ? `The instrument is paused. Only the spacecraft’s own systems draw power: ${number(energy.keepAlive)} of ${number(energy.available)} Wh.` :
        'The instrument is paused; only the spacecraft’s own systems draw power.'
      science = { id: 'science', title: 'Crater floor skipped', tone: 'warn',
        text: `No readings in shadow. You keep the ${pct(fraction)} of the survey recorded in sunlight.` }
      break
    case 'science_cutoff':
      used = energy?.available ?? null
      draw = energy ? `The instrument runs on the battery. A full pass needs ${number(energy.needed)} Wh, but only ${number(energy.available)} Wh is on board.` :
        'The instrument runs on the battery, and the battery is running low.'
      science = { id: 'science', title: 'Sensor cut off', tone: 'bad',
        text: `The battery empties partway across the crater floor. The sensor shuts off with ${pct(fraction)} of the survey recorded.` }
      break
    case 'bus_energy_failure':
      used = energy?.available ?? null
      draw = 'The battery can’t even keep the spacecraft’s own systems alive through the dark.'
      science = { id: 'science', title: 'Safe mode', tone: 'bad', text: 'The spacecraft drops into safe mode. Nothing is recorded.' }
      break
    default:
      used = energy?.needed ?? null
      draw = energy ? `The instrument runs on the battery: ${number(energy.needed)} of ${number(energy.available)} Wh used across the pass.` :
        'The instrument runs on the battery for the whole pass.'
      science = { id: 'science', title: 'Full survey recorded', tone: 'good',
        text: 'The sensor keeps reading all the way across the crater floor. The orbiter now holds the whole dataset.' }
  }
  return {
    battery,
    remaining: battery !== null && used !== null ? Math.max(0, battery - used) : null,
    beats: [
      { id: 'entry', title: 'Entering shadow', text: `The orbiter crosses into the Moon’s shadow for ${hours} hours. The solar panels go dark.` },
      { id: 'draw', title: 'Running on battery', text: draw },
      science,
      { id: 'exit', title: 'Back in sunlight', text: 'The panels wake up. Time to call home with what we recorded.' },
    ],
  }
}

/** What the science lead says right after the shadow pass. */
export function shadowLeadLine(status: string) {
  switch (status) {
    case 'conserved': return 'We played it safe. The rim data is solid, but the floor is where the signal was, and we didn’t look.'
    case 'science_cutoff': return 'We lost the sensor halfway across the floor. What we have is real, but it’s only part of the picture.'
    case 'bus_energy_failure': return 'We’ve got nothing from this pass. Let’s understand why before we try again.'
    default: return 'That’s the full crater floor on board. Now we have to get it home.'
  }
}

/** Opening sentence of the debrief: what happened, in plain language. */
export function headline(result: MissionResult, config: SpacecraftConfig) {
  const recorded = points(result.collectedSciencePoints)
  const received = points(result.returnedSciencePoints)
  const e1 = eventById(result, 'E1')
  const e2 = eventById(result, 'E2')
  const link = e2?.metrics.scienceDownlinkCapacity
  let first: string
  if (config.payloadId !== 'ice_spectrometer') first = 'The camera mapped the terrain, but it can’t detect ice, so no ice data was recorded.'
  else if (e1?.status === 'bus_energy_failure') first = 'The battery couldn’t keep the spacecraft running in shadow, so nothing was recorded.'
  else if (e1?.status === 'science_cutoff') first = `The battery ran out partway through the shadow pass. We recorded ${recorded} of 100 points.`
  else if (e1?.status === 'conserved') first = `We paused the instrument in shadow to protect the battery. We recorded ${recorded} of 100 points.`
  else first = 'We collected the full dataset.'
  let second = ''
  if (recorded > 0) {
    if (received < recorded) {
      second = link !== undefined
        ? `The link could only send ${received} of ${recorded} points to Earth.`
        : `Only ${received} of ${recorded} points reached Earth.`
    } else second = recorded === 100 ? 'All of it reached Earth.' : `All ${recorded} points reached Earth.`
  }
  return [first, second].filter(Boolean).join(' ')
}

/** What the returned data lets the team say, and what stays uncertain. A score is never proof. */
export function findings(result: MissionResult) {
  const received = points(result.returnedSciencePoints)
  if (received === 0) return {
    learned: 'Earth received no ice data from this pass.',
    uncertain: 'The question is exactly where it started: the earlier signature is still unconfirmed.',
  }
  if (received >= 80) return {
    learned: `With ${received} of 100 points home, the team can check the signature across almost the whole crater floor. It holds up: the readings are consistent with water ice.`,
    uncertain: 'Consistent is not proven. This is one instrument on one pass. It can’t say how much ice there is or rule out other materials with a similar signature. That needs follow-up observations.',
  }
  return {
    learned: `The team can see the signature in the ${received} points that arrived, so the earlier detection wasn’t a one-off.`,
    uncertain: `${100 - received} points of the survey are missing. Without them, the team can’t tell whether the signal covers the crater floor or is a local effect, and it is not proof of ice.`,
  }
}

export function debriefLeadLine(result: MissionResult) {
  const received = points(result.returnedSciencePoints)
  if (received >= 80) return 'This is the dataset we hoped for. I’ll still want a second look before anyone writes “ice” in a headline.'
  if (received > 0) return 'We have enough to know it’s worth chasing, not enough to say what it is.'
  return 'No data, no answer. The good news is we know which choice to change.'
}

export interface Recommendation { field: MutableField; to: string; action: string; why: string }

/** One useful replay, based on what actually limited this run (engine statuses only). */
export function recommend(universe: Universe): Recommendation | null {
  const { config, decisions } = universe.input
  const { result } = universe
  const e1 = eventById(result, 'E1')
  const e2 = eventById(result, 'E2')
  const go = (field: MutableField, to: string, why: string): Recommendation =>
    ({ field, to, why, action: `Replay with ${field === 'commsId' ? 'the ' : ''}${label(field, to).toLowerCase().replace(/^ice/, 'the ice')}` })
  if (config.payloadId !== 'ice_spectrometer')
    return go('payloadId', 'ice_spectrometer', 'The camera can’t detect ice, so there was nothing to send home.')
  if ((e1?.status === 'science_cutoff' || e1?.status === 'bus_energy_failure') && config.powerId === 'solar_light')
    return go('powerId', 'solar_storage', 'The battery ran out in shadow and the sensor shut off. A bigger battery could keep it running.')
  if (e1?.status === 'conserved' && decisions.observeAction === 'conserve')
    return go('observeAction', 'observe_full', 'You paused the instrument over the crater floor. See whether the battery could have kept it running.')
  if (e2?.status === 'downlink_limited') {
    const stuck = points(result.collectedSciencePoints - result.returnedSciencePoints)
    if (decisions.downlinkAction === 'health_first')
      return go('downlinkAction', 'science_first', `${stuck} points stayed on board because part of the link carried diagnostics.`)
    if (config.commsId === 'comms_basic')
      return go('commsId', 'comms_high', `Bandwidth was the bottleneck: ${stuck} recorded points never reached Earth.`)
  }
  if (config.commsId === 'comms_high')
    return go('commsId', 'comms_basic', 'Everything came home. Would a cheaper, lighter antenna still have done the job?')
  return null
}
