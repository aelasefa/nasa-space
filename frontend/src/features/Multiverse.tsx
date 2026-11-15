import { useState } from 'react'
import type { Game } from '../app/controller'
import type { MutableField, ResourceReport, Universe, UniverseCollection, UniverseComparison } from '../app/contracts'
import { decisionFields, fields, label, options } from '../app/options'
import { Causes, delta, eventNames, metrics, number, outcomes } from '../components/MissionData'
import { metricLabels, plain, points, recommend, statusLabel } from '../app/story'
import { explainReplay } from '../app/replay'
import { ScreenHeader } from '../components/Screen'

function Inputs({ universe }: { universe: Universe }) {
  const change = universe.change
  return change ? <span>{fields[change.field]} · {label(change.field, change.from)} → {label(change.field, change.to)}</span> : <span>Original mission</span>
}

function Tree({ universes, id, selected, onSelect }: {
  universes: Universe[]; id: string; selected: string; onSelect: (id: string) => void
}) {
  const universe = universes.find(item => item.id === id)!
  const children = universes.filter(item => item.parentId === id)
  return <li><button aria-pressed={selected === id} onClick={() => onSelect(id)}>
    <strong>Universe {id}</strong><Inputs universe={universe}/>
    <small>{outcomes[universe.result.outcome]} · {universe.result.score.mpi} MPI</small>
  </button>{children.length > 0 && <ul>{children.map(child =>
    <Tree key={child.id} universes={universes} id={child.id} selected={selected} onSelect={onSelect}/>)}</ul>}</li>
}

export function Comparison({ a, b, result, explain = true }: { a: Universe; b: Universe; result: UniverseComparison; explain?: boolean }) {
  const reading = explain && b.parentId === a.id ? explainReplay(a, b) : null
  const rows = (Object.keys(metrics) as (keyof ResourceReport)[]).map(key => ({
    name: metrics[key][0], unit: metrics[key][1], a: a.result.resources[key], b: b.result.resources[key], delta: result.resourceDeltas[key],
  }))
  rows.unshift(
    { name: 'Mission Performance Index', unit: 'MPI', a: a.result.score.mpi, b: b.result.score.mpi, delta: result.mpiDelta },
    { name: 'Science returned', unit: 'points', a: a.result.returnedSciencePoints, b: b.result.returnedSciencePoints, delta: result.scienceDelta },
  )
  const events = Object.entries(result.eventChanges) as [keyof typeof eventNames, NonNullable<UniverseComparison['eventChanges'][keyof typeof eventNames]>][]
  return <>
    <div className="comparison-title"><h2>Universe {a.id} → Universe {b.id}</h2>
      <p className="tag">{outcomes[result.outcomeTransition.from]} → {outcomes[result.outcomeTransition.to]}</p></div>
    {result.changedFields.map(change => <p className="change" key={change.field}><strong>{fields[change.field]}</strong> · {label(change.field, change.from)} → {label(change.field, change.to)}</p>)}
    {result.changedFields.length === 0 && <p>Both universes have identical mission inputs.</p>}
    <Summary a={a} b={b} result={result}/>
    {reading && <div className="replay-why"><p><strong>Why:</strong> {reading.why}</p><p><strong>Remaining bottleneck:</strong> {reading.bottleneck}</p></div>}
    <div className="table-wrap"><table><thead><tr><th scope="col">Mission measure</th><th scope="col">Universe {a.id}</th><th scope="col">Universe {b.id}</th><th scope="col">Δ</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name} ({row.unit})</th>
        <td>{number(row.a)}</td><td>{number(row.b)}</td><td className={row.delta ? 'changed' : ''}>{delta(row.delta)}</td></tr>)}</tbody></table></div>
    <h3>Event differences</h3>
    {events.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Event</th><th scope="col">Universe {a.id}</th><th scope="col">Universe {b.id}</th></tr></thead>
      <tbody>{events.map(([key, change]) => <tr key={key}><th scope="row">{eventNames[key]}</th>
        {[change.from, change.to].map((event, index) => <td key={index}><strong>{statusLabel(event.status)}</strong><p>{plain(event.description)}</p>
          {Object.entries(event.metrics).map(([name, value]) => {
            const [text, format] = metricLabels[name] ?? [name, number]
            return <small className="event-metric" key={name}>{text} · {format(value)}</small>
          })}</td>)}</tr>)}</tbody>
    </table></div> : <p>The recorded events are identical.</p>}
    <h3>Causal explanations</h3><div className="comparison-causes">{[a, b].map(universe =>
      <article key={universe.id}><h4>Universe {universe.id}</h4><Causes causes={universe.result.causes}/></article>)}</div>
  </>
}

