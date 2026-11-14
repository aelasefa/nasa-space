import { useEffect, useRef, useState } from 'react'
import type { Game } from '../app/controller'
import type { Save } from '../app/save'
import type { DownlinkAction, ResolvedEvent, SpacecraftConfig, Universe } from '../app/contracts'
import { scenario } from '../app/engine'
import { label, options } from '../app/options'
import {
  debriefLeadLine, eventById, findings, headline, points, recommend, shadowBeats, shadowEnergy, shadowLeadLine,
  type Recommendation,
} from '../app/story'
import { Causes, number, outcomes, ResourceMetrics, Timeline } from '../components/MissionData'
import { Orbit } from '../components/Orbit'
import { ResourceChart, ScienceChart, ScoreChart } from '../components/DebriefCharts'
import { EvidenceMap } from '../components/EvidenceMap'
import { ScienceLead } from '../components/ScienceLead'
import { Term } from '../components/Term'
import { motionOK } from '../space/motion'

const choiceNotes: Record<string, string> = {
  observe_full: 'Keep the sensor reading across the whole crater floor. Records everything if the battery lasts.',
  conserve: 'Pause the sensor in the dark to protect the battery. Keeps only the half of the survey recorded in sunlight.',
}

function BatteryGauge({ capacity, level, label: text }: { capacity: number | null; level: number | null; label: string }) {
  if (capacity === null || level === null) return null
  const share = capacity > 0 ? level / capacity : 0
  return <div className="battery" data-low={share < 0.2 || undefined}>
    <div className="spread"><span><Term id="battery">Usable battery</Term></span><strong>{number(level)} / {number(capacity)} Wh</strong></div>
    <div className="battery-track" role="meter" aria-label={text} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={level}>
      <span style={{ width: `${share * 100}%` }}/>
    </div>
    <small>{text}</small>
  </div>
}

/** The shadow pass, beat by beat. Plays itself, can be skipped, and never waits on a timer to unlock anything essential. */
function ShadowPass({ event, onBeat, onDone }: { event: ResolvedEvent; onBeat: (beat: number) => void; onDone: () => void }) {
  const { beats } = shadowBeats(event, scenario.shadowHours)
  const animate = motionOK()
  const [shown, setShown] = useState(animate ? 1 : beats.length)
  const done = shown >= beats.length
  const finished = useRef(false)

  useEffect(() => { onBeat(shown) }, [shown, onBeat])
  useEffect(() => {
    if (!done) {
      const timer = window.setTimeout(() => setShown(count => count + 1), 1500)
      return () => window.clearTimeout(timer)
    }
    if (!finished.current) { finished.current = true; onDone() }
  }, [done, shown, onDone])

  return <div className="shadow-pass">
    <ol className="beats">{beats.slice(0, shown).map(beat => <li key={beat.id} data-tone={beat.tone}>
      <strong>{beat.title}</strong><p>{beat.text}</p>
    </li>)}</ol>
    {!done && <button className="quiet" onClick={() => setShown(beats.length)}>Skip to result</button>}
  </div>
}

function DownlinkMoment({ game, save }: { game: Game; save: Save }) {
  const engine = game.engine!
  const observation = save.observation!
  const previews = options.downlinkAction.map(([id, name]) => {
    const attempt = engine.simulateMission({ config: save.config, decisions: { observeAction: observation, downlinkAction: id },
      scenarioId: 'lunar_south_pole_ice_v1', modelVersion: engine.modelVersion })
    const result = attempt.kind === 'completed' ? attempt.result : null
    return { id: id as DownlinkAction, name, result, capacity: result ? eventById(result, 'E2')?.metrics.scienceDownlinkCapacity : undefined }
  })
  const recorded = previews[0].result ? points(previews[0].result.collectedSciencePoints) : null
  const antenna = label('commsId', save.config.commsId).toLowerCase()
  const fullCapacity = previews.find(p => p.id === 'science_first')?.capacity
  return <section className="downlink-moment" aria-labelledby="downlink-title">
    <h2 id="downlink-title" tabIndex={-1}>Back in sunlight: what do we send first?</h2>
    <p>{recorded !== null && fullCapacity !== undefined
      ? <>The orbiter is holding <strong>{recorded} points</strong>. With the {antenna}, this <Term id="downlink">downlink</Term> can carry at most <strong>{points(fullCapacity)}</strong> science points.</>
      : <>Decide what the <Term id="downlink">downlink</Term> sends first.</>}</p>
    <div className="choices-flight">{previews.map(preview => {
      const sent = preview.result ? points(preview.result.returnedSciencePoints) : null
      return <div className="choice-card" key={preview.id}>
        <button onClick={() => game.downlink(preview.id)} aria-describedby={`choice-${preview.id}`}>{preview.name}</button>
        <div id={`choice-${preview.id}`}>
          {sent !== null && recorded !== null && <>
            <p className="choice-sends"><strong>Sends {sent} of {recorded}</strong> recorded points to Earth.</p>
            <div className="energy-bar" aria-hidden="true"><span style={{ width: `${recorded ? (sent / recorded) * 100 : 0}%` }}/></div>
          </>}
          <p>{preview.id === 'science_first' ? 'The whole link carries science data.'
            : 'Part of the link carries spacecraft diagnostics instead. Training comparison: this model doesn’t track what diagnostics are worth, so the only modeled effect is less science and a lower operations score.'}</p>
        </div>
      </div>
    })}</div>
  </section>
}

