// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { engine } from '../../src/app/engine'
import { resolveMode } from '../../src/app/experiences'
import { saveMpSession } from '../../src/app/multiplayer/session'

afterEach(() => { cleanup(); localStorage.clear() })
const card = (name: string) => screen.getByRole('heading', { name }).closest('li')!

it('shows three experiences, each with one description and one way in', () => {
  render(<App game={createGame(engine, localStorage)}/>)
  expect(screen.getByRole('heading', { level: 1, name: 'Amanar' })).toBeTruthy()
  expect(screen.getAllByRole('heading', { level: 2 }).map(item => item.textContent))
    .toEqual(['LUNA-01 Orbiter', 'Lunar Rover', 'Training Academy'])

  const orbiter = within(card('LUNA-01 Orbiter'))
  expect(orbiter.getAllByRole('button').map(item => item.textContent)).toEqual(['Fly solo', 'Fly with a crew'])

  // Rover and Academy are separate pages, linked relatively so a subpath host works.
  const rover = within(card('Lunar Rover')).getByRole('link')
  expect(rover.textContent).toBe('Drive the rover')
  expect(rover.getAttribute('href')).toBe('rover/')
  const academy = within(card('Training Academy')).getByRole('link')
  expect(academy.textContent).toBe('Open the Academy')
  expect(academy.getAttribute('href')).toBe('academy/')
  expect(document.querySelectorAll('.hub .primary')).toHaveLength(1)
})

it('goes from the hub into a solo mission and back, keeping the place in the URL', () => {
  const game = createGame(engine, localStorage)
  render(<App game={game}/>)
  fireEvent.click(screen.getByRole('button', { name: 'Fly solo' }))
  expect(window.location.hash).toBe('#/solo')
  expect(screen.getByRole('heading', { name: 'You’re flight lead.' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Take the console' }))
  expect(game.store.getState().save.phase).toBe('target')

  // The hub control is the first control of the console's top bar.
  const topbar = document.querySelector('.topbar')!
  expect(topbar.querySelector('a, button')!.getAttribute('aria-label')).toBe('Back to mission hub')
  fireEvent.click(within(topbar as HTMLElement).getByRole('link', { name: 'Back to mission hub' }))
  expect(window.location.hash).toBe('#/hub')
  expect(screen.getByRole('heading', { name: 'Amanar' })).toBeTruthy()
  // The draft survives the trip, and the hub says so.
  expect(game.store.getState().save.phase).toBe('target')
  fireEvent.click(screen.getByRole('button', { name: 'Resume solo mission' }))
  expect(screen.getByRole('heading', { name: 'Where should LUNA‑01 look?' })).toBeTruthy()
})

it('reopens a mission already under way, and opens the hub on a first visit', () => {
  expect(resolveMode({ crew: false, solo: false }, '')).toBe('hub')
  expect(resolveMode({ crew: false, solo: true }, '')).toBe('solo')
  expect(resolveMode({ crew: true, solo: true }, '')).toBe('crew')
  expect(resolveMode({ crew: true, solo: true }, '#/hub')).toBe('hub')
  expect(resolveMode({ crew: false, solo: false }, '#/join/ab12cd')).toBe('crew')

  const first = createGame(engine, localStorage)
  first.start()
  const app = render(<App game={createGame(engine, localStorage)}/>)
  expect(screen.getByRole('heading', { name: 'Where should LUNA‑01 look?' })).toBeTruthy()
  app.unmount()
  window.location.hash = '#/hub'
  render(<App game={createGame(engine, localStorage)}/>)
  expect(screen.getByRole('heading', { name: 'Amanar' })).toBeTruthy()
})

it('offers to rejoin a saved crew without starting it', () => {
  saveMpSession({ sessionToken: 's', playerId: 'p', roomCode: 'ABC123', nickname: 'Ada' })
  window.location.hash = '#/hub'
  render(<App game={createGame(engine, localStorage)}/>)
  expect(screen.getByRole('button', { name: 'Rejoin your crew' })).toBeTruthy()
  expect(screen.getByText(/Guest mission ABC123/)).toBeTruthy()
})
