import { useState } from 'react'
import type { Game } from '../app/controller'
import type { Save } from '../app/save'
import type { MissionResult } from '../app/contracts'
import { options } from '../app/options'
import { Causes, number, outcomes, ResourceMetrics, Timeline } from '../components/MissionData'
import { Orbit } from '../components/Orbit'
import { PREVIEW_MODEL_VERSION } from '../app/previewEngine'

export function Flight({ game, save }: { game: Game; save: Save }) {
  const engine = game.engine!
  const event = save.observation && engine.resolveObservation(save.config, save.observation).event
  const resources = engine.computeResources(save.config)
  return <section><h1>Mission control</h1><ol className="stages" aria-label="Mission stages">
    <li>01 · Arrived in lunar orbit</li><li aria-current={!event ? 'step' : undefined}>02 · Observation</li><li aria-current={event ? 'step' : undefined}>03 · Downlink</li>
  </ol>
    <div className="grid-two"><div className="panel orbit-panel"><Orbit active/><h2>Vehicle telemetry</h2><ResourceMetrics report={resources}/></div>
      <div className="panel">
        {event ? <><h2>Choose downlink priority</h2><p>The link opens in sunlight. Solar power supports downlink. The model omits battery recharge dynamics.</p>
          <div className="actions">{options.downlinkAction.map(([id, name]) => <button key={id} onClick={() => game.downlink(id)}>{name}</button>)}</div>
          <h3>Event timeline</h3><Timeline events={[event]}/></> :
          <><h2>Choose an observation plan</h2><p>The two-hour low-illumination window starts with a full usable battery and zero solar generation.</p>
            <p>Conserve battery to skip the shadow segment and retain science collected in sunlight.</p>
            <div className="actions">{options.observeAction.map(([id, name]) => <button key={id} onClick={() => game.observe(id)}>{name}</button>)}</div></>}
      </div></div>
  </section>
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
  // The preview adapter records decisions only; never present its placeholders as a simulated result.
  const simulated = game.engine?.modelVersion !== PREVIEW_MODEL_VERSION
  const value = (n: number) => simulated ? number(n) : '—'
  return <section><h1>Mission debrief</h1>
    <div className="panel result-strip">
      <div><small>Universe A · Outcome</small>{simulated
        ? <strong data-outcome={result.outcome}>{outcomes[result.outcome]}</strong>
        : <strong>Not simulated</strong>}</div>
      <div><small>Mission Performance Index</small><strong>{value(result.score.mpi)} <span>/ 1,000</span></strong></div>
      <div><small>Science returned</small><strong>{value(result.returnedSciencePoints)} <span>/ 100</span></strong></div>
    </div>
    <div className="grid-two"><div className="panel"><h2>Score breakdown</h2>
      <dl className="score-lines">{categories.map(([key, name, weight]) => <div key={key}>
        <dt>{name} <small>· {weight}% weight</small></dt><dd><meter min="0" max="100" value={result.score[key]} /> {number(result.score[key])}/100</dd>
      </div>)}</dl><p>Raw MPI {number(result.score.rawMPI)} · Outcome cap {number(result.score.cap)}</p>
      <p>Science collected {number(result.collectedSciencePoints)} points · Raw science per resource {number(result.score.rawSciencePerResource)}</p>
      <h3>Resource use</h3><ResourceMetrics report={result.resources}/>
    </div><div className="panel"><h2>What shaped the result</h2><Causes causes={result.causes}/><h3>Event timeline</h3><Timeline events={result.events}/></div></div>
    <div className="actions"><button className="primary" onClick={game.multiverse}>Explore alternate universes</button></div>
  </section>
}
