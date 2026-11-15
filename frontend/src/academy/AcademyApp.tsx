import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react'
import { experiences, fromPage } from '../app/experiences'
import { Dialog } from '../components/Dialog'
import { ExperienceBar } from '../components/Experience'
import { ActionBar, Readout, ScreenHeader } from '../components/Screen'
import { motionOK } from '../space/motion'
import { curriculum, type Chapter } from './curriculum'
import {
  badges, bestScore, freshProgress, loadProgress, newlyEarned, nextChapter, passed, passedCount, PASS_SCORE, prerequisite,
  rank, ranks, recordScore, saveProgress, unlocked, type Achievement, type Progress, type Store,
} from './progress'
import { celebrate } from './runtime/particles.js'
import { Sound } from './runtime/sound.js'

/*
 * Training Academy: chapters → lesson and simulator → quiz → result, as one flow.
 * The view lives in the hash (`#/`, `#/chapter/2`, `#/chapter/2/quiz`) so the browser's
 * Back button steps through the flow instead of leaving it.
 */

type Route = { view: 'chapters' } | { view: 'lesson' | 'quiz'; chapter: Chapter }
const letters = ['A', 'B', 'C', 'D']
const lessonHash = (chapter: Chapter) => `#/chapter/${chapter.id}`
const quizHash = (chapter: Chapter) => `#/chapter/${chapter.id}/quiz`

function parseRoute(hash: string): Route {
  const match = /^#\/chapter\/(\d+)(\/quiz)?\/?$/.exec(hash)
  const chapter = match ? curriculum.find(item => item.id === Number(match[1])) : undefined
  return chapter ? { view: match![2] ? 'quiz' : 'lesson', chapter } : { view: 'chapters' }
}

/** A link inside the Academy. A real anchor, so it can be opened in a new tab or bookmarked. */
function Go({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    if (window.location.hash !== to) window.location.hash = to
    // Tell the app now; the browser's own hashchange event follows and changes nothing.
    window.dispatchEvent(new Event('academy:navigate'))
  }
  return <a className={className} href={to} onClick={click}>{children}</a>
}

function Steps({ current }: { current: 'lesson' | 'quiz' | 'result' }) {
  const steps = [['lesson', 'Lesson and simulator'], ['quiz', 'Quiz'], ['result', 'Result']] as const
  const at = steps.findIndex(([id]) => id === current)
  return <nav className="academy-crumbs" aria-label="Chapter">
    <Go to="#/" className="hub-link">‹ All chapters</Go>
    <ol className="stages" aria-label="Steps in this chapter">{steps.map(([id, name], index) =>
      <li key={id} aria-current={id === current ? 'step' : undefined} data-done={index < at || undefined}>0{index + 1} · {name}</li>)}</ol>
  </nav>
}

function statusOf(progress: Progress, chapter: Chapter, open: boolean) {
  const best = bestScore(progress, chapter)
  const total = chapter.questions.length
  if (!open) return { text: 'Locked', tone: undefined }
  if (best === null) return { text: 'Not started', tone: undefined }
  return passed(progress, chapter) ? { text: `Passed · best ${best}/${total}`, tone: 'passed' as const }
    : { text: `Best ${best}/${total} · ${PASS_SCORE} to pass`, tone: 'warn' as const }
}

