// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { saveKey } from '../../src/app/save'
import { fixture } from './engine.fixture'

afterEach(() => { cleanup(); localStorage.clear() })

it('opens with a role and a question, and starts without a name', async () => {
  const user = userEvent.setup()
  const game = createGame(fixture, localStorage)
  render(<App game={game}/>)
  expect(screen.getByRole('heading', { name: 'You’re flight lead.' })).toBeTruthy()
  expect(screen.getByText(/possible ice signature/)).toBeTruthy()
  expect(screen.getByText('The Ice at the Edge of Shadow')).toBeTruthy()
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Call sign (optional)' }))
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Take the console' }))
  await user.keyboard('{Enter}')
  expect(screen.getByRole('heading', { name: 'Where should LUNA‑01 look?' })).toBeTruthy()
})

it.each(['typing', 'pasting'])('limits a call sign to 16 characters when %s, trims it and never saves it', async method => {
  const user = userEvent.setup()
  const game = createGame(fixture, localStorage)
  render(<App game={game}/>)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Call sign (optional)' })
  expect(input.maxLength).toBe(16)
  await user.click(input)
  if (method === 'typing') await user.keyboard('  Ada  overflowing-name')
  else await user.paste('  Ada  overflowing-name')
  expect(input.value).toHaveLength(16)
  await user.clear(input)
  await user.type(input, '  Ada  ')
  await user.keyboard('{Enter}')
  expect(screen.getByRole('status').textContent).toMatch(/^Ada, we’ve identified thirteen historical candidate regions/)
  game.chooseTarget('malapert_massif')
  game.confirmTarget()
  expect(await screen.findByRole('heading', { name: 'Spacecraft builder' })).toBeTruthy()

  game.saveAlternative()
  game.select('payloadId', 'ice_spectrometer')
  game.select('commsId', 'comms_high')
  game.reviews()
  game.trade('science')
  game.acknowledge('battery_endurance', true)
  game.launch()
  expect(await screen.findByText(/Orbit achieved, Ada\./)).toBeTruthy()
  expect(localStorage.getItem(saveKey)).not.toContain('Ada')
})

it('rejects an overlong call sign instead of starting', () => {
  render(<App game={createGame(fixture)}/>)
  fireEvent.change(screen.getByRole('textbox', { name: 'Call sign (optional)' }), { target: { value: '1234567890ABCDEFG' } })
  fireEvent.click(screen.getByRole('button', { name: 'Take the console' }))
  expect(screen.getByRole('alert').textContent).toContain('16')
  expect(screen.queryByRole('heading', { name: 'Spacecraft builder' })).toBeNull()
})
