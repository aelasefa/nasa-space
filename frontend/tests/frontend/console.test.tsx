// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import type { SpacecraftConfig } from '../../src/app/contracts'
import { createGame } from '../../src/app/controller'
import { catalog, engine } from '../../src/app/engine'
import { initialConfig } from '../../src/app/options'
import { luna01 } from '../../src/missions/luna01'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const flySolo = () => fireEvent.click(screen.getByRole('button', { name: 'Fly solo' }))
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const heading = () => document.querySelector('.assembly-card h2')!.textContent
const stepTitle = (label: string) => luna01.steps.find(step => step.label === label)!.title

function reachBuilder() {
  const game = createGame(engine)
  render(<App game={game}/>)
  flySolo()
  click('Take the console')
  click('Start with Malapert Massif')
  click('Set Malapert Massif as target')
  return game
}
function design(game: ReturnType<typeof createGame>, config: Partial<SpacecraftConfig>) {
  act(() => { for (const [field, value] of Object.entries(config)) game.select(field as keyof SpacecraftConfig, value as never) })
}

it('has one Power step, no review step, and flags the mapping camera before the player reaches it', () => {
  const game = reachBuilder()
  const steps = within(screen.getByRole('navigation', { name: 'Assembly progress' })).getAllByRole('button').map(button => button.textContent)
  expect(steps.join(' ')).toMatch(/Structure.*Science.*Power.*Propulsion.*Comms.*Protection/)
  expect(steps.join(' ')).not.toMatch(/Solar|Battery|Review/)
  expect(screen.queryByRole('button', { name: 'Review design' })).toBeNull()

  // Step 1 already shows the instrument blocker, with a link to the step that fixes it.
  const check = screen.getByRole('region', { name: 'Launch check' })
  expect(check.textContent).toMatch(/Can’t detect ice/)
  fireEvent.click(within(check).getByRole('button', { name: 'Fix in Science' }))
  expect(heading()).toBe(stepTitle('Science'))
  const camera = document.getElementById('payloadId-mapping_camera-details')!.closest('.option-card')!
  expect(camera.textContent).toContain('Blocks launch')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Mapping camera' }).disabled).toBe(false)
  fireEvent.click(screen.getByRole('radio', { name: 'Ice-sensitive spectrometer' }))
  expect(within(check).queryByText(/Can’t detect ice/)).toBeNull()
  expect(game.store.getState().save.config.payloadId).toBe('ice_spectrometer')
})

it('opens a standalone review whose charts match the engine, with the starter as baseline', () => {
  const game = reachBuilder()
  design(game, { payloadId: 'ice_spectrometer', powerId: 'solar_storage' })
  click(/^Protection/)
  click('Open engineering review')
  expect(screen.getAllByRole('heading', { name: 'Engineering review' })).toHaveLength(1)
  expect(screen.getAllByRole('heading', { name: 'Trade study: starter vs. your design' })).toHaveLength(1)
  expect(screen.getAllByRole('heading', { name: /Accept remaining warnings/ })).toHaveLength(1)
  expect(screen.getAllByRole('heading', { name: 'Design summary' })).toHaveLength(1)

  const chart = (name: string) => [...screen.getByRole('figure', { name: new RegExp(name) }).querySelectorAll('.pair-value')].map(el => el.textContent)
  const starter = engine.computeResources(initialConfig)
  const mine = engine.computeResources(game.store.getState().save.config)
  expect(chart('Launch mass')).toEqual([`${starter.launchMassKg} kg`, `${mine.launchMassKg} kg`])
  expect(chart('Budget')).toEqual([`${starter.costBU} BU`, `${mine.costBU} BU`])
  // Shadow demand: 60 Wh keep-alive + instrument load × 2 h (camera 35 W, spectrometer 85 W).
  expect(chart('Battery vs. shadow demand')).toEqual([`${starter.batteryWh} of 130 Wh needed`, `${mine.batteryWh} of 230 Wh needed`])
  const link = catalog.commsId.comms_basic.maxScienceDownlinkPoints
  expect(chart('Downlink capacity')).toEqual([`${link} of 100 points`, `${link} of 100 points`])
  expect(screen.getByText(/Biggest trade-off/)).toBeTruthy()

  // One action records the trade study once a reason is chosen.
  const record = screen.getByRole<HTMLButtonElement>('button', { name: 'Record trade study' })
  expect(record.disabled).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: 'Scientific return' }))
  click('Record trade study')
  expect(screen.getByText('Recorded: Scientific return.')).toBeTruthy()
  expect(within(screen.getByText('CML3 · Trade study').closest('li')!).getByText('Passed')).toBeTruthy()
})

