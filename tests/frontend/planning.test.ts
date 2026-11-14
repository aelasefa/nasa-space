import { expect, it } from 'vitest'
import { initialConfig } from '../../src/app/options'
import { estimateResources, rehearse } from '../../src/app/planning'

it('shows the mass, budget and maneuver trade-off of a direct transfer', () => {
  expect(estimateResources(initialConfig)).toMatchObject({ costBU: 61, launchMassKg: 265, deltaVMarginMps: 50 })
  const direct = { ...initialConfig, trajectoryId: 'direct' as const }
  expect(estimateResources(direct).deltaVMarginMps).toBe(-250)
  expect(estimateResources({ ...direct, propulsionId: 'prop_high' })).toMatchObject({
    costBU: 73, launchMassKg: 310, deltaVMarginMps: 150,
  })
})

it('distinguishes a battery cutoff from a downlink cap in the rehearsal', () => {
  const ice = { ...initialConfig, payloadId: 'ice_spectrometer' as const }
  const lowPower = rehearse(ice, 'observe_full', 'science_first')
  expect(lowPower).toMatchObject({ neededWh: 230, batteryWh: 80, capacity: 60 })
  expect(lowPower.returned).toBeCloseTo(55.88)
  const powered = { ...ice, powerId: 'solar_storage' as const }
  expect(rehearse(powered, 'observe_full', 'science_first')).toMatchObject({ collected: 100, returned: 60 })
  expect(rehearse(powered, 'conserve', 'health_first')).toMatchObject({ neededWh: 60, collected: 50, returned: 36 })
})