export function Flight({ game, save, callSign }: { game: Game; save: Save; callSign?: string }) {
  const engine = game.engine!
  const event = save.observation ? engine.resolveObservation(save.config, save.observation).event : null
  const resources = engine.computeResources(save.config)
  // After a reload the shadow pass has already happened: don't replay it.
  const [passDone, setPassDone] = useState(Boolean(save.observation))
  const [beat, setBeat] = useState(0)
  const downlinkHeading = useRef<HTMLDivElement>(null)
  const capacity = shadowEnergy(engine.resolveObservation(save.config, 'observe_full').event, scenario.shadowHours)?.available ?? null
  const pass = event ? shadowBeats(event, scenario.shadowHours) : null
  const inShadow = Boolean(event) && !passDone && beat < 4
  const level = pass && (passDone || beat >= 2) ? pass.remaining : capacity
  const stage = !event ? 'observe' : passDone ? 'downlink' : 'shadow'
  const onBoard = save.observation ? engine.simulateMission({ config: save.config,
    decisions: { observeAction: save.observation, downlinkAction: 'science_first' },
    scenarioId: 'lunar_south_pole_ice_v1', modelVersion: engine.modelVersion }) : null
  const recordedPoints = onBoard?.kind === 'completed' ? onBoard.result.collectedSciencePoints : 0

  useEffect(() => {
    if (stage !== 'downlink' || !event || save.collection) return
    const heading = downlinkHeading.current?.querySelector<HTMLElement>('#downlink-title')
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ block: 'start', behavior: motionOK() ? 'smooth' : 'auto' })
  }, [stage, event, save.collection])

  return <section className="mission-control">
    <h1>Mission control</h1>
    <ol className="stages" aria-label="Mission stages">
      <li>01 · Arrival</li>
      <li aria-current={stage !== 'downlink' ? 'step' : undefined}>02 · Shadow pass</li>
      <li aria-current={stage === 'downlink' ? 'step' : undefined}>03 · Downlink</li>
    </ol>
    <p className="arrival" role="status"><span aria-hidden="true">✓</span> Orbit achieved{callSign ? `, ${callSign}` : ''}. LUNA‑01 reached the Moon
      after {scenario.travelTime(save.config.trajectoryId)} on the {label('trajectoryId', save.config.trajectoryId).toLowerCase()},
      with {number(resources.deltaVMarginMps)} m/s of fuel to spare. It is now circling over the south pole.</p>

    <div className="mc-grid">
      <div className="panel mc-status" data-shadow={inShadow || undefined}>
        <div className="mc-orbit"><Orbit active/><span className="mc-shadow" aria-hidden="true"/></div>
        <BatteryGauge capacity={capacity} level={level} label={!event ? 'Full, charged in sunlight.'
          : inShadow ? 'Running on battery in shadow.' : 'After the shadow pass.'}/>
        {event && (passDone || beat >= 3) && <EvidenceMap title="Recorded on the orbiter"
          recorded={recordedPoints} received={null}/>}
      </div>

      <div className="panel mc-decision" ref={downlinkHeading}>
        {stage === 'observe' && <>
          <h2>Shadow pass: keep observing, or play it safe?</h2>
          <p>The orbiter is about to cross the Moon’s shadow for {scenario.shadowHours} hours. The solar panels stop working,
            so everything runs on the battery, which starts full.</p>
          <ScienceLead>The signal is on the crater floor, and the floor is in shadow. If we keep observing, we see all of it,
            as long as the battery lasts.</ScienceLead>
          <div className="choices-flight">{options.observeAction.map(([id, name]) => <div className="choice-card" key={id}>
            <button onClick={() => game.observe(id)} aria-describedby={`choice-${id}`}>{name}</button>
            <p id={`choice-${id}`}>{choiceNotes[id]}</p>
          </div>)}</div>
        </>}
        {event && !passDone && <>
          <h2>Shadow pass</h2>
          <ShadowPass event={event} onBeat={setBeat} onDone={() => setPassDone(true)}/>
        </>}
        {event && passDone && (() => {
          const result = pass!.beats.find(item => item.id === 'science')!
          return <div className="pass-result" data-tone={result.tone}>
            <p className="eyebrow">Shadow pass result</p>
            <p className="pass-headline"><strong>{result.title}.</strong> {result.text}</p>
            <details><summary>Replay the pass, step by step</summary><ol className="beats">{pass!.beats.map(item =>
              <li key={item.id} data-tone={item.tone}><strong>{item.title}</strong><p>{item.text}</p></li>)}</ol></details>
            <ScienceLead>{shadowLeadLine(event.status)}</ScienceLead>
          </div>
        })()}
        {stage === 'downlink' && <DownlinkMoment game={game} save={save}/>}
      </div>
    </div>

    <details className="panel mc-telemetry"><summary>Secondary telemetry</summary><ResourceMetrics report={resources}/></details>
  </section>
}