const order = ['arrival', 'E1', 'E2'] as const
const signed = (value: number, unit: string) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${number(Math.abs(value))} ${unit}`

/** First flight event that changed, plus what the change gained and what it cost. */
function Summary({ a, b, result }: { a: Universe; b: Universe; result: UniverseComparison }) {
  const first = order.find(id => result.eventChanges[id])
  const change = first && result.eventChanges[first]
  const science = points(b.result.returnedSciencePoints) - points(a.result.returnedSciencePoints)
  const cost = result.resourceDeltas.costBU
  const mass = result.resourceDeltas.launchMassKg
  return <div className="compare-summary">
    {change ? <p className="first-change"><span className="tag">First difference</span> <strong>{eventNames[first]}</strong>:
      {' '}{statusLabel(change.from.status)} in Universe {a.id} → <strong>{statusLabel(change.to.status)}</strong> in Universe {b.id}.</p>
      : <p className="first-change">No flight event changed.</p>}
    <dl className="gain-cost">
      <div><dt>Science received on Earth</dt><dd data-good={science > 0 || undefined} data-bad={science < 0 || undefined}>{signed(science, 'points')}</dd></div>
      <div><dt>Score</dt><dd>{signed(result.mpiDelta, 'MPI')}</dd></div>
      <div><dt>Cost</dt><dd>{signed(cost, 'BU')}</dd></div>
      <div><dt>Launch mass</dt><dd>{signed(mass, 'kg')}</dd></div>
    </dl>
  </div>
}

export function Multiverse({ game, collection }: { game: Game; collection: UniverseCollection }) {
  const { rootId, universes } = collection
  const [parentId, setParent] = useState(rootId)
  const [comparisonId, setComparison] = useState(universes.at(-1)?.id !== rootId ? universes.at(-1)!.id : '')
  const [field, setField] = useState<MutableField>('commsId')
  const parent = universes.find(item => item.id === parentId)!
  const target = universes.find(item => item.id === comparisonId && item.id !== parentId)
  const from = { ...parent.input.config, ...parent.input.decisions }[field]
  const next = options[field].find(([value]) => value !== from)!
  const full = universes.length >= 8
  const rec = recommend(parent)
  const existing = rec && universes.find(item => item.parentId === parentId && item.change?.field === rec.field && item.change.to === rec.to)

  return <section className="multiverse">
    <ScreenHeader eyebrow="LUNA‑01 · Multiverse" title="Multiverse explorer"
      lede="Change one decision, rerun the same flight with the same model, and see what that single choice did."
      aside={<button type="button" onClick={game.debrief}>Back to debrief</button>}/>
    <div className="multiverse-grid">
      <aside><div className="panel"><div className="spread"><h2>Universe tree</h2><span className="tag">{universes.length} / 8</span></div>
        <ul className="tree"><Tree universes={universes} id={rootId} selected={parentId} onSelect={id => {
          setParent(id)
          if (id === comparisonId) setComparison(parentId)
        }}/></ul></div>
        {rec && <div className="panel replay-card"><p className="eyebrow">Recommended replay</p>
          <h2>{rec.action}</h2><p>{rec.why}</p>
          {existing ? <p className="fine">Already replayed as Universe {existing.id}.</p> : !full &&
            <button className="primary" onClick={() => { const id = game.branch(parentId, rec.field, rec.to); if (id) setComparison(id) }}>{rec.action}</button>}
        </div>}
        <div className="panel"><h2>Try a different change</h2>
          <p className="fine">Branching from Universe {parentId}. Replays skip the review gates, but engineering limits still apply.</p>
          <label className="control">Decision to change<select value={field} onChange={event => setField(event.target.value as MutableField)}>
            {decisionFields.map(key => <option key={key} value={key}>{fields[key]}</option>)}</select></label>
          <p className="change">{label(field, from)} → <strong>{next[1]}</strong></p>
          {full ? <p>All eight slots are used. Reset the session to start a new tree.</p> :
            <button className="primary" onClick={() => {
              const id = game.branch(parentId, field, next[0])
              if (id) setComparison(id)
            }}>Simulate alternate universe</button>}
        </div>
      </aside>
      <div className="panel">
        <label className="control">Compare Universe {parentId} with<select value={target?.id ?? ''} onChange={e => setComparison(e.target.value)}>
          <option value="">Select a completed universe</option>
          {universes.filter(item => item.id !== parentId).map(item => <option key={item.id} value={item.id}>Universe {item.id}</option>)}</select></label>
        {target ? <Comparison a={parent} b={target} result={game.engine!.compareUniverses(parent, target)}/> :
          <div className="empty"><h2>Compare two mission outcomes</h2><p>Simulate a branch to see how one engineering or operations decision affects resources, science and score.</p></div>}
      </div>
    </div>
  </section>
}
