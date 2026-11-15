import type { DownlinkAction, ObserveAction, ResolvedEvent, SpacecraftConfig } from './contracts'
import { label } from './options'
import { points, shadowBeats, shadowEnergy } from './story'

/*
 * Mission Control playback. Every value here is read from, or rebuilt exactly from, the
 * engine's E1 event (battery, keep-alive energy, instrument load, observed fraction) and
 * its collected science. Beats only mark moments inside that result; they never change it.
 * The end of every timeline equals the engine's own end state.
 */

export type ShadowBeatId = 'ingress' | 'progress' | 'cutoff' | 'egress'
export interface ShadowFrame {
  id: ShadowBeatId
  /** Hours since the orbiter entered shadow. */
  at: number
  batteryWh: number
  /** Ice science points on board at this moment. */
  science: number
  scanning: boolean
  tone: 'info' | 'good' | 'warn' | 'bad'
}

export function shadowTimeline(event: ResolvedEvent, hours: number, collected: number): ShadowFrame[] | null {
  const energy = shadowEnergy(event, hours)
  const fraction = event.metrics.observationFraction
  const load = event.metrics.payloadActiveLoadW
  if (!energy || fraction === undefined || load === undefined) return null
  const busW = energy.keepAlive / hours
  // Science recorded by time t, scaled so the last frame equals the engine's collected points.
  const share = (observed: number) => fraction > 0 ? collected * observed / fraction : 0
  const sunlit = share(0.5)
  const ingress: ShadowFrame = { id: 'ingress', at: 0, batteryWh: energy.available, science: event.status === 'bus_energy_failure' ? 0 : sunlit, scanning: event.status !== 'conserved' && event.status !== 'bus_energy_failure', tone: 'info' }
  const mid = hours / 2
  switch (event.status) {
    case 'conserved':
      return [
        { ...ingress, scanning: false },
        { id: 'progress', at: mid, batteryWh: energy.available - busW * mid, science: collected, scanning: false, tone: 'warn' },
        { id: 'egress', at: hours, batteryWh: energy.available - energy.keepAlive, science: collected, scanning: false, tone: 'warn' },
      ]
    case 'science_cutoff': {
      const cutoff = Math.max(0, (energy.available - energy.keepAlive) / load)
      const frames: ShadowFrame[] = [ingress]
      if (cutoff > mid) frames.push({ id: 'progress', at: mid, batteryWh: energy.available - (busW + load) * mid, science: share(0.5 + 0.5 * mid / hours), scanning: true, tone: 'info' })
      frames.push({ id: 'cutoff', at: cutoff, batteryWh: busW * (hours - cutoff), science: collected, scanning: false, tone: 'bad' })
      frames.push({ id: 'egress', at: hours, batteryWh: 0, science: collected, scanning: false, tone: 'warn' })
      return frames
    }
    case 'bus_energy_failure': {
      const empty = Math.min(hours, energy.available / busW)
      return [
        { ...ingress, science: 0 },
        { id: 'cutoff', at: empty, batteryWh: 0, science: 0, scanning: false, tone: 'bad' },
        { id: 'egress', at: hours, batteryWh: 0, science: 0, scanning: false, tone: 'bad' },
      ]
    }
    default:
      return [
        ingress,
        { id: 'progress', at: mid, batteryWh: energy.available - (busW + load) * mid, science: share(0.75), scanning: true, tone: 'info' },
        { id: 'egress', at: hours, batteryWh: energy.available - energy.needed, science: collected, scanning: false, tone: 'good' },
      ]
  }
}