function Chapters({ progress, preview, headingRef }: { progress: Progress; preview: boolean; headingRef: Ref<HTMLHeadingElement> }) {
  const next = nextChapter(progress)
  const done = passedCount(progress)
  const questions = curriculum[0]!.questions.length
  return <section className="academy-chapters-view">
    <ScreenHeader eyebrow="Training Academy" title="Choose a chapter" headingRef={headingRef}
      lede={`Each chapter has a short lesson, a simulator to try and a ${questions}-question quiz. Score ${PASS_SCORE} or more to pass it and open the next chapter.`}
      aside={<div className="academy-progress">
        <p className="eyebrow">Your progress</p>
        <p className="academy-progress-count"><strong>{done} of {curriculum.length}</strong> chapters passed</p>
        <div className="energy-bar" aria-hidden="true"><span style={{ width: `${done / curriculum.length * 100}%` }}/></div>
        <p className="fine">Rank: {rank(progress).name}</p>
      </div>}/>

    <ol className="academy-chapters">{curriculum.map(chapter => {
      const open = unlocked(progress, chapter)
      const status = statusOf(progress, chapter, open)
      const before = prerequisite(chapter)
      const isNext = chapter === next
      const best = bestScore(progress, chapter)
      return <li key={chapter.id} className="panel academy-chapter" data-next={isNext || undefined} data-locked={!open || undefined}>
        <div className="spread">
          <p className="eyebrow">Chapter {chapter.id} · {chapter.difficulty}{isNext && ' · Next up'}</p>
          <span className="tag" data-passed={status.tone === 'passed' || undefined} data-tone={status.tone === 'warn' ? 'warn' : undefined}>{status.text}</span>
        </div>
        <h2>{chapter.title}</h2>
        <p className="fine">Simulator: {chapter.simulator}</p>
        {open
          ? <Go to={lessonHash(chapter)} className={isNext ? 'button primary' : 'button'}>
            {passed(progress, chapter) ? 'Review' : best === null ? 'Start' : 'Continue'} chapter {chapter.id}</Go>
          : <>
            <p className="academy-locked">Locked. Pass chapter {before!.id}, {before!.title}, with {PASS_SCORE} out of {before!.questions.length} to open it.</p>
            {preview && <Go to={lessonHash(chapter)} className="button quiet">Preview chapter {chapter.id}</Go>}
          </>}
      </li>
    })}</ol>

    {!next && <p className="takeaway"><strong>All chapters passed</strong>Review any chapter to improve a score, or take the rover out.</p>}
    <aside className="panel academy-rover" aria-labelledby="academy-rover-title">
      <div>
        <h2 id="academy-rover-title">{experiences.rover.name}</h2>
        <p>{experiences.rover.summary}</p>
      </div>
      <a className="button" href={fromPage.rover}>Drive the rover</a>
    </aside>
  </section>
}

