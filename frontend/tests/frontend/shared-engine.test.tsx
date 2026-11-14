// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)

it('runs the judge demo with the real shared domain engine', () => {
  const game = createGame(engine)
  render(<App game={game}/>)
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  click('Take the console')
  fireEvent.click(screen.getByRole('button', { name: /^Malapert Massif/ }))
  click('Set Malapert Massif as target')
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Solar + storage' }))
  click('Continue')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Solar + storage' }).checked).toBe(true)
  click('Back')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Solar + storage' }).checked).toBe(true)
  click('Continue')
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Direct transfer' }))
  expect(screen.getByText(/Propulsion maneuver capacity/i, { selector: '.findings li' })).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'High reserve' }))
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'High-throughput antenna' }))
  click('Continue')
  fireEvent.click(screen.getByRole('radio', { name: 'Ice-sensitive spectrometer' }))
  click('Continue')
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
  click('Continue')
  fireEvent.change(screen.getByLabelText('Reason for choosing the current design'), { target: { value: 'science' } })
  click('Record decision')
  click('Open engineering review')
  for (const warning of screen.queryAllByRole('checkbox')) fireEvent.click(warning)
  click('Authorize launch')
  click('Full observation')
  click('Science first')
  expect(game.store.getState().save.collection?.universes[0].result.outcome).toBe('success')
  click('Replay with the basic antenna')
  const [a, b] = game.store.getState().save.collection!.universes
  expect(b.parentId).toBe(a.id)
  expect(b.result.outcome).toBe('partial')
  expect(within(screen.getByRole('row', { name: /Science returned/ })).getByText('-40')).toBeTruthy()
})
