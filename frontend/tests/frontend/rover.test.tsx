// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { fromPage } from '../../src/app/experiences'
import { RoverApp } from '../../src/rover/RoverApp'

afterEach(cleanup)

// jsdom has no WebGL, which is exactly the case this covers.
it('without WebGL, explains why and keeps the controls guide and the way back', () => {
  render(<RoverApp/>)
  expect(screen.getByRole('heading', { level: 1, name: 'The 3D drive can’t start here' })).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Back to mission hub' }).every(link => link.getAttribute('href') === fromPage.hub)).toBe(true)
  expect(screen.getByRole('link', { name: 'Open the Training Academy' }).getAttribute('href')).toBe(fromPage.academy)
  const keyboard = screen.getByRole('heading', { name: 'Keyboard' }).closest('section')!
  expect(within(keyboard).getByText('Drive forward')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'VR headset' })).toBeTruthy()
  expect(screen.getByText(/not NASA elevation data/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Enter VR' })).toBeNull()
})
