import { useState } from 'react'
import type { Game } from '../app/controller'
import type { Save } from '../app/save'
import type { MissionResult } from '../app/contracts'
import { options } from '../app/options'
import { Causes, number, outcomes, ResourceMetrics, Timeline } from '../components/MissionData'
import { Orbit } from '../components/Orbit'
import { ResourceChart, ScienceChart, ScoreChart } from '../components/DebriefCharts'
import { Term } from '../components/Term'

export function Flight({ game, save }: { game: Game; save: Save }) {
  const engine = game.engine!
  const event = save.observation && engine.resolveObservation(save.config, save.observation).event
  const resources = engine.computeResources(save.config)
  return <section><h1>Mission control</h1><ol className="stages" aria-label="Mission stages">
    <li>01 · Arrived in lunar orbit</li><li aria-current={!event ? 'step' : undefined}>02 · Observation</li><li aria-current={event ? 'step' : undefined}>03 · Downlink</li>
  </ol>
    <div className="grid-two"><div className="panel orbit-panel"><Orbit active/><h2>Vehicle telemetry</h2><ResourceMetrics report={resources}/></div>
      <div className="panel">
        {event ? <><h2>Choose downlink priority</h2><p>The spacecraft is back in sunlight and can call home. Decide what the <Term id="downlink">downlink</Term> sends first.</p>
          <p className="fine">Solar power supports the downlink. The model omits battery recharge.</p>
          <Choices items={options.downlinkAction} pick={id => game.downlink(id)}/>
          <h3>Event timeline</h3><Timeline events={[event]}/></> :
          <><h2>Choose an observation plan</h2><p>The spacecraft is entering the Moon’s shadow for two hours. The solar panels stop working, so everything runs on the <Term id="battery">battery</Term>, which starts full.</p>
            <Choices items={options.observeAction} pick={id => game.observe(id)}/></>}
      </div></div>
  </section>
}

const choiceNotes: Record<string, string> = {
  observe_full: 'Keep the instrument running in the dark. Collects all the science if the battery lasts.',
  conserve: 'Pause the instrument in the dark to protect the battery. Keeps only the half collected in sunlight.',
  science_first: 'Use the whole link for science data.',
  health_first: 'Save room for spacecraft diagnostics. Only 60% of the link carries science.',
}

function Choices<T extends string>({ items, pick }: { items: readonly (readonly [T, string])[]; pick: (id: T) => void }) {
  return <div className="choices-flight">{items.map(([id, name]) => <div className="choice-card" key={id}>
    <button onClick={() => pick(id)} aria-describedby={`choice-${id}`}>{name}</button>
    <p id={`choice-${id}`}>{choiceNotes[id]}</p>
  </div>)}</div>
}

export function Playback({ result, done }: { result: MissionResult; done: () => void }) {
  const [count, setCount] = useState(1)
  return <section><h1>Mission event playback</h1><div className="grid-two">
    <div className="panel orbit-panel"><Orbit active/></div>
    <div className="panel"><h2>Recorded events</h2><Timeline events={result.events.slice(0, count)}/>
      <div className="actions">{count < result.events.length && <button onClick={() => setCount(count + 1)}>Next event</button>}
        <button className="primary" onClick={done}>Open debrief</button></div></div>
  </div></section>
}

const categories = [
  ['science', 'Science return', 40], ['efficiency', 'Resource efficiency', 25], ['reliability', 'Reliability', 15],
  ['engineering', 'Engineering quality', 10], ['operations', 'Operations', 10],
] as const

export function Debrief({ game, result }: { game: Game; result: MissionResult }) {
  return <section><h1>Mission debrief</h1>
    <div className="panel result-strip">
      <div><small><Term id="outcome">Universe A · Outcome</Term></small><strong data-outcome={result.outcome}>{outcomes[result.outcome]}</strong></div>
      <div><small><Term id="mpi">Mission Performance Index</Term></small><strong>{number(result.score.mpi)} <span>/ 1,000</span></strong></div>
      <div><small><Term id="science">Science returned</Term></small><strong>{number(result.returnedSciencePoints)} <span>/ 100</span></strong></div>
    </div>
    <div className="grid-two debrief-charts"><ScoreChart result={result}/><ScienceChart result={result}/></div>
    <div className="grid-two"><div className="debrief-stack"><ResourceChart result={result}/>
      <details className="panel"><summary>All numbers</summary>
        <dl className="score-lines">{categories.map(([key, name, weight]) => <div key={key}>
          <dt>{name} <small>· {weight}% weight</small></dt><dd>{number(result.score[key])}/100</dd>
        </div>)}</dl><p>Raw MPI {number(result.score.rawMPI)} · Outcome cap {number(result.score.cap)}</p>
        <p>Science collected {number(result.collectedSciencePoints)} points · Raw science per resource {number(result.score.rawSciencePerResource)}</p>
        <ResourceMetrics report={result.resources}/>
      </details></div>
      <div className="panel"><h2>What shaped the result</h2><Causes causes={result.causes}/><h3>Event timeline</h3><Timeline events={result.events}/></div></div>
    <div className="actions"><button className="primary" onClick={game.multiverse}>Explore alternate universes</button>
      <p className="fine">Replay this mission with one decision changed to see what it would have done.</p></div>
  </section>
}
