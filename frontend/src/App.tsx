import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from 'zustand'
import type { Game } from './app/controller'
import { Briefing } from './features/Briefing'
import { Builder, Review } from './features/Design'
import { Debrief, Flight, Playback } from './features/Flight'
import { Multiverse } from './features/Multiverse'
import { PREVIEW_MODEL_VERSION } from './app/previewEngine'
import { motionOK } from './space/motion'
import { SpaceBackdrop } from './space/SpaceBackdrop'

const phases = {
  briefing: 'Briefing', builder: 'Builder', reviews: 'Review',
  flight: 'Mission control', debrief: 'Debrief', multiverse: 'Multiverse',
}

export function App({ game }: { game: Game }) {
  const { save, recovery, message, playback } = useStore(game.store)
  const [confirmReset, setConfirmReset] = useState(false)
  const content = useRef<HTMLElement>(null)
  const leavingIntro = useRef(false)
  useEffect(() => {
    if (leavingIntro.current && save.phase === 'builder') {
      content.current?.focus({ preventScroll: true })
      if (window.scrollY > 0) window.scrollTo(0, 0)
    } else {
      content.current?.focus()
    }
    leavingIntro.current = save.phase === 'briefing'
  }, [save.phase, playback])
  const root = save.collection?.universes[0]
  const phase = playback ? 'flight' : save.phase
  const intro = phase === 'briefing' && !recovery
  const shell = useRef<HTMLDivElement>(null)
  // Each phase arrives like a new transmission: content rises out of the starfield.
  useLayoutEffect(() => {
    if (intro || !motionOK() || !content.current) return
    const ctx = gsap.context(() => {
      gsap.from(content.current!.querySelectorAll(':scope > section > *'), {
        opacity: 0, y: 20, duration: 0.6, stagger: 0.04, ease: 'power3.out', clearProps: 'opacity,transform',
      })
    }, content)
    return () => ctx.revert()
  }, [intro, phase])
  useLayoutEffect(() => {
    if (intro || !motionOK() || !shell.current) return
    const ctx = gsap.context(() => {
      gsap.from('.topbar > *', { opacity: 0, y: -16, duration: 1, stagger: 0.08, ease: 'expo.out', clearProps: 'all' })
    }, shell)
    return () => ctx.revert()
  }, [intro])
  const backdrop = <SpaceBackdrop mode={intro ? 'intro' : 'app'}/>
  if (intro) return <>{backdrop}<main className="intro" ref={content} tabIndex={-1}>
    <Briefing start={game.start}/>
  </main></>
  return <>{backdrop}<div className="shell" ref={shell}>
    <header className="topbar">
      <div className="wordmark"><span aria-hidden>◒</span> LUNA–01</div>
      <ol className="progress" aria-label="Mission progress">{Object.entries(phases).map(([key, name]) =>
        <li key={key} aria-current={phase === key ? 'step' : undefined}>{name}</li>)}</ol>
      <button className="quiet" onClick={() => setConfirmReset(true)}>Reset session</button>
    </header>
    {game.engine?.modelVersion === PREVIEW_MODEL_VERSION && <p className="preview-banner" role="note">
      <strong>Preview engine</strong> The shared simulation engine is not connected. Resource totals are planning
      estimates; flight outcomes, science and scores are placeholders.
    </p>}
    <main ref={content} tabIndex={-1}>
      {confirmReset && <section className="panel notice" aria-label="Confirm session reset"><h2>Reset this session?</h2>
        <p>This clears the spacecraft draft and all saved universes.</p><div className="actions">
          <button onClick={() => setConfirmReset(false)}>Cancel</button><button onClick={() => { game.reset(); setConfirmReset(false) }}>Clear session</button>
        </div></section>}
      {message && <p className="notice" role="status">{message}</p>}
      {recovery ? <section className="panel"><h1>Saved session needs attention</h1><p>{recovery}</p>
        <button className="primary" onClick={game.reset}>Reset saved session</button></section> : <>
        {save.phase === 'builder' && <Builder game={game} save={save}/>}
        {save.phase === 'reviews' && <Review game={game} save={save}/>}
        {save.phase === 'flight' && <Flight game={game} save={save}/>}
        {save.phase === 'debrief' && root && (playback ? <Playback done={game.finishPlayback} result={root.result}/> :
          <Debrief game={game} result={root.result}/>)}
        {save.phase === 'multiverse' && save.collection && <Multiverse game={game} collection={save.collection}/>}
      </>}
    </main>
    <footer>Educational model · Mission numbers and trajectories are illustrative. CML gates are game-level proxies.</footer>
  </div></>
}
