import { useState } from 'react'
import type { Game } from '../app/controller'
import type { ReviewGate, TradeStudyEvidence, WarningId } from '../app/contracts'
import { configFields, fields, label, options, rationaleLabels } from '../app/options'
import type { Save } from '../app/save'
import { Orbit } from '../components/Orbit'
import { Findings, ResourceMetrics, metrics, number } from '../components/MissionData'

export function Briefing({ game }: { game: Game }) {
  return <section className="briefing grid-two">
    <div><p className="eyebrow">Robotic orbiter mission</p><h1>Investigate the<br/> lunar south pole.</h1>
      <p className="lede">Design an orbiter to look for evidence of water ice. The mission succeeds when enough ice-sensitive science reaches Earth.</p>
      <dl className="limits"><div><dt>Budget ceiling</dt><dd>120 BU</dd></div><div><dt>Launch mass cap</dt><dd>500 kg</dd></div></dl>
      <p>Choose four subsystems and a transfer, justify your design in review, then decide how to observe and downlink. After flight, change a single decision and compare the outcome.</p>
      <button className="primary" onClick={game.start}>Start mission <span aria-hidden>↗</span></button>
    </div>
    <div className="panel orbit-panel"><Orbit/><p className="eyebrow">South-pole observation geometry</p></div>
  </section>
}

export function Builder({ game, save }: { game: Game; save: Save }) {
  const report = game.engine?.evaluateFeasibility(save.config)
  return <section><h1>Spacecraft builder</h1><p className="lede">Save one candidate for the trade study, then change at least one selection to create a distinct design.</p>
    <div className="grid-two">
      <div className="panel selections">{configFields.map(field => <fieldset key={field}>
        <legend>{fields[field]}</legend>
        <div className="choices">{options[field].map(([id, name]) => <label key={id}>
          <input type="radio" name={field} checked={save.config[field] === id} onChange={() => game.select(field, id)}/><span>{name}</span>
        </label>)}</div>
      </fieldset>)}
        <div className="actions"><button onClick={game.saveAlternative}>Save trade study candidate</button>
          <button className="primary" onClick={game.reviews} disabled={!game.engine}>Open engineering review</button></div>
        {save.alternative && <p role="status">Candidate saved · {configFields.map(field => label(field, save.alternative![field])).join(' / ')}</p>}
      </div>
      <aside className="panel"><h2>Engineering limits</h2>
        {game.engine ? <ResourceMetrics report={game.engine.computeResources(save.config)}/> : <p>Resource analysis and launch review require the shared simulation engine.</p>}
        {report && <><h3>{report.eligible ? 'Engineering feasible' : 'Feasibility blockers'}</h3>
          <Findings findings={[...report.blockers, ...report.warnings]}/></>}
      </aside>
    </div>
  </section>
}

const gates: Record<ReviewGate, string> = { CML1: 'Charter', CML2: 'Feasibility', CML3: 'Trade study', CML4: 'Point design' }

export function Review({ game, save }: { game: Game; save: Save }) {
  const [rationale, setRationale] = useState<TradeStudyEvidence['rationale'] | ''>(save.evidence?.tradeStudy?.rationale ?? '')
  const { engine } = game
  if (!engine || !save.evidence) return null
  const { evidence, config, alternative } = save
  const report = engine.evaluateReviews(config, evidence)
  const warnings = engine.evaluateFeasibility(config).warnings
  const distinct = alternative && engine.hashConfig(alternative) !== engine.hashConfig(config)
  const active = engine.computeResources(config)
  const candidate = alternative && engine.computeResources(alternative)
  return <section><h1>Engineering review</h1><p className="lede">Complete four CML-inspired evidence gates to authorize this design for launch.</p>
    <div className="grid-two">
      <div className="panel"><h2>Review gates</h2><ol className="gate-list">{(Object.keys(gates) as ReviewGate[]).map(key => <li key={key}>
        <div className="spread"><strong>{key} · {gates[key]}</strong><span className="tag">{report.gates[key].passed ? 'Passed' : 'Open'}</span></div>
        <Findings findings={report.gates[key].findings}/>
      </li>)}</ol>
      <h3>Accept current warnings</h3>
      {warnings.length === 0 && <p>No warnings to acknowledge.</p>}
      {warnings.map(item => <label className="check" key={item.id}><input type="checkbox"
        checked={evidence.acknowledgedWarnings.includes(item.id as WarningId)}
        onChange={event => game.acknowledge(item.id as WarningId, event.target.checked)}/>{item.message}</label>)}
      </div>
      <div className="panel"><h2>Configuration trade study</h2>
        {candidate && alternative ? <div className="table-wrap"><table><thead><tr><th scope="col">Design factor</th><th scope="col">Saved candidate</th><th scope="col">Current design</th></tr></thead>
          <tbody>{configFields.map(key => <tr key={key}><th scope="row">{fields[key]}</th><td>{label(key, alternative[key])}</td><td>{label(key, config[key])}</td></tr>)}
          {(Object.keys(metrics) as (keyof typeof metrics)[]).map(key => <tr key={key}><th scope="row">{metrics[key][0]} ({metrics[key][1]})</th>
            <td>{number(candidate[key])}</td><td>{number(active[key])}</td></tr>)}</tbody></table></div> :
          <p>Return to the builder to save a trade study candidate.</p>}
        {candidate && !distinct && <p>Change at least one selection to make the current design distinct.</p>}
        <label className="control">Reason for choosing the current design
          <select value={rationale} onChange={event => setRationale(event.target.value as typeof rationale)}>
            <option value="">Choose a rationale</option>{Object.entries(rationaleLabels).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
        </label>
        <button disabled={!distinct || !rationale} onClick={() => { if (rationale) game.trade(rationale) }}>Record trade study</button>
        {evidence.tradeStudy && <p role="status">Recorded rationale · {rationaleLabels[evidence.tradeStudy.rationale]}</p>}
      </div>
    </div>
    <div className="actions"><button onClick={game.builder}>Back to builder</button><button className="primary" disabled={!report.authorized} onClick={game.launch}>Authorize launch</button></div>
  </section>
}