const categories = [
  ['science', 'Science return', 40], ['efficiency', 'Resource efficiency', 25], ['reliability', 'Reliability', 15],
  ['engineering', 'Engineering quality', 10], ['operations', 'Operations', 10],
] as const

function changeCost(game: Game, config: SpacecraftConfig, rec: Recommendation) {
  if (!(rec.field in config)) return 'No change in cost or mass: this is a flight decision.'
  const now = game.engine!.computeResources(config)
  const next = game.engine!.computeResources({ ...config, [rec.field]: rec.to })
  const sign = (value: number) => (value >= 0 ? '+' : '−') + number(Math.abs(value))
  return `Cost ${sign(next.costBU - now.costBU)} BU, mass ${sign(next.launchMassKg - now.launchMassKg)} kg.`
}

export function Debrief({ game, universe, callSign }: { game: Game; universe: Universe; callSign?: string }) {
  const { result, input } = universe
  const learned = findings(result)
  const rec = recommend(universe)
  const replay = (r: Recommendation) => { game.multiverse(); game.branch(universe.id, r.field, r.to) }
  return <section className="debrief"><h1>Mission debrief</h1>
    <div className="panel debrief-lead">
      <p className="eyebrow">Outcome · <span data-outcome={result.outcome}>{outcomes[result.outcome]}</span></p>
      <p className="debrief-headline">{headline(result, input.config)}</p>
    </div>

    <div className="grid-two debrief-story">
      <section className="panel" aria-labelledby="learned-title">
        <h2 id="learned-title">What Earth learned</h2>
        <EvidenceMap title="Recorded vs. received" recorded={result.collectedSciencePoints} received={result.returnedSciencePoints}/>
        <p>{learned.learned}</p>
        <h3>What’s still uncertain</h3>
        <p>{learned.uncertain}</p>
        <ScienceLead>{callSign ? `${callSign}, ${debriefLeadLine(result).replace(/^./, c => c.toLowerCase())}` : debriefLeadLine(result)}</ScienceLead>
        {input.decisions.downlinkAction === 'health_first' && <p className="fine">You chose Health first. Diagnostics went home too,
          but this model doesn’t track what they tell the team, so they add nothing here. The modeled effects are fewer science
          points and a lower operations score.</p>}
      </section>
      <section className="panel replay-card" aria-labelledby="replay-title">
        <h2 id="replay-title">Which decision would you change?</h2>
        {rec ? <>
          <p>{rec.why}</p>
          <p className="fine">{changeCost(game, input.config, rec)} Everything else stays the same, and the same model reruns the flight.</p>
          <button className="primary" onClick={() => replay(rec)}>{rec.action}</button>
          <button className="quiet" onClick={game.multiverse}>Choose a different change</button>
        </> : <>
          <p>Try changing one decision to see what it would have done.</p>
          <button className="primary" onClick={game.multiverse}>Explore alternate universes</button>
        </>}
      </section>
    </div>

    <h2 className="debrief-section">Score</h2>
    <div className="panel result-strip">
      <div><small><Term id="outcome">Outcome</Term></small><strong data-outcome={result.outcome}>{outcomes[result.outcome]}</strong></div>
      <div><small><Term id="mpi">Mission Performance Index</Term></small><strong>{number(result.score.mpi)} <span>/ 1,000</span></strong></div>
      <div><small><Term id="science">Science received</Term></small><strong>{number(points(result.returnedSciencePoints))} <span>/ 100</span></strong></div>
    </div>
    <p className="fine">The score ranks how well the mission used its resources. A high score is not proof of ice.</p>
    <div className="grid-two debrief-charts"><ScoreChart result={result}/><ScienceChart result={result}/></div>
    <div className="grid-two"><div className="debrief-stack"><ResourceChart result={result}/>
      <details className="panel"><summary>All numbers</summary>
        <dl className="score-lines">{categories.map(([key, name, weight]) => <div key={key}>
          <dt>{name} <small>· {weight}% weight</small></dt><dd>{number(result.score[key])}/100</dd>
        </div>)}</dl><p>Raw score {number(result.score.rawMPI)} · Outcome cap {number(result.score.cap)}</p>
        <p>Recorded on the orbiter {number(points(result.collectedSciencePoints))} points · Science per resource {number(result.score.rawSciencePerResource)}</p>
        <ResourceMetrics report={result.resources}/>
      </details>
      <details className="panel"><summary>Flight log</summary><Timeline events={result.events}/></details></div>
      <div className="panel"><h2>What shaped the result</h2><Causes causes={result.causes}/></div></div>
    {rec && <div className="actions"><button onClick={game.multiverse}>Explore alternate universes</button></div>}
  </section>
}