it('says what to do when the design is still the starter', () => {
  reachBuilder()
  click(/^Protection/)
  click('Open engineering review')
  expect(screen.getByText(/identical to the starter/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Record trade study' })).toBeNull()
  click('Go to Science')
  expect(heading()).toBe(stepTitle('Science'))
})

it('sends each review blocker to the step that fixes it and keeps the design', () => {
  const game = reachBuilder()
  design(game, { payloadId: 'ice_spectrometer', trajectoryId: 'direct' })
  click(/^Protection/)
  click('Open engineering review')
  const gate = screen.getByText('CML2 · Feasibility').closest('li')!
  expect(gate.textContent).toMatch(/Not enough delta-v/)
  fireEvent.click(within(gate).getByRole('button', { name: 'Fix in Propulsion' }))
  expect(heading()).toBe(stepTitle('Propulsion'))
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Direct transfer' }).checked).toBe(true)
  expect(game.store.getState().save.config.payloadId).toBe('ice_spectrometer')
  fireEvent.click(screen.getByRole('radio', { name: 'High reserve' }))
  click('Continue')
  click('Continue')
  click('Open engineering review')
  expect(within(screen.getByText('CML2 · Feasibility').closest('li')!).getByText('Passed')).toBeTruthy()
})

function toOrbit(config: Partial<SpacecraftConfig>) {
  const game = createGame(engine)
  game.start()
  game.chooseTarget('malapert_massif')
  game.confirmTarget()
  game.saveAlternative()
  game.select('payloadId', 'ice_spectrometer')
  for (const [field, value] of Object.entries(config)) game.select(field as keyof SpacecraftConfig, value as never)
  game.trade('science')
  game.reviews()
  for (const warning of engine.evaluateFeasibility(game.store.getState().save.config).warnings) game.acknowledge(warning.id as never, true)
  game.launch()
  render(<App game={game} />)
  return game
}

it('plays the shadow pass beat by beat from the engine result, and it can be skipped', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.useFakeTimers()
  toOrbit({ powerId: 'solar_light' })
  expect(screen.getByRole('heading', { name: /Shadow pass ahead/ })).toBeTruthy()
  expect(document.querySelector('.beat-card')!.textContent).toMatch(/80 Wh/)
  click('Full observation')
  expect(screen.getByRole('heading', { name: 'Shadow ingress' })).toBeTruthy()
  // The 80 Wh battery cuts the sensor at 14 min, before any mid-pass beat.
  act(() => { vi.advanceTimersByTime(1800) })
  expect(screen.getByRole('heading', { name: 'Low battery: instrument cutoff' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Observing the crater floor' })).toBeNull()
  expect(document.querySelector('.shadow-hud')!.textContent).toMatch(/Battery remaining\s*53 \/ 80 Wh/)
  click('Skip to result')
  expect(screen.getByRole('heading', { name: 'Downlink window: what do we send first?' })).toBeTruthy()
  expect(document.querySelector('.shadow-hud')!.textContent).toMatch(/Ice science on board\s*56/)
})

it('only calls a battery cutoff when the run has one', () => {
  toOrbit({ powerId: 'solar_storage' })
  click('Full observation')
  expect(document.body.textContent).not.toMatch(/Low battery|Battery empty/)
  expect(document.body.textContent).toMatch(/Back in sunlight/)
  click('Science first')
  expect(screen.getByRole('heading', { name: 'Downlink complete' })).toBeTruthy()
  click('Open debrief')
  expect(screen.getByRole('heading', { name: 'What Earth learned' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: /still uncertain/ })).toBeTruthy()
})
