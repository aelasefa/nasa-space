// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { saveKey } from '../../src/app/save'

afterEach(() => { cleanup(); localStorage.clear() })

it.each(['typing', 'pasting'])('limits %s to 16 characters and accepts a full-length name', async method => {
  const user = userEvent.setup()
  const game = createGame(undefined, localStorage)
  render(<App game={game}/>)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' })
  expect(screen.getByRole('heading', { name: 'Hi,' })).toBeTruthy()
  expect(input.maxLength).toBe(16)
  expect(screen.queryByRole('button', { name: 'Start mission' })).toBeNull()
  await user.tab()
  expect(document.activeElement).toBe(input)
  const name = '1234567890ABCDEF'
  if (method === 'typing') await user.keyboard(name + 'overflow')
  else await user.paste(name + 'overflow')
  expect(input.value).toBe(name)
  await user.keyboard('{Enter}')
  expect(screen.getByText(`Welcome to LUNA‑01, ${name}.`)).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Scroll to begin' }))
  expect(game.store.getState().save.phase).toBe('briefing')
  await user.click(screen.getByRole('button', { name: 'Start mission' }))
  expect(screen.getByRole('heading', { name: 'Spacecraft builder' })).toBeTruthy()
  expect(localStorage.getItem(saveKey)).not.toContain(name)
})

it('rejects blanks and overlong submissions, then trims a valid inline submission', async () => {
  const user = userEvent.setup()
  render(<App game={createGame()}/>)
  const input = screen.getByRole('textbox', { name: 'Your name' })
  const continueButton = screen.getByRole('button', { name: 'Continue' })
  for (const value of ['   ', '1234567890ABCDEFG']) {
    fireEvent.change(input, { target: { value } })
    await user.click(continueButton)
    expect(screen.getByRole('alert').textContent).toContain('1–16')
    expect(screen.queryByRole('button', { name: 'Start mission' })).toBeNull()
  }
  await user.clear(input)
  await user.type(input, '  Ada  ')
  await user.click(continueButton)
  expect(screen.getByText('Welcome to LUNA‑01, Ada.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
