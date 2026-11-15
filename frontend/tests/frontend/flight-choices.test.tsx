// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import type { SpacecraftConfig } from '../../src/app/contracts'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)

function toOrbit(config: Partial<SpacecraftConfig>) {
  const game = createGame(engine)
  game.start()
  game.chooseTarget('malapert_massif')
  game.confirmTarget()
  game.saveAlternative()
  for (const [field, value] of Object.entries({ payloadId: 'ice_spectrometer', ...config })) game.select(field as keyof SpacecraftConfig, value as never)
  game.trade('science')
  game.reviews()
  for (const warning of engine.evaluateFeasibility(game.store.getState().save.config).warnings) game.acknowledge(warning.id as never, true)
  game.launch()
  render(<App game={game}/>)
  return game
}
const card = (name: string) => screen.getByRole('group', { name })
const details = (name: string) => card(name).querySelector('details')!

it('shows each choice compactly: one trade-off sentence, its engine numbers and a separate commit button', () => {
  toOrbit({ powerId: 'solar_light' })
  for (const name of ['Full observation', 'Conserve battery']) {
    const choice = within(card(name))
    expect(choice.getAllByRole('button')).toHaveLength(1)
    expect(choice.getByRole('button').textContent).toBe(name)
    expect(details(name).open).toBe(false)
    expect(choice.getByText('Show details')).toBeTruthy()
  }
  // Numbers come from the engine: the 80 Wh battery cuts the sensor at 56 points.
  expect(card('Full observation').textContent).toMatch(/Ice points on board\s*56/)
  expect(card('Conserve battery').textContent).toMatch(/Ice points on board\s*50/)
  expect(card('Full observation').textContent).toMatch(/Battery after the pass\s*0/)
})

it('opens and closes details in place without choosing, committing or advancing anything', async () => {
  const user = userEvent.setup()
  const game = toOrbit({ powerId: 'solar_light' })
  const before = JSON.stringify(game.store.getState().save)
  const summary = details('Full observation').querySelector('summary')!

  // The disclosure is a native <details>: its summary is in the tab order, and browsers
  // toggle it with Enter and Space (checked in a real browser; jsdom does not). Keys
  // pressed on it never reach the commit button.
  summary.focus()
  expect(document.activeElement).toBe(summary)
  await user.keyboard('{Enter}')
  await user.keyboard(' ')
  expect(game.store.getState().save.observation).toBeNull()

  await user.click(summary)
  expect(details('Full observation').open).toBe(true)
  expect(within(card('Full observation')).getByText('Hide details')).toBeTruthy()
  expect(within(card('Full observation')).getByRole('heading', { name: 'Model assumptions' })).toBeTruthy()
  expect(card('Full observation').textContent).toMatch(/Engine preview: sensor cut off/)
  expect(details('Conserve battery').open).toBe(false)
  await user.click(summary)
  expect(details('Full observation').open).toBe(false)

  // Pointer / touch: a click on the summary toggles it too.
  await user.click(details('Conserve battery').querySelector('summary')!)
  expect(details('Conserve battery').open).toBe(true)
  await user.click(details('Conserve battery').querySelector('summary')!)
  expect(details('Conserve battery').open).toBe(false)

  expect(JSON.stringify(game.store.getState().save)).toBe(before)
  expect(game.store.getState().save.observation).toBeNull()
  expect(screen.getByRole('heading', { name: /Shadow pass ahead/ })).toBeTruthy()
})

it('commits only from the commit button, with the engine outcome the card showed', () => {
  const game = toOrbit({ powerId: 'solar_storage' })
  fireEvent.click(details('Conserve battery').querySelector('summary')!)
  fireEvent.click(within(card('Conserve battery')).getByRole('button', { name: 'Conserve battery' }))
  expect(game.store.getState().save.observation).toBe('conserve')
  // Without motion (as in jsdom) the shadow pass plays straight to its result.

  const expected = engine.simulateMission({ config: game.store.getState().save.config,
    decisions: { observeAction: 'conserve', downlinkAction: 'health_first' }, scenarioId: 'lunar_south_pole_ice_v1', modelVersion: engine.modelVersion })
  if (expected.kind !== 'completed') throw new Error('engine did not complete')
  expect(card('Health first').textContent).toContain(`Sends ${Math.round(expected.result.returnedSciencePoints)} of`)
  fireEvent.click(details('Health first').querySelector('summary')!)
  expect(card('Health first').textContent).toMatch(/Training comparison/)
  expect(game.store.getState().save.collection).toBeNull()

  fireEvent.click(within(card('Health first')).getByRole('button', { name: 'Health first' }))
  const universe = game.store.getState().save.collection!.universes[0]!
  expect(universe.input.decisions).toEqual({ observeAction: 'conserve', downlinkAction: 'health_first' })
  expect(universe.result.returnedSciencePoints).toBe(expected.result.returnedSciencePoints)
  expect(screen.getByRole('heading', { name: 'Downlink complete' })).toBeTruthy()
})
