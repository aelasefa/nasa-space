import type { ConfigField, SpacecraftConfig } from '../app/contracts'
import { catalog } from '../app/engine'
import type { MissionDefinition, Reference, Spec } from './types'

/*
 * LUNA-01 mission definition: seven build steps over the engine's five real choices.
 *
 * Integrity rules:
 * - Every number shown for a part comes from the engine catalog (illustrative game values).
 * - Real-world examples are general, sourced statements with a NASA link.
 * - Subsystems the engine does not simulate are shown as fixed and say so. They are
 *   never offered as choices.
 */

const nasa = (title: string, url: string): Reference => ({ org: 'NASA', title, url })
const refs = {
  lro: nasa('Lunar Reconnaissance Orbiter mission', 'https://science.nasa.gov/mission/lro/'),
  chandrayaan: nasa('Chandrayaan-1 (carried NASA’s Moon Mineralogy Mapper)', 'https://science.nasa.gov/mission/chandrayaan-1/'),
  moonWater: nasa('Moon water and ices', 'https://science.nasa.gov/moon/moon-water-and-ices/'),
  prospector: nasa('Lunar Prospector mission', 'https://science.nasa.gov/mission/lunar-prospector/'),
  soaStructures: nasa('State of the Art of Small Spacecraft Technology: Structures', 'https://www.nasa.gov/smallsat-institute/sst-soa/structures-materials-and-mechanisms/'),
  soaPower: nasa('State of the Art of Small Spacecraft Technology: Power', 'https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/'),
  soaPropulsion: nasa('State of the Art of Small Spacecraft Technology: In-space propulsion', 'https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion/'),
  soaComms: nasa('State of the Art of Small Spacecraft Technology: Communications', 'https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/'),
  soaThermal: nasa('State of the Art of Small Spacecraft Technology: Thermal control', 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/'),
  soaGnc: nasa('State of the Art of Small Spacecraft Technology: Guidance, navigation and control', 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/'),
}

const illustrative = 'Cost, mass and power figures are illustrative game values, not real hardware data.'

export type Luna01Design = {
  bus: 'standard'; solar: 'compact' | 'extended'; battery: 'small' | 'large'
  propulsion: 'small' | 'large'; antenna: 'low_gain' | 'dish'; instrument: 'camera' | 'spectrometer'
}

function specs(field: ConfigField, id: string): Spec[] {
  const base = (part: { costBU: number; massKg: number }): Spec[] =>
    [{ label: 'Cost', value: `${part.costBU} BU` }, { label: 'Mass', value: `${part.massKg} kg` }]
  switch (field) {
    case 'payloadId': { const p = catalog.payloadId[id as keyof typeof catalog.payloadId]
      return [...base(p), { label: 'Power draw', value: `${p.activeLoadW} W` }, { label: 'Detects ice', value: p.isIceSensitive ? 'Yes' : 'No' }] }
    case 'powerId': { const p = catalog.powerId[id as keyof typeof catalog.powerId]
      return [...base(p), { label: 'Solar power', value: `${p.generationW} W` }, { label: 'Battery', value: `${p.usableBatteryWh} Wh` }] }
    case 'propulsionId': { const p = catalog.propulsionId[id as keyof typeof catalog.propulsionId]
      return [...base(p), { label: 'Delta-v', value: `${p.availableDeltaVMps} m/s` }] }
    case 'commsId': { const p = catalog.commsId[id as keyof typeof catalog.commsId]
      return [...base(p), { label: 'Power draw', value: `${p.downlinkLoadW} W` }, { label: 'Science it can send', value: `${p.maxScienceDownlinkPoints} of 100 points` }] }
    case 'trajectoryId': { const p = catalog.trajectoryId[id as keyof typeof catalog.trajectoryId]
      return [{ label: 'Delta-v needed', value: `${p.requiredDeltaVMps} m/s` }, { label: 'Travel time', value: p.narrativeTravelTime }] }
  }
}

export const luna01: MissionDefinition<Luna01Design> = {
  id: 'luna-01',
  name: 'LUNA‑01',
  specs,
  design: (config: SpacecraftConfig) => ({
    bus: 'standard',
    solar: config.powerId === 'solar_storage' ? 'extended' : 'compact',
    battery: config.powerId === 'solar_storage' ? 'large' : 'small',
    propulsion: config.propulsionId === 'prop_high' ? 'large' : 'small',
    antenna: config.commsId === 'comms_high' ? 'dish' : 'low_gain',
    instrument: config.payloadId === 'ice_spectrometer' ? 'spectrometer' : 'camera',
  }),
  crew: {
    reyes: { id: 'reyes', name: 'Flight Director Reyes', role: 'Flight director', initials: 'FR', tone: '#b0e3d9' },
    chen: { id: 'chen', name: 'Dr. Chen', role: 'Science lead', initials: 'DC', tone: '#f4d78a' },
    amina: { id: 'amina', name: 'Amina', role: 'Systems engineer', initials: 'AM', tone: '#bcd3ff' },
  },
  steps: [
    {
      id: 'bus', label: 'Structure', title: 'The spacecraft body', focus: 'bus', fields: [],
      radio: { from: 'reyes', text: 'Let’s build her. Start with the body. Everything else bolts onto it.' },
      what: 'The frame that everything bolts onto, with the flight computer inside. Engineers call it the bus.',
      why: 'Every other part needs somewhere to attach, and something has to keep the spacecraft running.',
      fixedNote: `LUNA‑01 uses one standard body: ${catalog.bus.massKg} kg, drawing ${catalog.bus.sunlitLoadW} W to stay alive. It is the same for every design, so there is nothing to choose here.`,
      learn: {
        principle: 'Everything you add later counts against two limits: the mass the rocket can lift and the mission budget. The body’s own mass and power use are the starting point of both.',
        examples: [{ text: 'Small spacecraft are built around standard structures that carry the loads of launch and hold every subsystem in place.', source: refs.soaStructures }],
        assumptions: ['One fixed body. Different sizes are not modeled.', illustrative],
      },
    },
    {
      id: 'solar', label: 'Solar', title: 'Solar power', focus: 'solar', fields: ['powerId'],
      what: 'Solar panels turn sunlight into electricity.',
      why: 'In sunlight they run everything on board: the computer, the instrument and the radio.',
      learn: {
        principle: 'Power (watts) is how fast electricity is made or used. The panels must make at least as much as the spacecraft uses at that moment, or the design can’t fly.',
        examples: [{ text: 'NASA’s Lunar Reconnaissance Orbiter has been powered by a solar array in lunar orbit since 2009.', source: refs.lro },
          { text: 'Solar arrays are the main power source for most small spacecraft.', source: refs.soaPower }],
        assumptions: ['In this model the solar panels and the battery come as one package. Choosing here also sets the battery.', illustrative],
      },
    },
    {
      id: 'battery', preview: 'shadow-energy', label: 'Battery', title: 'Battery and energy storage', focus: 'battery', fields: ['powerId'],
      radio: { from: 'amina', text: 'In shadow the solar panels give us nothing. If the battery runs dry, the sensor shuts off and we lose the crater floor, which is exactly where the signal is.' },
      what: 'A battery stores electricity for when the panels are in the dark.',
      why: 'The crater floor you want to study is in shadow. To keep observing there, the spacecraft runs on battery alone for two hours.',
      learn: {
        principle: 'Energy (watt-hours) is power multiplied by time. A 100 W load running for 2 hours uses 200 Wh. If the battery holds less than the pass needs, the instrument shuts off partway.',
        examples: [{ text: 'Spacecraft carry rechargeable batteries to keep operating through eclipses, when their solar arrays get no sunlight.', source: refs.soaPower }],
        assumptions: ['The battery starts the shadow pass full.', 'Recharging after the pass is not modeled.', 'The battery is part of the power package chosen in the Solar step.'],
      },
    },
    {
      id: 'propulsion', label: 'Propulsion', title: 'Propulsion and route', focus: 'propulsion', fields: ['propulsionId', 'trajectoryId'],
      what: 'Thrusters and fuel change the spacecraft’s speed. The route is the path it takes to the Moon.',
      why: 'To stay at the Moon the spacecraft has to brake into orbit. The route decides how much braking and steering that takes.',
      learn: {
        principle: 'Delta-v (“change in velocity”, in m/s) measures how much a spacecraft can speed up or slow down. Your thrusters must provide at least the delta-v the route needs.',
        examples: [{ text: 'Small spacecraft use many kinds of propulsion, from simple cold-gas thrusters to chemical and electric systems, each with different thrust and efficiency.', source: refs.soaPropulsion }],
        assumptions: ['Each propulsion option is a packaged system with a fixed mass and delta-v. Fuel is not tracked separately.', 'Route delta-v and travel times are illustrative. Both routes reach the same observation.', illustrative],
      },
    },
    {
      id: 'comms', label: 'Comms', title: 'Communications', focus: 'antenna', fields: ['commsId'],
      what: 'The antenna and radio that send data back to Earth.',
      why: 'Science only counts once it reaches Earth. A weak link can leave data stuck on the spacecraft.',
      learn: {
        principle: 'A larger, directional antenna focuses the radio signal toward Earth, so more data gets through in the same time. It also weighs more and uses more power.',
        examples: [{ text: 'Communication systems are sized by how much data a mission must return and how far away it is.', source: refs.soaComms },
          { text: 'The Lunar Reconnaissance Orbiter returns its science data from lunar orbit to ground stations on Earth.', source: refs.lro }],
        assumptions: ['The link is modeled as a cap on science points per downlink, not as a radio simulation.', illustrative],
      },
    },
    {
      id: 'science', label: 'Science', title: 'Science instrument', focus: 'instrument', fields: ['payloadId'],
      radio: { from: 'chen', text: 'A camera would give us beautiful maps, but only the spectrometer can test the ice signature.' },
      what: 'The instrument that does the observing. Engineers call it the payload.',
      why: 'It decides what the mission can discover. Only one of these can look for water ice.',
      learn: {
        principle: 'A camera records what the surface looks like. A spectrometer splits light into its colors, including ones we can’t see, and different materials leave different fingerprints in that spectrum.',
        examples: [{ text: 'NASA’s Moon Mineralogy Mapper, a spectrometer aboard India’s Chandrayaan-1, mapped the Moon’s surface composition from orbit.', source: refs.chandrayaan },
          { text: 'Evidence for water ice at the lunar poles comes from several missions and instruments.', source: refs.moonWater }],
        assumptions: ['One instrument per mission. Carrying several is not modeled.', 'Science is counted in game points from 0 to 100, not as real measurements.', illustrative],
      },
    },
    {
      id: 'protection', label: 'Protection', title: 'Protection and control', focus: 'bus', fields: [],
      radio: { from: 'amina', text: 'Thermal control and pointing come with the standard body on this flight. Nothing for you to choose here yet.' },
      what: 'Heaters and insulation keep parts at working temperature. Attitude control keeps the spacecraft pointed. Backup parts take over if something fails.',
      why: 'A spacecraft that overheats, freezes or can’t point at its target can’t do science.',
      fixedNote: 'LUNA‑01’s body includes these systems as standard. This version of the mission model does not simulate them, so there is nothing to choose and they cannot fail in flight.',
      notModeled: ['Thermal control options', 'Attitude control options (reaction wheels, thrusters)', 'Redundancy packages'],
      learn: {
        principle: 'In shadow a spacecraft loses heat to space; in sunlight it can overheat. Reaction wheels spin to turn the spacecraft without using fuel.',
        examples: [{ text: 'Thermal control keeps spacecraft components within their allowed temperature range using insulation, heaters and radiators.', source: refs.soaThermal },
          { text: 'Attitude control systems use sensors and actuators such as reaction wheels to point a spacecraft.', source: refs.soaGnc }],
        assumptions: ['Thermal control, attitude control and redundancy are not simulated in engine v0.1.', 'They are proposed for a future engine version (see docs/ENGINE_V0_2_PROPOSAL.md).'],
      },
    },
  ],
  options: {
    solar_light: { what: 'Small, light solar panels with a small battery.', tradeoff: 'Cheapest and lightest. Less solar power, and the battery is too small for a full shadow pass with the spectrometer.' },
    solar_storage: { what: 'Larger solar panels with a big battery.', tradeoff: 'More power and enough stored energy for the shadow. Costs more and is heavier.' },
    prop_low: { what: 'A small thruster system with a small fuel supply.', tradeoff: 'Light and cheap. Only enough delta-v for the efficient route.' },
    prop_high: { what: 'A larger thruster system with more fuel.', tradeoff: 'Enough delta-v for either route. Heavier and more expensive.' },
    direct: { what: 'The fast route to the Moon.', tradeoff: 'Arrives sooner but needs more braking, so it needs the larger propulsion system.' },
    efficient: { what: 'A slower route that needs less braking.', tradeoff: 'Takes longer. Works with either propulsion system.' },
    comms_basic: { what: 'A simple, small antenna.', tradeoff: 'Light, cheap and low power. Can send at most 60 of 100 science points.' },
    comms_high: { what: 'A dish antenna aimed at Earth.', tradeoff: 'Can send everything you record. Heavier, costs more and draws more power.' },
    mapping_camera: { what: 'A camera that maps the terrain.', tradeoff: 'Cheap, light and low power. It cannot detect ice, so it can’t answer this mission’s question.' },
    ice_spectrometer: { what: 'A spectrometer tuned to the fingerprint of water ice.', tradeoff: 'The only instrument that can do this mission. Heavier, costs more and draws the most power.' },
  },
}
