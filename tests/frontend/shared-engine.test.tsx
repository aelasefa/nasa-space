// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)

it.skipIf(!engine)('runs the judge demo with the real shared domain engine', () => {
  const game = createGame(engine)
  render(<App game={game}/>)
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  click('Start mission')
  click('Save trade study candidate')
  for (const name of ['Ice-sensitive spectrometer', 'Solar + storage', 'High reserve', 'High-throughput antenna', 'Direct transfer']) {
    fireEvent.click(screen.getByRole('radio', { name }))
  }
  click('Open engineering review')
  fireEvent.change(screen.getByLabelText('Reason for choosing the current design'), { target: { value: 'science' } })
  click('Record trade study')
  for (const warning of screen.queryAllByRole('checkbox')) fireEvent.click(warning)
  click('Authorize launch')
  click('Full observation')
  click('Science first')
  click('Open debrief')
  expect(game.store.getState().save.collection?.universes[0].result.outcome).toBe('success')
  click('Explore alternate universes')
  click('Simulate alternate universe')
  const [a, b] = game.store.getState().save.collection!.universes
  expect(b.parentId).toBe(a.id)
  expect(b.result.outcome).toBe('partial')
  expect(within(screen.getByRole('row', { name: /Science returned/ })).getByText('-40')).toBeTruthy()
})
