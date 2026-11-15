// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { footprints, regions, sources } from '../../src/app/regions'
import { saveKey } from '../../src/app/save'
import { fixture } from './engine.fixture'

afterEach(() => { cleanup(); localStorage.clear() })
const flySolo = () => fireEvent.click(screen.getByRole('button', { name: 'Fly solo' }))
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

it('lists exactly NASA’s 13 August 2022 regions, in NASA’s order', () => {
  expect(regions.map(r => r.name)).toEqual([
    'Faustini Rim A', 'Peak Near Shackleton', 'Connecting Ridge', 'Connecting Ridge Extension', 'de Gerlache Rim 1',
    'de Gerlache Rim 2', 'de Gerlache-Kocher Massif', 'Haworth', 'Malapert Massif', 'Leibnitz Beta Plateau',
    'Nobile Rim 1', 'Nobile Rim 2', 'Amundsen Rim',
  ])
  // Exactly the names that reappear in NASA's 28 October 2024 list of nine.
  expect(regions.filter(r => r.in2024List.value).map(r => r.name).sort())
    .toEqual(['Haworth', 'Malapert Massif', 'Nobile Rim 1', 'Nobile Rim 2', 'de Gerlache Rim 2'])
})

it('backs every placed position with an LROC product and keeps it inside its published footprint', () => {
  for (const fp of footprints) {
    const c = fp.center.value!, b = fp.bounds.value!
    expect(fp.center.basis).toBe('derived')
    expect(fp.center.source?.url).toMatch(/^https:\/\/data\.lroc\.im-ldi\.com\/lroc\/view_rdr\/NAC_ROI_/)
    expect(c.lat).toBeGreaterThanOrEqual(b.minLat)
    expect(c.lat).toBeLessThanOrEqual(b.maxLat)
    expect(c.lon).toBeGreaterThanOrEqual(b.minLon)
    expect(c.lon).toBeLessThanOrEqual(b.maxLon)
    // NASA: regions lie within 6° of the pole. Mosaic centers can sit a little outside the region itself.
    expect(c.lat).toBeLessThan(-83.5)
  }
  // Regions without a verified position are marked unknown, never estimated.
  const unplaced = regions.filter(r => !r.footprintId).map(r => r.name)
  expect(unplaced).toEqual(['Connecting Ridge', 'Connecting Ridge Extension', 'Haworth', 'Leibnitz Beta Plateau', 'Nobile Rim 1'])
  for (const source of Object.values(sources)) expect(source.url).toMatch(/^https:\/\//)
})

it('lets the player pick a target from the list, see its sourced facts and carry it into the mission', () => {
  const game = createGame(fixture, localStorage)
  render(<App game={game}/>)
  flySolo()
  click('Take the console')
  expect(screen.getByRole('heading', { name: 'Where should LUNA‑01 look?' })).toBeTruthy()
  expect(screen.getByText(/Historical dataset\./).closest('p')!.textContent).toMatch(/narrowed its list to nine/)
  expect(screen.getByText(/not detected ice deposits/)).toBeTruthy()
  expect(within(screen.getByRole('complementary', { name: 'Candidate regions' })).getAllByRole('listitem')).toHaveLength(13)
  // A first target is recommended with a reason, and is one action away.
  expect(document.querySelector('.recommend')!.textContent).toMatch(/LROC mosaic/)
  expect(screen.getByRole('button', { name: 'Start with Malapert Massif' })).toBeTruthy()

  // A region we couldn't place: selectable, honestly labeled, no invented coordinates.
  click(/^Haworth/)
  expect(screen.getByRole('status').textContent).toMatch(/don’t have a verified position/)
  expect(screen.getAllByText('Position not yet verified').length).toBeGreaterThan(0)

  click(/^Malapert Massif/)
  expect(screen.getByRole('status').textContent).toMatch(/^Malapert Massif: 86\.0° S, 0\.3° E, about 121 km from the pole/)
  const detail = screen.getByRole('region', { name: 'Malapert Massif' })
  expect(within(detail).getByText(/does not change power, data or score/)).toBeTruthy()
  const science = within(detail).getByText('Science behind this').closest('details')!
  for (const basis of ['Official statement', 'Derived from data', 'Unknown', 'Game assumption', 'Fiction']) {
    expect(within(science).getAllByText(basis).length).toBeGreaterThan(0)
  }
  expect(within(science).getAllByRole('link', { name: /LROC team/ })[0].getAttribute('href')).toContain('NAC_ROI_MALAPERTLO1')

  click('Set Malapert Massif as target')
  expect(screen.getByRole('heading', { name: 'Spacecraft builder' })).toBeTruthy()
  expect(screen.getByText('Malapert Massif', { selector: '.screen-target dd' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(saveKey)!).targetId).toBe('malapert_massif')

  // Survives a reload, and the player can go back and change it.
  const reloaded = createGame(fixture, localStorage)
  expect(reloaded.store.getState().save.targetId).toBe('malapert_massif')
  click('Change')
  expect(screen.getByRole('heading', { name: 'Where should LUNA‑01 look?' })).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/confirmed (water-)?ice/i)
})

it('cannot skip target selection and still loads saves made before targets existed', () => {
  const game = createGame(fixture, localStorage)
  game.start()
  game.confirmTarget()
  expect(game.store.getState().save.phase).toBe('target')
  game.chooseTarget('not_a_region' as never)
  expect(game.store.getState().save.targetId).toBeNull()
  const old = { ...game.store.getState().save, phase: 'builder' }
  delete (old as { targetId?: unknown }).targetId
  localStorage.setItem(saveKey, JSON.stringify(old))
  expect(createGame(fixture, localStorage).store.getState().recovery).toBeUndefined()
})
