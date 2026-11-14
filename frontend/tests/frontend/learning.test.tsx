// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'

afterEach(cleanup)

function reachBuilder() {
  const game = createGame(engine)
  render(<App game={game}/>)
  fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: 'Ada' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start mission' }))
  return game
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

it('names the next step in the builder and moves on as the player completes it', () => {
  reachBuilder()
  const next = () => screen.getByRole('region', { name: 'Your design checklist' }).querySelector('.coach-next')!.textContent
  expect(next()).toContain('Ice-sensitive spectrometer')
  fireEvent.click(screen.getByRole('radio', { name: 'Ice-sensitive spectrometer' }))
  expect(next()).toContain('Save trade study candidate')
  click('Save trade study candidate')
  expect(next()).toContain('Change at least one part')
  fireEvent.click(screen.getByRole('radio', { name: 'Solar + storage' }))
  expect(next()).toContain('Open engineering review')
})

it('explains jargon inline and in the how-to-play guide', () => {
  reachBuilder()
  const help = screen.getAllByRole('button', { name: 'What is Budget units (BU)?' })[0]
  fireEvent.click(help)
  expect(help.getAttribute('aria-expanded')).toBe('true')
  expect(document.getElementById(help.getAttribute('aria-describedby')!)!.textContent).toContain('120 BU')

  click('How to play')
  const dialog = screen.getByRole('dialog', { name: 'How LUNA‑01 works' })
  expect(dialog.textContent).toContain('Delta-v')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('charts the debrief from the engine result', () => {
  reachBuilder()
  click('Save trade study candidate')
  for (const name of ['Ice-sensitive spectrometer', 'Solar + storage', 'High reserve', 'High-throughput antenna', 'Direct transfer']) {
    fireEvent.click(screen.getByRole('radio', { name }))
  }
  click('Open engineering review')
  fireEvent.change(screen.getByLabelText('Reason for choosing the current design'), { target: { value: 'science' } })
  click('Record trade study')
  for (const box of screen.queryAllByRole('checkbox')) fireEvent.click(box)
  click('Authorize launch')
  click('Full observation')
  click('Science first')
  click('Open debrief')

  expect(screen.getByRole('heading', { name: 'Where your score came from' })).toBeTruthy()
  expect(screen.getByLabelText(/^Science returned: 400 \/ 400/)).toBeTruthy()
  expect(screen.getByLabelText(/^Sent to Earth: 100/)).toBeTruthy()
  expect(screen.getByLabelText(/^Budget: \d+ \/ 120 BU/)).toBeTruthy()
})
