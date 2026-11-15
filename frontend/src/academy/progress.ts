import { z } from 'zod'
import { curriculum, type Chapter } from './curriculum'

/*
 * Training Academy progress: best quiz score per chapter and a sound preference. Pure
 * functions over a small, zod-validated save. The save has its own key, so it can never
 * collide with the Orbiter's solo save or a guest mission.
 *
 * Scores, ranks and badges are in-game achievements. They certify nothing.
 */

export const academyKey = 'luna01:academy:v1'
/** Correct answers needed to pass a chapter and unlock the next one. */
export const PASS_SCORE = 8

const schema = z.object({
  schemaVersion: z.literal(1),
  /** Best score per chapter id. A chapter that was never finished has no entry. */
  best: z.record(z.string(), z.number().int().min(0).max(10)),
  muted: z.boolean(),
})
export type Progress = z.infer<typeof schema>
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const freshProgress = (): Progress => ({ schemaVersion: 1, best: {}, muted: false })

/** A missing or unreadable save starts fresh: there is nothing here worth blocking the player for. */
export function loadProgress(store: Store): Progress {
  try {
    const parsed = schema.safeParse(JSON.parse(store.getItem(academyKey) ?? 'null'))
    return parsed.success ? parsed.data : freshProgress()
  } catch { return freshProgress() }
}

export function saveProgress(store: Store, progress: Progress) {
  try { store.setItem(academyKey, JSON.stringify(progress)) } catch { /* progress then lasts until the page closes */ }
}

export const bestScore = (progress: Progress, chapter: Chapter): number | null => progress.best[chapter.id] ?? null
export const passed = (progress: Progress, chapter: Chapter) => (progress.best[chapter.id] ?? 0) >= PASS_SCORE
export const passedCount = (progress: Progress) => curriculum.filter(chapter => passed(progress, chapter)).length

/** The chapter that must be passed before this one opens, if any. */
export function prerequisite(chapter: Chapter): Chapter | null {
  const index = curriculum.indexOf(chapter)
  return index > 0 ? curriculum[index - 1]! : null
}
export function unlocked(progress: Progress, chapter: Chapter) {
  const before = prerequisite(chapter)
  return !before || passed(progress, before)
}

/** Keeps the best score. A lower retry never takes a pass away. */
export function recordScore(progress: Progress, chapter: Chapter, score: number): Progress {
  const previous = progress.best[chapter.id]
  if (previous !== undefined && previous >= score) return progress
  return { ...progress, best: { ...progress.best, [chapter.id]: score } }
}

/** The first chapter that is open and not passed yet: what to do next. Null when everything is passed. */
export function nextChapter(progress: Progress): Chapter | null {
  return curriculum.find(chapter => unlocked(progress, chapter) && !passed(progress, chapter)) ?? null
}

export interface Achievement { id: string; name: string; how: string; earned: boolean }

const last = curriculum[curriculum.length - 1]!
/** In-game ranks, lowest first. The highest earned one is the player's rank. */
export function ranks(progress: Progress): Achievement[] {
  return [
    { id: 'cadet', name: 'Space Cadet', how: 'Where everyone starts.', earned: true },
    { id: 'specialist', name: 'Mission Operations Specialist', how: `Pass any two chapters with ${PASS_SCORE} out of 10 or more.`, earned: passedCount(progress) >= 2 },
    { id: 'commander', name: 'Mission Commander', how: `Pass chapter ${last.id}, ${last.title}.`, earned: passed(progress, last) },
  ]
}
export const rank = (progress: Progress) => ranks(progress).filter(item => item.earned).at(-1)!

/** One badge per chapter. */
export function badges(progress: Progress): Achievement[] {
  return curriculum.map(chapter => ({
    id: `chapter-${chapter.id}`, name: `Chapter ${chapter.id}: ${chapter.title}`,
    how: `Score ${PASS_SCORE} out of ${chapter.questions.length} or more in the chapter ${chapter.id} quiz.`, earned: passed(progress, chapter),
  }))
}

/** Achievements that `after` has and `before` did not: what a quiz result just earned. */
export function newlyEarned(before: Progress, after: Progress): Achievement[] {
  const had = new Set([...ranks(before), ...badges(before)].filter(item => item.earned).map(item => item.id))
  return [...badges(after), ...ranks(after)].filter(item => item.earned && !had.has(item.id))
}
