import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from 'zustand'
import type { Game } from './app/controller'
import { Briefing } from './features/Briefing'
import type { TradeStudyEvidence } from './app/contracts'
import { Builder } from './features/Builder'
import { Review } from './features/Review'
import { RadioProvider, VoiceToggle } from './components/Radio'
import { Flight } from './features/Flight'
import { Debrief } from './features/Debrief'
import { TargetSelect } from './features/TargetSelect'
import { Multiverse } from './features/Multiverse'
import { Guide } from './components/Guide'
import { motionOK } from './space/motion'
import { SpaceBackdrop } from './space/SpaceBackdrop'
import { MultiplayerSession } from './features/multiplayer/Session'
import { codeFromLocation, loadMpSession } from './app/multiplayer/session'

const phases = {
  briefing: 'Briefing', target: 'Target', builder: 'Build', reviews: 'Review',
  flight: 'Mission control', debrief: 'Debrief', multiverse: 'Multiverse',
}
const phaseOrder = Object.keys(phases)

export function App({ game }: { game: Game }) {
  const { save, recovery, message, playback } = useStore(game.store)
  const [confirmReset, setConfirmReset] = useState(false)
  // The call sign lives in memory only; it is never written to the save.
  const [callSign, setCallSign] = useState('')
  const [mode, setMode] = useState<'choose' | 'solo' | 'multi'>(() =>
    (loadMpSession() || codeFromLocation()) ? 'multi' : 'choose')
  const [guide, setGuide] = useState(false)
  // Builder position and trade-study reason survive trips to the review and back (session only).
  const [builderStep, setBuilderStep] = useState(0)
  const [rationale, setRationale] = useState<TradeStudyEvidence['rationale'] | ''>('')
  const openStep = useCallback((step: number) => { setBuilderStep(step); game.builder() }, [game])
  const settings = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && settings.current && !settings.current.contains(event.target)) settings.current.open = false
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settings.current?.open) {
        settings.current.open = false
        settings.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const closeGuide = useCallback(() => setGuide(false), [])
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
  const backdrop = <SpaceBackdrop mode={intro ? 'intro' : phase === 'target' ? 'target' : 'app'}/>
  if (mode === 'multi') return <MultiplayerSession onSolo={() => setMode('solo')}/>
  if (intro) return <>{backdrop}<main className="intro" ref={content} tabIndex={-1}>
    {mode === 'choose' ? <section className="panel mp-home" style={{ margin: '0 auto' }}>
      <p className="intro-transmission"><span className="builder-signal" aria-hidden="true"/>Mission 01 · Incoming assignment</p>
      <h1>How do you want to fly?</h1>
      <p className="lede">Solo keeps your local draft. Create or join a guest mission to share one orbiter with a crew of 2–4.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => setMode('solo')}>Fly solo</button>
        <button type="button" onClick={() => setMode('multi')}>Create or join mission</button>
      </div>
    </section> : <Briefing start={name => { setCallSign(name); game.start() }}/>}
  </main></>
  return <RadioProvider>{backdrop}<div className="shell" ref={shell}>
    <header className="topbar">
      <div className="wordmark"><span aria-hidden>◒</span> LUNA–01</div>
      <ol className="progress" aria-label="Mission progress">{Object.entries(phases).map(([key, name], index) =>
        <li key={key} aria-current={phase === key ? 'step' : undefined}
          data-done={index < phaseOrder.indexOf(phase) || undefined}>{name}<span className="progress-count"> · {index + 1} of {phaseOrder.length}</span></li>)}</ol>
      <div className="topbar-actions">
        <button className="quiet" onClick={() => setGuide(true)} aria-haspopup="dialog">How to play</button>
        <details className="nav-settings" ref={settings}>
          <summary>Settings</summary>
          <div className="nav-settings-menu">
            <VoiceToggle/>
            <button className="quiet" onClick={() => {
              if (settings.current) settings.current.open = false
              setConfirmReset(true)
            }}>Reset session</button>
          </div>
        </details>
      </div>
    </header>
    {guide && <Guide close={closeGuide}/>}
    <main ref={content} tabIndex={-1}>
      {confirmReset && <section className="panel notice" aria-label="Confirm session reset"><h2>Reset this session?</h2>
        <p>This clears the spacecraft draft and all saved universes.</p><div className="actions">
          <button onClick={() => setConfirmReset(false)}>Cancel</button><button onClick={() => { game.reset(); setConfirmReset(false); setBuilderStep(0); setRationale('') }}>Clear session</button>
        </div></section>}
      {message && <p className="notice" role="status">{message}</p>}
      {recovery ? <section className="panel"><h1>Saved session needs attention</h1><p>{recovery}</p>
        <button className="primary" onClick={game.reset}>Reset saved session</button></section> : <>
        {save.phase === 'target' && <TargetSelect game={game} save={save} callSign={callSign}/>}
        {save.phase === 'builder' && <Builder game={game} save={save} step={builderStep} onStep={setBuilderStep}/>}
        {save.phase === 'reviews' && <Review game={game} save={save} openStep={openStep} rationale={rationale} onRationale={setRationale}/>}
        {phase === 'flight' && <Flight game={game} save={save} callSign={callSign} universe={playback ? root : undefined}/>}
        {save.phase === 'debrief' && !playback && root && save.collection &&
          <Debrief game={game} universe={root} collection={save.collection} targetId={save.targetId} callSign={callSign}/>}
        {save.phase === 'multiverse' && save.collection && <Multiverse game={game} collection={save.collection}/>}
      </>}
    </main>
    <footer>Educational model · Mission numbers and trajectories are illustrative. CML gates are game-level proxies.</footer>
  </div></RadioProvider>
}
