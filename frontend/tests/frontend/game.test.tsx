// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { saveKey } from '../../src/app/save'
import { fixture } from './engine.fixture'

afterEach(() => { cleanup(); localStorage.clear() })
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const enterBriefing = () => {
  click('Take the console')
  fireEvent.click(screen.getByRole('button', { name: /^Malapert Massif/ }))
  click('Set Malapert Massif as target')
}
const phase = (game: ReturnType<typeof createGame>) => game.store.getState().save.phase

function review(game: ReturnType<typeof createGame>) {
  game.start()
  game.chooseTarget('malapert_massif')
  game.confirmTarget()
  game.saveAlternative()
  game.select('payloadId', 'ice_spectrometer')
  game.select('commsId', 'comms_high')
  game.reviews()
  game.trade('science')
  game.acknowledge('battery_endurance', true)
}
function complete(game: ReturnType<typeof createGame>) {
  review(game)
  game.launch()
  game.observe('observe_full')
  game.downlink('science_first')
  game.finishPlayback()
}

describe('LUNA-01 frontend', () => {
  it('renders a playable flow through all screens with the injected engine contract', () => {
    const game = createGame(fixture, localStorage)
    render(<App game={game}/>)
    enterBriefing()
    expect(screen.getByRole('heading', { name: 'Spacecraft builder' })).toBeTruthy()
    click('Save current design as baseline')
    click('Use the ice spectrometer')
    fireEvent.click(screen.getByRole('radio', { name: 'High-throughput antenna' }))
    expect(game.store.getState().save.config.commsId).toBe('comms_high')
    fireEvent.change(screen.getByLabelText('Why is the current design better?'), { target: { value: 'science' } })
    click('Record decision')
    click('Open engineering review')
    const launch = screen.getByRole<HTMLButtonElement>('button', { name: 'Authorize launch' })
    expect(launch.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Check endurance' }))
    expect(launch.disabled).toBe(false)
    click('Authorize launch')
    expect(screen.queryByRole('button', { name: 'Science first' })).toBeNull()
    click('Full observation')
    click('Science first')
    expect(screen.getByRole('heading', { name: 'Mission debrief' })).toBeTruthy()
    expect(screen.getByText('Stored energy sustained the observation.')).toBeTruthy()
    click('Replay with the basic antenna')
    expect(screen.getByRole('heading', { name: 'Universe A → Universe B' })).toBeTruthy()
    expect(within(screen.getByRole('row', { name: /Science returned/ })).getByText('-40')).toBeTruthy()
    expect(screen.getByText('The basic antenna limited the returned science.')).toBeTruthy()
    expect(game.store.getState().save.collection?.universes[0].input.config.commsId).toBe('comms_high')
  })

  it('rejects out-of-order actions, stale review evidence and rejected branches', () => {
    const game = createGame(fixture)
    game.multiverse()
    game.launch()
    expect(phase(game)).toBe('briefing')
    review(game)
    game.select('powerId', 'solar_storage')
    expect(game.store.getState().save.evidence?.tradeStudy).toBeUndefined()
    game.launch()
    expect(phase(game)).toBe('reviews')
    game.trade('risk')
    game.acknowledge('battery_endurance', true)
    game.launch()
    game.downlink('science_first')
    expect(phase(game)).toBe('flight')
    game.observe('observe_full')
    game.observe('conserve')
    expect(game.store.getState().save.observation).toBe('observe_full')
    game.downlink('science_first')
    expect(phase(game)).toBe('debrief')
    game.multiverse()
    expect(phase(game)).toBe('multiverse')
    expect(game.branch('A', 'powerId', 'solar_light')).toBeUndefined()
    expect(game.store.getState().message).toMatch(/rejects/)
    expect(game.store.getState().save.collection?.universes).toHaveLength(1)
  })

  it('restores an authorized flight and an immutable completed collection, then resets', () => {
    const game = createGame(fixture, localStorage)
    review(game)
    game.launch()
    game.observe('observe_full')
    const resumed = createGame(fixture, localStorage)
    expect(phase(resumed)).toBe('flight')
    resumed.downlink('science_first')
    resumed.finishPlayback()
    resumed.multiverse()
    resumed.branch('A', 'commsId', 'comms_basic')
    const reloaded = createGame(fixture, localStorage)
    expect(reloaded.store.getState().save).toEqual(resumed.store.getState().save)
    reloaded.reset()
    expect(localStorage.getItem(saveKey)).toBeNull()
    expect(phase(reloaded)).toBe('briefing')
  })

  it('preserves corrupt and incompatible saves until an explicit reset', () => {
    const game = createGame(fixture, localStorage)
    complete(game)
    const data = JSON.parse(localStorage.getItem(saveKey)!)
    data.modelVersion = 'previous'
    data.collection.universes[0].input.modelVersion = 'previous'
    localStorage.setItem(saveKey, JSON.stringify(data))
    const incompatible = createGame(fixture, localStorage)
    expect(incompatible.store.getState().recovery).toMatch(/different model version/)
    incompatible.start()
    expect(JSON.parse(localStorage.getItem(saveKey)!).modelVersion).toBe('previous')
    localStorage.setItem(saveKey, '{')
    expect(createGame(fixture, localStorage).store.getState().recovery).toBeTruthy()
    expect(localStorage.getItem(saveKey)).toBe('{')
  })

  it('updates scenario guidance when the player changes the relevant subsystem', () => {
    render(<App game={createGame()}/>)
    enterBriefing()
    fireEvent.click(screen.getByText(/More planning tools/))
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), { target: { value: 'shadow' } })
    expect(screen.getByText(/Lightweight solar has less stored energy/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Solar + storage' }))
    expect(screen.getByText(/gives your spacecraft more energy/)).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), { target: { value: 'solar' } })
    expect(screen.getByText(/basic antenna returns less data/)).toBeTruthy()
  })

  it('allows draft editing while the shared engine is absent and keeps flight locked', () => {
    const game = createGame()
    render(<App game={game}/>)
    enterBriefing()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Open engineering review' }).disabled).toBe(true)
    game.reviews()
    expect(phase(game)).toBe('builder')
  })
})