export const clock = (hours: number) => {
  const minutes = Math.round(hours * 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

const wh = (value: number) => `${Math.round(value)} Wh`
const part = (field: 'powerId' | 'payloadId' | 'commsId', config: SpacecraftConfig) => label(field, config[field]).toLowerCase()

/** Amina's read of the hardware before the shadow decision, from the engine's full-observation preview. */
export function shadowBriefing(config: SpacecraftConfig, full: ResolvedEvent, hours: number) {
  const energy = shadowEnergy(full, hours)
  if (config.payloadId !== 'ice_spectrometer') return 'Reminder: the mapping camera can’t see ice. Whatever we do in the dark, no ice data comes home from this pass.'
  if (!energy) return 'The panels go dark in a moment. Your call on the instrument.'
  const load = full.metrics.payloadActiveLoadW ?? 0
  const runtime = load > 0 ? Math.max(0, (energy.available - energy.keepAlive) / load) : hours
  return runtime >= hours
    ? `We’re flying the ${part('powerId', config)} package: ${wh(energy.available)} on board, ${wh(energy.needed)} needed. That carries the spectrometer through the whole pass.`
    : `We’re flying the ${part('powerId', config)} package: ${wh(energy.available)} on board, but a full pass needs ${wh(energy.needed)}. The spectrometer would cut off after about ${clock(runtime)}.`
}

/** Crew line for each shadow beat. */
export function shadowLine(frame: ShadowFrame, status: string, config: SpacecraftConfig, hours: number, target?: string) {
  const over = target ? ` over ${target}` : ''
  switch (frame.id) {
    case 'ingress': return status === 'conserved'
      ? `Entering shadow${over}. Instrument paused; bus systems only.`
      : `Entering shadow${over}. Panels dark, ${wh(frame.batteryWh)} on the battery, instrument running.`
    case 'progress': return status === 'conserved'
      ? `Halfway through the dark. The battery is holding at ${wh(frame.batteryWh)}, but the floor is going unobserved.`
      : `Halfway. ${points(frame.science)} points on board and ${wh(frame.batteryWh)} left.`
    case 'cutoff': return status === 'bus_energy_failure'
      ? `Battery empty. We’re in safe mode.`
      : `Low battery. The ${part('powerId', config)} package is down to its keep-alive reserve, so the instrument just shut off at ${clock(frame.at)}.`
    case 'egress': return `Back in sunlight after ${hours} hours. ${points(frame.science)} points on board.`
  }
}

/** Reyes before the downlink, naming the antenna the player installed. */
export function downlinkBriefing(config: SpacecraftConfig, recorded: number, capacity: number | undefined) {
  if (capacity === undefined) return 'Earth is in view. What goes down first?'
  const antenna = part('commsId', config)
  return capacity < recorded
    ? `Earth is in view. We’re holding ${points(recorded)} points, but the ${antenna} can only push ${points(capacity)} this pass. Science first, or a health report too?`
    : `Earth is in view. The ${antenna} can carry everything we recorded. Science first, or a health report too?`
}

/** Reyes after the downlink, from the engine's E2 result. */
export function downlinkLine(config: SpacecraftConfig, action: string, recorded: number, returned: number, callSign?: string) {
  const who = callSign ? `${callSign}, ` : ''
  if (recorded === 0) return `${who}the link is closed. Nothing on board could answer the ice question.`
  if (returned < recorded) return `${who}Earth has ${points(returned)} of ${points(recorded)} points. The rest is still on board: ${action === 'health_first'
    ? 'the health report took part of the link' : `the ${part('commsId', config)} was the bottleneck`}.`
  return `${who}Earth has all ${points(returned)} points. Let’s see what they show.`
}

/*
 * Event choices. The compact card shows one sentence and the engine's numbers for that
 * choice; the longer reading and the model assumptions sit behind "Show details".
 * These are words only. Every number shown next to them is read from the engine.
 */

/** The main trade-off of each flight choice, in one sentence. True for every design: what it costs this design is in the engine numbers beside it. */
export const tradeoffs: Record<ObserveAction | DownlinkAction, string> = {
  observe_full: 'Keep the sensor on across the dark crater floor, paid for with battery.',
  conserve: 'Pause the sensor in the dark: the battery is protected, but the crater floor goes unobserved.',
  science_first: 'Use the whole link for science data.',
  health_first: 'Share the link with a spacecraft health report, leaving science a smaller share.',
}

/** What the game model assumes for each event (GAME_RULES.md, events E1 and E2). */
export const assumptions = {
  observe: [
    'The first half of the survey is recorded in sunlight before the pass. The shadow pass adds the other half.',
    'The battery keeps the spacecraft alive first. The instrument runs on what is left.',
    'Battery, power draw and science points are illustrative game values, not flight data.',
  ],
  downlink: [
    'There is one downlink window. What does not fit stays on the orbiter.',
    'Health first leaves a smaller share of the link for science. That split is a gameplay trade-off, not a radio model.',
    'The model does not track what the health report is worth, so its only modeled effects are less science and a lower operations score.',
  ],
} as const

/** The longer reading of a shadow-pass choice, from the engine's E1 preview for that choice. */
export function observeDetail(config: SpacecraftConfig, event: ResolvedEvent, hours: number) {
  const beats = shadowBeats(event, hours).beats
  const text = (id: string) => beats.find(beat => beat.id === id)!.text
  return config.payloadId === 'ice_spectrometer' ? `${text('draw')} ${text('science')}`
    : `${text('draw')} The mapping camera can’t detect ice, so no ice points are recorded either way.`
}

/** The longer reading of a downlink choice, from the engine's E2 preview. */
export function downlinkDetail(action: DownlinkAction, recorded: number, sent: number, capacity: number | undefined) {
  const fits = sent >= recorded
  const link = capacity === undefined ? '' : `With this choice the link can carry ${points(capacity)} science points this pass. `
  const result = recorded === 0 ? 'There is no ice data on board to send.'
    : fits ? `All ${points(recorded)} recorded points fit.`
    : `${points(recorded - sent)} of the ${points(recorded)} recorded points stay on the orbiter.`
  return action === 'health_first'
    ? `${link}${result} Training comparison: the health report takes part of the link, and this model does not score what it tells the team.`
    : `${link}${result}`
}
