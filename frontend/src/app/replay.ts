import type { Universe } from './contracts'
import { fields, label } from './options'
import { eventById, points } from './story'

/*
 * Plain-language reading of a one-change replay. Inputs are two completed engine runs;
 * every number quoted is taken from their results.
 */

/** What limits this run now, judged from the engine's event statuses. Null when nothing does. */
export function bottleneck(universe: Universe): string | null {
  const { config, decisions } = universe.input
  const { result } = universe
  const e1 = eventById(result, 'E1')
  const e2 = eventById(result, 'E2')
  const recorded = points(result.collectedSciencePoints)
  if (config.payloadId !== 'ice_spectrometer') return 'The instrument: the mapping camera can’t detect ice, so nothing useful is recorded.'
  if (e1?.status === 'bus_energy_failure') return 'The battery: it couldn’t keep the spacecraft alive through the shadow pass.'
  if (e1?.status === 'science_cutoff') return `The battery: the sensor still cuts off in shadow, so only ${recorded} of 100 points are recorded.`
  if (e1?.status === 'conserved') return `The observation plan: the sensor was paused in shadow, so only ${recorded} of 100 points are recorded.`
  if (e2?.status === 'downlink_limited') {
    const capacity = e2.metrics.scienceDownlinkCapacity
    return decisions.downlinkAction === 'health_first'
      ? `The downlink priority: the health report took part of the link, leaving room for ${points(capacity ?? result.returnedSciencePoints)} points.`
      : `The antenna: the ${label('commsId', config.commsId).toLowerCase()} caps what gets home at ${points(capacity ?? result.returnedSciencePoints)} of ${recorded} recorded points.`
  }
  return null
}

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value))}`

export interface ReplayReading {
  change: string
  scoreDelta: string
  scienceDelta: string
  why: string
  bottleneck: string
}

export function explainReplay(a: Universe, b: Universe): ReplayReading {
  const ra = points(a.result.collectedSciencePoints), rb = points(b.result.collectedSciencePoints)
  const sa = points(a.result.returnedSciencePoints), sb = points(b.result.returnedSciencePoints)
  const capacity = eventById(b.result, 'E2')?.metrics.scienceDownlinkCapacity
  const capped = capacity !== undefined && sb < rb
  const change = b.change ? `${fields[b.change.field]}: ${label(b.change.field, b.change.from)} → ${label(b.change.field, b.change.to)}` : 'No change'
  let why: string
  if (sb > sa) {
    why = rb > ra
      ? capped ? `The change raised recorded science from ${ra} to ${rb} points, but the link can only send ${points(capacity)}, so Earth gained ${sb - sa}.`
        : `The change raised recorded science from ${ra} to ${rb} points, and the link sent all of it home.`
      : `The same ${rb} points were recorded; this time the link sent ${sb} instead of ${sa}.`
  } else if (sb < sa) {
    why = rb < ra ? `The shadow pass recorded less: ${rb} points instead of ${ra}, so Earth received ${sb}.`
      : capped ? `The same ${rb} points were recorded, but the link could only send ${points(capacity)}.`
        : `Earth received ${sb} points instead of ${sa}.`
  } else {
    why = rb !== ra && capped ? `Recorded science changed (${ra} → ${rb} points), but the link capped both runs at ${points(capacity)}, so Earth received the same ${sb}.`
      : rb === 0 ? 'Neither run recorded any ice science, so nothing changed on Earth.'
        : `Earth received the same ${sb} points: this change didn’t touch what was limiting the run.`
  }
  const scoreDelta = b.result.score.mpi - a.result.score.mpi
  if (scoreDelta !== 0 && sb === sa) why += ` The score still moved (${signed(scoreDelta)} MPI) because it also counts what you spent and how the flight went.`
  return {
    change,
    scoreDelta: `${signed(scoreDelta)} MPI`,
    scienceDelta: `${signed(sb - sa)} points`,
    why,
    bottleneck: bottleneck(b) ?? 'None left: every point recorded reached Earth.',
  }
}
