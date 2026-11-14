import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Game } from './app/controller'
import { Briefing, Builder, Review } from './features/Design'
import { Debrief, Flight, Playback } from './features/Flight'
import { Multiverse } from './features/Multiverse'

const phases = {
  briefing: 'Briefing', builder: 'Builder', reviews: 'Review',
  flight: 'Mission control', debrief: 'Debrief', multiverse: 'Multiverse',
}

export function App({ game }: { game: Game }) {
  const { save, recovery, message, playback } = useStore(game.store)
  const [confirmReset, setConfirmReset] = useState(false)
  const content = useRef<HTMLElement>(null)
  useEffect(() => { content.current?.focus() }, [save.phase, playback])
  const root = save.collection?.universes[0]
  const phase = playback ? 'flight' : save.phase
  return <div className="shell">
    <header className="topbar">
      <div className="wordmark"><span aria-hidden>◒</span> LUNA–01</div>
      <ol className="progress" aria-label="Mission progress">{Object.entries(phases).map(([key, name]) =>
        <li key={key} aria-current={phase === key ? 'step' : undefined}>{name}</li>)}</ol>
      <button className="quiet" onClick={() => setConfirmReset(true)}>Reset session</button>
    </header>
    <main ref={content} tabIndex={-1}>
      {confirmReset && <section className="panel notice" aria-label="Confirm session reset"><h2>Reset this session?</h2>
        <p>This clears the spacecraft draft and all saved universes.</p><div className="actions">
          <button onClick={() => setConfirmReset(false)}>Cancel</button><button onClick={() => { game.reset(); setConfirmReset(false) }}>Clear session</button>
        </div></section>}
      {message && <p className="notice" role="status">{message}</p>}
      {recovery ? <section className="panel"><h1>Saved session needs attention</h1><p>{recovery}</p>
        <button className="primary" onClick={game.reset}>Reset saved session</button></section> : <>
        {save.phase === 'briefing' && <Briefing game={game}/>}
        {save.phase === 'builder' && <Builder game={game} save={save}/>}
        {save.phase === 'reviews' && <Review game={game} save={save}/>}
        {save.phase === 'flight' && <Flight game={game} save={save}/>}
        {save.phase === 'debrief' && root && (playback ? <Playback done={game.finishPlayback} result={root.result}/> :
          <Debrief game={game} result={root.result}/>)}
        {save.phase === 'multiverse' && save.collection && <Multiverse game={game} collection={save.collection}/>}
      </>}
    </main>
    <footer>Educational model · Mission numbers and trajectories are illustrative. CML gates are game-level proxies.</footer>
  </div>
}
