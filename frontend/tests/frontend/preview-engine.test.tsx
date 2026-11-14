// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from '../../src/App'
import { createGame } from '../../src/app/controller'
import { previewEngine } from '../../src/app/previewEngine'

afterEach(cleanup)

it('plays intro → builder → review → flight → debrief → multiverse on the labelled preview engine', () => {
  const game = createGame(previewEngine)
  render(<App game={game}/>)
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: '  Ada ' } })
  click('Continue')
  expect(screen.getByText('Welcome to LUNA‑01, Ada.')).toBeTruthy()
  click('Start mission')

  expect(screen.getByRole('note').textContent).toContain('Preview engine')
  click('Save trade study candidate')
  for (const name of ['Ice-sensitive spectrometer', 'Solar + storage', 'High reserve', 'High-throughput antenna', 'Direct transfer']) {
    fireEvent.click(screen.getByRole('radio', { name }))
  }
  click('Open engineering review')
  const authorize = screen.getByRole<HTMLButtonElement>('button', { name: 'Authorize launch' })
  expect(authorize.disabled).toBe(true)

  // Players can go back and revise; the selection survives the round trip.
  click('Back to builder')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Direct transfer' }).checked).toBe(true)
  click('Open engineering review')

  fireEvent.change(screen.getByLabelText('Reason for choosing the current design'), { target: { value: 'science' } })
  click('Record trade study')
  click('Authorize launch')
  expect(game.store.getState().save.phase).toBe('flight')

  click('Full observation')
  click('Science first')
  click('Next event')
  click('Next event')
  expect(screen.getAllByText(/Placeholder: Science first recorded/).length).toBeGreaterThan(0)
  click('Open debrief')
  expect(screen.getByRole('heading', { name: 'Mission debrief' })).toBeTruthy()

  click('Explore alternate universes')
  click('Simulate alternate universe')
  const [a, b] = game.store.getState().save.collection!.universes
  expect(b.parentId).toBe(a.id)
})

it('keeps the camera-only design from being authorized', () => {
  const report = previewEngine.evaluateReviews(
    { payloadId: 'mapping_camera', powerId: 'solar_light', propulsionId: 'prop_low', commsId: 'comms_basic', trajectoryId: 'efficient' },
    { configHash: 'x', acknowledgedWarnings: [] },
  )
  expect(report.gates.CML1.passed).toBe(false)
  expect(report.authorized).toBe(false)
})
