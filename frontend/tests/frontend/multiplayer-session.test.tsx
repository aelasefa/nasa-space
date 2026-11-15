// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { codeFromLocation, invitePath, loadMpSession, saveMpSession, clearMpSession, mpSessionKey } from '../../src/app/multiplayer/session'
import { MultiplayerHome } from '../../src/features/multiplayer/Home'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { fixture } from './engine.fixture'

afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = '' })

it('keeps multiplayer session keys separate from solo saves', () => {
  saveMpSession({ sessionToken: 's_test', playerId: 'p1', roomCode: 'ABC123', nickname: 'Ada' })
  expect(localStorage.getItem(mpSessionKey)).toBeTruthy()
  expect(localStorage.getItem('luna01:save:v1')).toBeNull()
  expect(loadMpSession()?.roomCode).toBe('ABC123')
  clearMpSession()
  expect(loadMpSession()).toBeNull()
})

it('parses invite hashes case-insensitively', () => {
  expect(codeFromLocation('#/join/ab12cd')).toBe('AB12CD')
  expect(invitePath('xy99zz')).toBe('#/join/XY99ZZ')
  expect(codeFromLocation('#/other')).toBeNull()
})

it('opens join form when an invite code is present', () => {
  render(<MultiplayerHome initialCode="AB12CD" onHub={() => {}} onEnter={() => {}}/>)
  expect(screen.getByRole('heading', { name: 'Join a mission' })).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'Room code' })).toHaveProperty('value', 'AB12CD')
})

it('flying with a crew from the hub does not touch the solo save, and leads back to the hub', () => {
  const game = createGame(fixture, localStorage)
  render(<App game={game}/>)
  fireEvent.click(screen.getByRole('button', { name: 'Fly with a crew' }))
  expect(localStorage.getItem('luna01:save:v1')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Fly with a crew' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create mission' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Join mission' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back to mission hub' }))
  expect(screen.getByRole('heading', { name: 'Amanar' })).toBeTruthy()
})
