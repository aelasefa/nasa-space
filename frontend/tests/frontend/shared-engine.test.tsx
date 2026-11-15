// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)

it('runs the judge demo with the real shared domain engine', () => {
  const game = createGame(engine)
  const flySolo = () => fireEvent.click(screen.getByRole('button', { name: 'Fly solo' }))
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  render(<App game={game}/>)
  flySolo()
  click('Take the console')
  fireEvent.click(screen.getByRole('button', { name: /^Malapert Massif/ }))
  click('Set Malapert Massif as target')
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Ice-sensitive spectrometer' }))
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Solar + storage' }))
  click('Continue')
  click('Back')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Solar + storage' }).checked).toBe(true)
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Direct transfer' }))
  expect(screen.getAllByText(/Not enough delta-v for the selected route/).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('radio', { name: 'High reserve' }))
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'High-throughput antenna' }))
  click('Continue')
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
  click('Open engineering review')
  fireEvent.click(screen.getByRole('radio', { name: 'Scientific return' }))
  click('Record trade study')
  for (const warning of screen.queryAllByRole('checkbox')) fireEvent.click(warning)
  click('Authorize launch')
  click('Full observation')
  click('Science first')
  click('Open debrief')
  expect(game.store.getState().save.collection?.universes[0].result.outcome).toBe('success')
  click('Replay with the basic antenna')
  const [a, b] = game.store.getState().save.collection!.universes
  expect(b.parentId).toBe(a.id)
  expect(b.result.outcome).toBe('partial')
  expect(within(screen.getByRole('row', { name: /Science returned/ })).getByText('-40')).toBeTruthy()
})
