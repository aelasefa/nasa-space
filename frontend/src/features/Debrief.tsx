import type { Game } from '../app/controller'
import type { SpacecraftConfig, Universe, UniverseCollection } from '../app/contracts'
import { regionById } from '../app/regions'
import { explainReplay } from '../app/replay'
import { debriefLeadLine, findings, headline, points, recommend, type Recommendation } from '../app/story'
import { ResourceChart, ScienceChart, ScoreChart } from '../components/DebriefCharts'
import { EvidenceMap } from '../components/EvidenceMap'
import { Causes, number, outcomes, ResourceMetrics, Timeline } from '../components/MissionData'
import { ScienceLead } from '../components/ScienceLead'
import { Readout, ScreenHeader } from '../components/Screen'
import { Term } from '../components/Term'
import { luna01 } from '../missions/luna01'
import { Comparison } from './Multiverse'

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

export function Debrief({ game, universe, collection, targetId, callSign }: {
  game: Game; universe: Universe; collection: UniverseCollection; targetId?: string | null; callSign?: string
}) {
  const { result, input } = universe
  const learned = findings(result)
  const target = regionById(targetId)
  const latest = collection.universes.at(-1)!
  const parent = latest.parentId ? collection.universes.find(item => item.id === latest.parentId) : undefined
  const reading = parent ? explainReplay(parent, latest) : null
  const rec = recommend(latest)
  const full = collection.universes.length >= 8
  const replayed = rec && collection.universes.some(item => item.parentId === latest.id && item.change?.field === rec.field && item.change.to === rec.to)
  const replay = (r: Recommendation) => game.branch(latest.id, r.field, r.to)

  return <section className="debrief">
    <ScreenHeader eyebrow={`${luna01.name} · Debrief${target ? ` · ${target.name}` : ''}`} title="Mission debrief"/>
    <div className="panel debrief-lead">
      <p className="eyebrow">Outcome · <span data-outcome={result.outcome}>{outcomes[result.outcome]}</span>
        {target && <> · Observed from orbit: {target.name}</>}</p>
      <p className="debrief-headline">{headline(result, input.config)}</p>
    </div>

    <div className="grid-two debrief-story">
      <section className="panel" aria-labelledby="learned-title">
        <h2 id="learned-title">What Earth learned</h2>
        <p className="debrief-finding">{learned.learned}</p>
        <h2 className="debrief-uncertain">What’s still uncertain</h2>
        <p className="debrief-finding">{learned.uncertain}</p>
        <EvidenceMap title="Recorded vs. received" recorded={result.collectedSciencePoints} received={result.returnedSciencePoints}/>
        <ScienceLead>{callSign ? `${callSign}, ${debriefLeadLine(result).replace(/^./, c => c.toLowerCase())}` : debriefLeadLine(result)}</ScienceLead>
        {input.decisions.downlinkAction === 'health_first' && <p className="fine">You chose Health first. Diagnostics went home too,
          but this model doesn’t track what they tell the team, so they add nothing here. The modeled effects are fewer science
          points and a lower operations score.</p>}
      </section>
      <section className="panel replay-card" aria-labelledby="replay-title">
        {reading && parent && <div className="replay-result" role="status">
          <p className="eyebrow">Replay · Universe {parent.id} → Universe {latest.id}</p>
          <p className="change">{reading.change}</p>
          <dl className="readouts">
            <Readout label="Score" value={reading.scoreDelta} tone={latest.result.score.mpi > parent.result.score.mpi ? 'good' : latest.result.score.mpi < parent.result.score.mpi ? 'bad' : undefined}/>
            <Readout label="Science returned" value={reading.scienceDelta}
              tone={latest.result.returnedSciencePoints > parent.result.returnedSciencePoints ? 'good' : latest.result.returnedSciencePoints < parent.result.returnedSciencePoints ? 'bad' : undefined}/>
          </dl>
          <p><strong>Why:</strong> {reading.why}</p>
          <p><strong>Remaining bottleneck:</strong> {reading.bottleneck}</p>
        </div>}
        <h2 id="replay-title">{reading ? 'Change one more thing?' : 'Which decision would you change?'}</h2>
        {rec && !replayed && !full ? <>
          <p>{rec.why}</p>
          <p className="fine">{changeCost(game, latest.input.config, rec)} Everything else stays the same, and the same model reruns the flight{parent ? ` from Universe ${latest.id}` : ''}.</p>
          <button type="button" className="primary" onClick={() => replay(rec)}>{rec.action}</button>
          <button type="button" className="quiet" onClick={game.multiverse}>Choose a different change</button>
        </> : <>
          <p>{full ? 'All eight universes are used.' : 'Try changing one decision in the Multiverse Explorer to see what it would have done.'}</p>
          <button type="button" className="primary" onClick={game.multiverse}>Open the Multiverse Explorer</button>
        </>}
      </section>
    </div>

    {reading && parent && <section className="panel debrief-compare" aria-label="Full universe comparison">
      <Comparison a={parent} b={latest} result={game.engine!.compareUniverses(parent, latest)} explain={false}/>
    </section>}

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
  </section>
}
