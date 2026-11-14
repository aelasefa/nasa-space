// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import type { DownlinkAction, ObserveAction, SpacecraftConfig } from '../../src/app/contracts'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

function reachBuilder() {
  const game = createGame(engine)
  render(<App game={game}/>)
  click('Take the console')
  fireEvent.click(screen.getByRole('button', { name: /^Malapert Massif/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Set Malapert Massif as target' }))
  return game
}

/** Drive a whole mission through the real engine, then show the given screen. */
function fly(config: Partial<SpacecraftConfig>, observe: ObserveAction, downlink?: DownlinkAction) {
  const game = createGame(engine)
  game.start()
  game.chooseTarget('malapert_massif')
  game.confirmTarget()
  game.saveAlternative()
  for (const [field, value] of Object.entries({ payloadId: 'ice_spectrometer', ...config })) {
    game.select(field as keyof SpacecraftConfig, value as never)
  }
  game.trade('science')
  game.reviews()
  for (const warning of engine.evaluateFeasibility(game.store.getState().save.config).warnings) {
    game.acknowledge(warning.id as never, true)
  }
  game.launch()
  expect(game.store.getState().save.phase).toBe('flight')
  game.observe(observe)
  if (downlink) game.downlink(downlink)
  render(<App game={game}/>)
  return game
}
const lead = () => screen.getByText((_, el) => el?.classList.contains('debrief-headline') ?? false).textContent

it('teaches the builder through the shadow power tradeoff, with engine numbers', () => {
  const game = reachBuilder()
  const tradeoff = screen.getByRole('region', { name: 'Can we afford to stay awake in shadow?' })
  click('Use the ice spectrometer')
  expect(game.store.getState().save.config.payloadId).toBe('ice_spectrometer')
  // 80 Wh battery vs 60 Wh keep-alive + 85 W × 2 h = 230 Wh needed; engine says 56% of the survey.
  expect(within(tradeoff).getAllByText('80 Wh')).toHaveLength(1)
  expect(within(tradeoff).getAllByText('230 Wh')).toHaveLength(2)
  expect(within(tradeoff).getByText('56%')).toBeTruthy()
  expect(within(tradeoff).getByText(/\+15 BU and \+40 kg over lightweight solar/)).toBeTruthy()

  click('Save current design as baseline')
  click('Install solar + storage')
  fireEvent.change(screen.getByLabelText('Why is the current design better?'), { target: { value: 'science' } })
  click('Record decision')
  expect(within(tradeoff).getByText(/Decision recorded: scientific return/)).toBeTruthy()
  click('Open engineering review')
  const gate = screen.getByText('CML3 · Trade study').closest('li')!
  expect(within(gate).getByText('Passed')).toBeTruthy()
})

it('explains jargon inline and in the how-to-play guide', () => {
  reachBuilder()
  const help = screen.getAllByRole('button', { name: 'What is Budget units (BU)?' })[0]
  fireEvent.click(help)
  expect(help.getAttribute('aria-expanded')).toBe('true')
  expect(document.getElementById(help.getAttribute('aria-describedby')!)!.textContent).toContain('120 BU')
  click('How to play')
  expect(screen.getByRole('dialog', { name: 'How LUNA‑01 works' }).textContent).toContain('Delta-v')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('shows what each downlink priority would send before committing', () => {
  fly({ powerId: 'solar_storage' }, 'observe_full')
  expect(screen.getByRole('heading', { name: /what do we send first/ })).toBeTruthy()
  const science = document.getElementById('choice-science_first')!.textContent
  const health = document.getElementById('choice-health_first')!.textContent
  expect(science).toContain('Sends 60 of 100')
  expect(health).toContain('Sends 36 of 100')
  expect(health).toContain('Training comparison')
})

it('clean pass: full dataset home, outcome before score, and no claim of proof', () => {
  fly({ powerId: 'solar_storage', commsId: 'comms_high' }, 'observe_full', 'science_first')
  expect(lead()).toBe('We collected the full dataset. All of it reached Earth.')
  expect(screen.getByText(/consistent with water ice/)).toBeTruthy()
  expect(screen.getByText(/Consistent is not proven/)).toBeTruthy()
  const order = [...document.querySelectorAll('.debrief-headline, .result-strip')].map(el => el.className)
  expect(order[0]).toContain('debrief-headline')
  expect(screen.getByRole('button', { name: 'Replay with the basic antenna' })).toBeTruthy()
})

it('battery cutoff: the sensor shuts off and the replay suggests a bigger battery', () => {
  fly({ powerId: 'solar_light' }, 'observe_full', 'science_first')
  expect(lead()).toMatch(/^The battery ran out partway through the shadow pass\. We recorded 56 of 100 points\./)
  click('Replay with solar + storage')
  expect(screen.getByRole('heading', { name: 'Universe A → Universe B' })).toBeTruthy()
  const first = screen.getByText('First difference').closest('p')!.textContent
  expect(first).toContain('Shadow pass')
  expect(first).toMatch(/Sensor cut off in Universe A → On plan in Universe B/)
})

it('limited downlink: the link is the bottleneck and one replay gets everything home', () => {
  const game = fly({ powerId: 'solar_storage' }, 'observe_full', 'science_first')
  expect(lead()).toBe('We collected the full dataset. The link could only send 60 of 100 points to Earth.')
  expect(screen.getByText(/Bandwidth was the bottleneck: 40 recorded points never reached Earth/)).toBeTruthy()
  click('Replay with the high-throughput antenna')
  const [a, b] = game.store.getState().save.collection!.universes
  expect(b.parentId).toBe(a.id)
  expect(b.result.returnedSciencePoints).toBe(100)
  const summary = document.querySelector('.compare-summary')!
  expect(summary.textContent).toContain('Science downlink')
  expect(summary.textContent).toContain('+40 points')
  expect(summary.textContent).toContain('+10 BU')
  expect(document.body.textContent).not.toMatch(/science_first|collectedSciencePoints|returnedSciencePoints/)
})

it('frames health first honestly in the debrief', () => {
  fly({ powerId: 'solar_storage' }, 'observe_full', 'health_first')
  expect(screen.getByText(/doesn’t track what they tell the team/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Replay with science first' })).toBeTruthy()
})

it('charts the score below the explanation', () => {
  fly({ powerId: 'solar_storage', commsId: 'comms_high' }, 'observe_full', 'science_first')
  expect(screen.getByRole('heading', { name: 'Where your score came from' })).toBeTruthy()
  expect(screen.getByLabelText(/^Science returned: 400 \/ 400/)).toBeTruthy()
  expect(screen.getByLabelText(/^Sent to Earth: 100/)).toBeTruthy()
  expect(screen.getByLabelText(/^Budget: \d+ \/ 120 BU/)).toBeTruthy()
})
