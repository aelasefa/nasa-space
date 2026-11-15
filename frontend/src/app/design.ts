import type { ConfigField, Finding, MissionEngine, PowerId, SpacecraftConfig } from './contracts'
import { catalog, limits, scenario } from './engine'
import { options } from './options'
import { plain, shadowEnergy } from './story'

/*
 * Design-time readings for the builder and the engineering review. Every value comes
 * from the engine (resources, feasibility, review gates, E1 previews) or its catalog.
 */

const blank = (engine: MissionEngine, config: SpacecraftConfig) => ({ configHash: engine.hashConfig(config), acknowledgedWarnings: [] })

/** Blockers (charter + feasibility) and warnings the engine reports for a design, before any review evidence. */
export function designFindings(engine: MissionEngine, config: SpacecraftConfig): Finding[] {
  const feasibility = engine.evaluateFeasibility(config)
  const charter = engine.evaluateReviews(config, blank(engine, config)).gates.CML1.findings
  return [...charter, ...feasibility.blockers, ...feasibility.warnings]
}

export const findingText = (finding: Finding, wording: Partial<Record<string, string>>) => wording[finding.id] ?? plain(finding.message)

/** Findings this option would add compared with the other options for the same part. */
export function optionIssues(engine: MissionEngine, config: SpacecraftConfig, field: ConfigField, id: string): Finding[] {
  const mine = designFindings(engine, { ...config, [field]: id })
  const others = options[field].filter(([other]) => other !== id)
    .map(([other]) => new Set(designFindings(engine, { ...config, [field]: other }).map(item => item.id)))
  return mine.filter(item => !others.every(set => set.has(item.id)))
}

export interface PowerPreview {
  solarW: number
  sunlitLoadW: number
  batteryWh: number
  neededWh: number
  /** Hours the instrument keeps running in shadow on a full observation, capped at the pass length. */
  enduranceH: number
  shadowHours: number
  coverage: number
  sustains: boolean
}

export function powerPreview(engine: MissionEngine, config: SpacecraftConfig, powerId: PowerId): PowerPreview | null {
  const next = { ...config, powerId }
  const event = engine.resolveObservation(next, 'observe_full').event
  const energy = shadowEnergy(event, scenario.shadowHours)
  const load = event.metrics.payloadActiveLoadW
  if (!energy || !load) return null
  return {
    solarW: catalog.powerId[powerId].generationW,
    sunlitLoadW: engine.computeResources(next).sunlitScienceLoadW,
    batteryWh: energy.available, neededWh: energy.needed,
    enduranceH: Math.min(scenario.shadowHours, Math.max(0, (energy.available - energy.keepAlive) / load)),
    shadowHours: scenario.shadowHours,
    coverage: energy.coverage,
    sustains: energy.available >= energy.needed,
  }
}

export interface DesignReading {
  massKg: number
  costBU: number
  batteryWh: number
  shadowNeedWh: number
  coverage: number
  linkPoints: number
  meetsObjective: boolean
}

export function readDesign(engine: MissionEngine, config: SpacecraftConfig): DesignReading {
  const resources = engine.computeResources(config)
  const event = engine.resolveObservation(config, 'observe_full').event
  const energy = shadowEnergy(event, scenario.shadowHours)
  return {
    massKg: resources.launchMassKg, costBU: resources.costBU, batteryWh: resources.batteryWh,
    shadowNeedWh: energy?.needed ?? 0, coverage: energy?.coverage ?? 0,
    linkPoints: catalog.commsId[config.commsId].maxScienceDownlinkPoints,
    meetsObjective: engine.evaluateReviews(config, blank(engine, config)).gates.CML1.passed,
  }
}

const pct = (value: number) => `${Math.round(value * 100)}%`
const share = (value: number, limit: number) => Math.abs(value) / limit

/** One or two plain sentences naming the biggest cost and the biggest gain versus the starter. */
export function tradeTakeaway(starter: DesignReading, mine: DesignReading): string {
  const budget = mine.costBU - starter.costBU
  const mass = mine.massKg - starter.massKg
  const gains: string[] = []
  const losses: string[] = []
  if (mine.meetsObjective !== starter.meetsObjective) (mine.meetsObjective ? gains : losses).push(mine.meetsObjective ? 'an instrument that can detect ice' : 'the ability to detect ice')
  const coverage = `survey coverage through the shadow pass (${pct(starter.coverage)} → ${pct(mine.coverage)})`
  if (mine.coverage > starter.coverage) gains.push(`more ${coverage}`)
  else if (mine.coverage < starter.coverage) losses.push(`some ${coverage}`)
  const link = `link capacity (${starter.linkPoints} → ${mine.linkPoints} of 100 points)`
  if (mine.linkPoints > starter.linkPoints) gains.push(`more ${link}`)
  else if (mine.linkPoints < starter.linkPoints) losses.push(link)
  const costs = [budget ? `${budget > 0 ? '+' : '−'}${Math.abs(budget)} BU (${pct(share(budget, limits.budget))} of the budget)` : '',
    mass ? `${mass > 0 ? '+' : '−'}${Math.abs(mass)} kg` : ''].filter(Boolean)
  const bigger = share(budget, limits.budget) >= share(mass, limits.mass) ? costs : [...costs].reverse()
  const spent = budget > 0 || mass > 0
  let sentence = !costs.length ? 'Same cost and mass as the starter.'
    : spent ? `Biggest trade-off: ${bigger.join(' and ')} buys ${gains.length ? gains.slice(0, 2).join(' and ') : 'nothing the engine measures here'}.`
      : `Your design saves ${bigger.join(' and ').replaceAll('−', '')}${losses.length ? `, but gives up ${losses.slice(0, 2).join(' and ')}` : ''}.`
  if (spent && losses.length) sentence += ` It gives up ${losses[0]}.`
  if (mine.meetsObjective && mine.coverage < 1) sentence += ` Watch out: the battery still can’t cover a full observation (${pct(mine.coverage)}).`
  else if (mine.meetsObjective && mine.linkPoints < 100) sentence += ` Watch out: the link can send only ${mine.linkPoints} of 100 points.`
  return sentence
}
