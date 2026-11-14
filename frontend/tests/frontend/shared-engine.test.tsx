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
  click('Use the ice spectrometer')
  click('Save current design as baseline')
  for (const name of ['Solar + storage', 'High reserve', 'High-throughput antenna', 'Direct transfer']) {
    fireEvent.click(screen.getByRole('radio', { name }))
  }
  fireEvent.change(screen.getByLabelText('Why is the current design better?'), { target: { value: 'science' } })
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
