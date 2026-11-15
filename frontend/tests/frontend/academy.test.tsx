// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AcademyApp } from '../../src/academy/AcademyApp'
import { curriculum } from '../../src/academy/curriculum'
import {
  academyKey, badges, freshProgress, loadProgress, newlyEarned, nextChapter, rank, recordScore, unlocked,
} from '../../src/academy/progress'
import { fromPage } from '../../src/app/experiences'
import { saveKey } from '../../src/app/save'

beforeEach(() => window.history.replaceState(null, '', '/academy/'))
afterEach(() => { cleanup(); localStorage.clear() })
const [one, two, , , five] = curriculum

describe('Academy progress', () => {
  it('gates each chapter on the one before it and keeps the best score', () => {
    let progress = freshProgress()
    expect(curriculum.filter(chapter => unlocked(progress, chapter)).map(chapter => chapter.id)).toEqual([1])
    progress = recordScore(progress, one!, 7)
    expect(unlocked(progress, two!)).toBe(false)
    progress = recordScore(progress, one!, 9)
    expect(unlocked(progress, two!)).toBe(true)
    expect(recordScore(progress, one!, 3)).toBe(progress)
    expect(nextChapter(progress)).toBe(two)
  })

  it('names achievements as in-game ranks and badges', () => {
    const before = freshProgress()
    const after = recordScore(recordScore(before, one!, 8), two!, 10)
    expect(newlyEarned(before, after).map(item => item.name)).toEqual([
      `Chapter 1: ${one!.title}`, `Chapter 2: ${two!.title}`, 'Mission Operations Specialist'])
    expect(rank(recordScore(after, five!, 8)).name).toBe('Mission Commander')
    expect(badges(after).filter(item => item.earned)).toHaveLength(2)
  })

  it('starts fresh from a damaged save and never touches another save', () => {
    localStorage.setItem(academyKey, '{"schemaVersion":1,"best":{"1":42}}')
    expect(loadProgress(localStorage)).toEqual(freshProgress())
    localStorage.setItem(saveKey, 'orbiter')
    render(<AcademyApp storage={localStorage}/>)
    expect(localStorage.getItem(saveKey)).toBe('orbiter')
  })
})

describe('Academy flow', () => {
  const go = (name: string) => act(() => { fireEvent.click(screen.getByRole('link', { name })) })

  it('explains what unlocks each locked chapter, and links its rover shortcut to the canonical Rover', () => {
    render(<AcademyApp storage={localStorage}/>)
    expect(screen.getByRole('heading', { level: 1, name: 'Choose a chapter' })).toBeTruthy()
    const second = screen.getByRole('heading', { name: two!.title }).closest('li')!
    expect(second.textContent).toContain(`Locked. Pass chapter 1, ${one!.title}, with 8 out of 10 to open it.`)
    expect(within(second).queryByRole('link')).toBeNull()
    expect(screen.getByRole('link', { name: 'Drive the rover' }).getAttribute('href')).toBe(fromPage.rover)
    expect(screen.getByRole('link', { name: 'Back to mission hub' }).getAttribute('href')).toBe(fromPage.hub)
  })

  it('runs lesson → quiz → result, unlocks the next chapter and keeps it after a reload', () => {
    const app = render(<AcademyApp storage={localStorage}/>)
    go('Start chapter 1')
    expect(window.location.hash).toBe('#/chapter/1')
    expect(screen.getByRole('heading', { level: 1, name: one!.title })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Lesson' })).toBeTruthy()
    go('Start the quiz')

    one!.questions.forEach((question, index) => {
      expect(screen.getByRole('heading', { level: 1, name: `Question ${index + 1} of 10` })).toBeTruthy()
      const next = screen.getByRole<HTMLButtonElement>('button', { name: index < 9 ? 'Next question' : 'See your result' })
      expect(next.disabled).toBe(true)
      // Answer the last question wrong: 9 of 10 still passes.
      const pick = index === 9 ? (question.answer + 1) % 4 : question.answer
      fireEvent.click(within(document.querySelector<HTMLElement>('.academy-options')!).getAllByRole('button')[pick]!)
      expect(screen.getByRole('status').textContent).toContain(index === 9 ? 'Not quite' : 'Correct.')
      expect(screen.getByRole('status').textContent).toContain(question.explanation)
      fireEvent.click(next)
    })

    expect(screen.getByRole('heading', { level: 1, name: '9 out of 10: chapter passed' })).toBeTruthy()
    expect(screen.getByText(`Chapter 2, ${two!.title}, is now open.`)).toBeTruthy()
    expect(screen.getByText(/They are not a certification/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start chapter 2' })).toBeTruthy()

    app.unmount()
    window.history.replaceState(null, '', '/academy/')
    render(<AcademyApp storage={localStorage}/>)
    expect(screen.getByText('Passed · best 9/10')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start chapter 2' })).toBeTruthy()
  })

  it('offers a retry and the lesson after a failed quiz, without unlocking anything', () => {
    render(<AcademyApp storage={localStorage}/>)
    go('Start chapter 1')
    go('Start the quiz')
    for (const question of one!.questions) {
      fireEvent.click(within(document.querySelector<HTMLElement>('.academy-options')!).getAllByRole('button')[(question.answer + 1) % 4]!)
      fireEvent.click(screen.getByRole('button', { name: /Next question|See your result/ }))
    }
    expect(screen.getByRole('heading', { level: 1, name: '0 out of 10: not passed yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review the lesson' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry the quiz' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Question 1 of 10' })).toBeTruthy()
    expect(unlocked(loadProgress(localStorage), two!)).toBe(false)
  })

  it('keeps achievements and development controls out of the learning flow', () => {
    render(<AcademyApp storage={localStorage}/>)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Achievements/ }))
    const dialog = screen.getByRole('dialog', { name: 'Achievements' })
    expect(dialog.textContent).toContain('Space Cadet')
    expect(dialog.textContent).toContain('not a certification')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Previewing locked chapters lives in Settings and does not change the gate.
    fireEvent.click(screen.getByRole('button', { name: 'Preview locked chapters: off' }))
    expect(screen.getByRole('link', { name: 'Preview chapter 2' })).toBeTruthy()
    expect(unlocked(loadProgress(localStorage), two!)).toBe(false)
  })
})