/** Mounts the imported canvas simulator for a chapter, with a text fallback where canvas is unavailable. */
function Simulator({ chapter }: { chapter: Chapter }) {
  const mount = useRef<HTMLDivElement>(null)
  const api = useRef<{ setPaused(paused: boolean): void; cleanup(): void } | null>(null)
  const [paused, setPaused] = useState(() => !motionOK())
  const pausedNow = useRef(paused)
  const canvasOK = typeof window !== 'undefined' && 'CanvasRenderingContext2D' in window
  const [failed, setFailed] = useState(!canvasOK)

  useEffect(() => {
    if (!canvasOK) return
    let cancelled = false
    import('./runtime/simulations.js').then(({ Simulators }) => {
      if (cancelled || !mount.current) return
      try {
        Simulators.setPaused(pausedNow.current)
        Simulators.init(chapter.id, mount.current)
        api.current = Simulators
      } catch { Simulators.cleanup(); setFailed(true) }
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; api.current?.cleanup(); api.current = null }
  }, [chapter.id, canvasOK])
  useEffect(() => { pausedNow.current = paused; api.current?.setPaused(paused) }, [paused])

  return <section className="panel" aria-labelledby="academy-sim-title">
    <div className="spread">
      <h2 id="academy-sim-title">Try it</h2>
      {!failed && <button type="button" className="quiet" aria-pressed={paused} onClick={() => setPaused(value => !value)}>Pause motion</button>}
    </div>
    <p className="fine">{chapter.simulator}. A simplified model for learning: its numbers are illustrative.</p>
    {failed
      ? <p className="craft-fallback">The simulator can’t run in this browser. The lesson and the quiz work without it.</p>
      : <div className="academy-sim" ref={mount}/>}
  </section>
}

function Lesson({ chapter, progress, headingRef }: { chapter: Chapter; progress: Progress; headingRef: Ref<HTMLHeadingElement> }) {
  const status = statusOf(progress, chapter, true)
  const total = chapter.questions.length
  return <section className="academy-lesson-view">
    <Steps current="lesson"/>
    <ScreenHeader eyebrow={`Chapter ${chapter.id} of ${curriculum.length} · ${chapter.difficulty}`} title={chapter.title} headingRef={headingRef}
      aside={<span className="tag" data-passed={status.tone === 'passed' || undefined} data-tone={status.tone === 'warn' ? 'warn' : undefined}>{status.text}</span>}/>
    <div className="academy-lesson">
      <section className="panel" aria-labelledby="academy-lesson-title">
        <h2 id="academy-lesson-title">Lesson</h2>
        <p className="academy-lesson-text">{chapter.lesson}</p>
        <p className="fine">A simplified summary for learning. Figures are rounded, typical values.</p>
      </section>
      <Simulator chapter={chapter}/>
    </div>
    <ActionBar label="Chapter" status={`Next: ${total} questions. ${PASS_SCORE} correct to pass, and you can retry as often as you like.`}>
      <Go to="#/" className="button">All chapters</Go>
      <Go to={quizHash(chapter)} className="button primary">Start the quiz</Go>
    </ActionBar>
  </section>
}

function Quiz({ chapter, progress, onFinish, onAchievements }: {
  chapter: Chapter; progress: Progress; onFinish: (score: number) => Achievement[]; onAchievements: () => void
}) {
  const total = chapter.questions.length
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<number[]>([])
  const [result, setResult] = useState<{ score: number; earned: Achievement[] } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const proceed = useRef<HTMLButtonElement>(null)
  const question = chapter.questions[index]!
  const picked = picks[index]
  const answered = picked !== undefined
  const correct = picks.filter((pick, at) => pick === chapter.questions[at]!.answer).length

  useEffect(() => { heading.current?.focus({ preventScroll: true }); if (window.scrollY > 0) window.scrollTo(0, 0) }, [index, result])
  useEffect(() => { if (answered) proceed.current?.focus() }, [answered, index])

  function answer(option: number) {
    if (answered) return
    setPicks(current => [...current, option])
    if (option === question.answer) Sound.correct(); else Sound.incorrect()
  }
  function next() {
    Sound.click()
    if (index < total - 1) { setIndex(index + 1); return }
    const earned = onFinish(correct)
    setResult({ score: correct, earned })
  }
  function retry() { Sound.click(); setIndex(0); setPicks([]); setResult(null) }

  if (result) {
    const ok = result.score >= PASS_SCORE
    const after = curriculum[curriculum.indexOf(chapter) + 1]
    const best = Math.max(result.score, bestScore(progress, chapter) ?? 0)
    return <section className="academy-result-view">
      <Steps current="result"/>
      <ScreenHeader eyebrow={`Chapter ${chapter.id} · Result`} headingRef={heading}
        title={`${result.score} out of ${total}: ${ok ? 'chapter passed' : 'not passed yet'}`}/>
      <section className="panel academy-result" data-passed={ok || undefined} aria-label="Quiz result">
        <p className="debrief-headline">{ok
          ? after ? `Chapter ${after.id}, ${after.title}, is now open.` : `That was the last chapter. You have passed all ${curriculum.length}.`
          : `You need ${PASS_SCORE} correct answers to pass. Review the lesson or try again: there is no limit on retries.`}</p>
        <dl className="readouts">
          <Readout label="This attempt" value={result.score} unit={`/ ${total}`} tone={ok ? 'good' : 'warn'}/>
          <Readout label="Your best" value={best} unit={`/ ${total}`}/>
          <Readout label="Needed to pass" value={PASS_SCORE} unit={`/ ${total}`}/>
        </dl>
        {result.earned.length > 0 && <div className="takeaway"><strong>New in-game achievement{result.earned.length > 1 ? 's' : ''}</strong>
          <ul className="academy-earned">{result.earned.map(item => <li key={item.id}>{item.name}</li>)}</ul>
          <button type="button" className="link-action" onClick={onAchievements}>See all achievements</button>
        </div>}
        <p className="fine">Scores and badges are in-game achievements. They are not a certification.</p>
      </section>
      <ActionBar label="Result" status={ok ? 'Passed. Your best score is saved on this device.' : 'Not passed yet. Nothing is lost by retrying.'}>
        {ok ? <>
          <button type="button" className="quiet" onClick={retry}>Retry the quiz</button>
          {after ? <><Go to="#/" className="button">All chapters</Go>
            <Go to={lessonHash(after)} className="button primary">Start chapter {after.id}</Go></>
            : <Go to="#/" className="button primary">All chapters</Go>}
        </> : <>
          <Go to="#/" className="button quiet">All chapters</Go>
          <Go to={lessonHash(chapter)} className="button">Review the lesson</Go>
          <button type="button" className="primary" onClick={retry}>Retry the quiz</button>
        </>}
      </ActionBar>
    </section>
  }

  const right = picked === question.answer
  return <section className="academy-quiz-view">
    <Steps current="quiz"/>
    <ScreenHeader eyebrow={`Chapter ${chapter.id} · ${chapter.title} · Quiz`} title={`Question ${index + 1} of ${total}`} headingRef={heading}
      aside={<p className="tag">{correct} correct so far · {PASS_SCORE} to pass</p>}/>
    <div className="energy-bar academy-quiz-bar" aria-hidden="true"><span style={{ width: `${(index + (answered ? 1 : 0)) / total * 100}%` }}/></div>
    <section className="panel academy-question" aria-labelledby="academy-question">
      <h2 id="academy-question">{question.prompt}</h2>
      <ul className="academy-options">{question.options.map((text, option) => {
        const state = !answered ? undefined : option === question.answer ? 'correct' : option === picked ? 'wrong' : 'other'
        return <li key={option}><button type="button" data-state={state} disabled={answered} onClick={() => answer(option)}>
          <span className="academy-letter" aria-hidden="true">{letters[option]}</span>
          <span>{text}</span>
          {state === 'correct' && <span className="academy-mark">✓ Correct answer</span>}
          {state === 'wrong' && <span className="academy-mark">✕ Your answer</span>}
        </button></li>
      })}</ul>
      {answered && <div className="academy-feedback" role="status" data-tone={right ? 'good' : 'bad'}>
        <p><strong>{right ? 'Correct.' : `Not quite. The answer is ${letters[question.answer]}.`}</strong></p>
        <p>{question.explanation}</p>
      </div>}
    </section>
    <ActionBar label="Quiz" status={answered ? undefined : 'Pick an answer to continue.'}>
      <Go to={lessonHash(chapter)} className="button quiet">Leave the quiz</Go>
      <button type="button" className="primary" ref={proceed} disabled={!answered} onClick={next}>
        {index < total - 1 ? 'Next question' : 'See your result'}</button>
    </ActionBar>
  </section>
}

function AchievementList({ title, items }: { title: string; items: Achievement[] }) {
  return <>
    <h3>{title}</h3>
    <ul className="academy-achievements">{items.map(item => <li key={item.id} data-earned={item.earned || undefined}>
      <span className="tag" data-passed={item.earned || undefined}>{item.earned ? 'Earned' : 'Not yet'}</span>
      <div><strong>{item.name}</strong><p>{item.how}</p></div>
    </li>)}</ul>
  </>
}

export function AcademyApp({ storage = window.localStorage }: { storage?: Store }) {
  const [progress, setProgress] = useState(() => loadProgress(storage))
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  const [preview, setPreview] = useState(false)
  const [achievements, setAchievements] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const settings = useRef<HTMLDetailsElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', sync)
    window.addEventListener('academy:navigate', sync)
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('academy:navigate', sync) }
  }, [])
  useEffect(() => { Sound.setMuted(progress.muted) }, [progress.muted])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (settings.current?.open && event.target instanceof Node && !settings.current.contains(event.target)) settings.current.open = false
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settings.current?.open) { settings.current.open = false; settings.current.querySelector('summary')?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])

  const update = useCallback((next: Progress) => { setProgress(next); saveProgress(storage, next) }, [storage])
  const chapter = route.view === 'chapters' ? null : route.chapter
  // A locked chapter opens only as a preview; otherwise the address falls back to the list.
  const allowed = !chapter || preview || unlocked(progress, chapter)
  const view = allowed ? route.view : 'chapters'
  const screen = `${view}:${chapter?.id ?? ''}`
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    heading.current?.focus({ preventScroll: true })
    if (window.scrollY > 0) window.scrollTo(0, 0)
  }, [screen])

  const finish = useCallback((score: number) => {
    if (!chapter) return []
    const next = recordScore(progress, chapter, score)
    const earned = newlyEarned(progress, next)
    if (next !== progress) update(next)
    if (score >= PASS_SCORE) {
      const final = chapter === curriculum[curriculum.length - 1]
      if (final) Sound.commanderUnlocked(); else Sound.victory()
      celebrate(final)
    } else Sound.incorrect()
    return earned
  }, [chapter, progress, update])

  const closeAchievements = useCallback(() => setAchievements(false), [])
  const closeSettings = () => { if (settings.current) settings.current.open = false }
  const earnedCount = useMemo(() => [...ranks(progress), ...badges(progress)].filter(item => item.earned).length, [progress])

  return <div className="academy-app">
    <ExperienceBar name={experiences.academy.name} hubHref={fromPage.hub}>
      <button type="button" className="quiet" aria-haspopup="dialog" onClick={() => setAchievements(true)}>Achievements · {earnedCount}</button>
      <details className="nav-settings" ref={settings}>
        <summary>Settings</summary>
        <div className="nav-settings-menu">
          <button type="button" className="quiet" aria-pressed={!progress.muted} onClick={() => update({ ...progress, muted: !progress.muted })}>
            Sound: {progress.muted ? 'off' : 'on'}</button>
          <button type="button" className="quiet" aria-pressed={preview} onClick={() => setPreview(value => !value)}>
            Preview locked chapters: {preview ? 'on' : 'off'}</button>
          <button type="button" className="quiet" onClick={() => { closeSettings(); setConfirmReset(true) }}>Reset progress</button>
        </div>
      </details>
    </ExperienceBar>

    <div className="shell academy-shell">
      <main>
        {confirmReset && <section className="panel notice" aria-label="Confirm progress reset">
          <h2>Reset Academy progress?</h2>
          <p>This clears your best scores and the achievements that depend on them. The Orbiter and the Rover are not affected.</p>
          <div className="actions">
            <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button type="button" onClick={() => { update({ ...freshProgress(), muted: progress.muted }); setConfirmReset(false); setPreview(false) }}>Clear progress</button>
          </div>
        </section>}
        {preview && <p className="notice" role="status">Preview is on: locked chapters can be opened for a look. Scores still count, and progress rules do not change.</p>}
        {view === 'chapters' && <Chapters progress={progress} preview={preview} headingRef={heading}/>}
        {view === 'lesson' && chapter && <Lesson chapter={chapter} progress={progress} headingRef={heading}/>}
        {view === 'quiz' && chapter && <Quiz key={chapter.id} chapter={chapter} progress={progress} onFinish={finish} onAchievements={() => setAchievements(true)}/>}
      </main>
      <footer>Educational content · Lessons and simulators use simplified textbook models. Scores, ranks and badges are in-game achievements.</footer>
    </div>

    {achievements && <Dialog title="Achievements" close={closeAchievements} closeLabel="Close achievements">
      <p>Your rank is <strong>{rank(progress).name}</strong>, with {passedCount(progress)} of {curriculum.length} chapters passed.
        These are in-game achievements for this device. They are not a certification of any kind.</p>
      <AchievementList title="Ranks" items={ranks(progress)}/>
      <AchievementList title="Chapter badges" items={badges(progress)}/>
    </Dialog>}
  </div>
}
