import type { DownlinkAction, ObserveAction, ResourceReport, SpacecraftConfig } from './contracts'

// Illustrative planning values from GAME_RULES.md §§2–5. Launch and scored
// results always use the shared mission engine.
export const planningLimits = { budget: 120, mass: 500 }
const payloads = {
  mapping_camera: { cost: 18, mass: 35, load: 35 },
  ice_spectrometer: { cost: 35, mass: 65, load: 85 },
}
const powers = {
  solar_light: { cost: 15, mass: 35, generation: 150, battery: 80 },
  solar_storage: { cost: 30, mass: 75, generation: 190, battery: 400 },
}
const propulsion = {
  prop_low: { cost: 18, mass: 60, capacity: 750 },
  prop_high: { cost: 30, mass: 105, capacity: 1150 },
}
const links = {
  comms_basic: { cost: 10, mass: 15, load: 20, science: 60 },
  comms_high: { cost: 20, mass: 30, load: 40, science: 100 },
}
export const transfers = {
  direct: { hours: 72, required: 1000 },
  efficient: { hours: 120, required: 700 },
}

export function estimateResources(config: SpacecraftConfig): ResourceReport {
  const parts = [payloads[config.payloadId], powers[config.powerId], propulsion[config.propulsionId], links[config.commsId]] as const
  const [payload, power, drive, link] = parts
  const sunlitScienceLoadW = 30 + payload.load
  const downlinkLoadW = 30 + link.load
  return {
    costBU: parts.reduce((sum, part) => sum + part.cost, 0),
    launchMassKg: parts.reduce((sum, part) => sum + part.mass, 120),
    sunlitScienceLoadW,
    sunlitScienceMarginW: power.generation - sunlitScienceLoadW,
    downlinkLoadW,
    sunlitDownlinkMarginW: power.generation - downlinkLoadW,
    deltaVMarginMps: drive.capacity - transfers[config.trajectoryId].required,
    batteryWh: power.battery,
  }
}

export function rehearse(config: SpacecraftConfig, observation: ObserveAction, downlink: DownlinkAction) {
  const resources = estimateResources(config)
  const payload = payloads[config.payloadId]
  const busEnergy = 60
  const neededWh = busEnergy + (observation === 'observe_full' ? payload.load * 2 : 0)
  const fraction = resources.batteryWh < busEnergy ? 0 : observation === 'conserve' ? 0.5 :
    0.5 + 0.5 * Math.min(1, (resources.batteryWh - busEnergy) / (payload.load * 2))
  const collected = config.payloadId === 'ice_spectrometer' ? fraction * 100 : 0
  const capacity = links[config.commsId].science * (downlink === 'science_first' ? 1 : 0.6)
  return { neededWh, batteryWh: resources.batteryWh, collected, capacity, returned: Math.min(collected, capacity) }
}
