import { useState } from 'react'
import type { Game } from '../app/controller'
import type { ReviewGate, TradeStudyEvidence, WarningId } from '../app/contracts'
import { configFields, fields, label, options, rationaleLabels } from '../app/options'
import type { Save } from '../app/save'
import { Orbit } from '../components/Orbit'
import { Findings, ResourceMetrics, metrics, number } from '../components/MissionData'

const optionNotes: Record<(typeof options)[(typeof configFields)[number]][number][0], string> = {
  mapping_camera: 'Maps the terrain, but cannot meet the ice science objective.',
  ice_spectrometer: 'Looks for signs of water ice near the lunar south pole.',
  solar_light: 'Saves mass, with less stored energy for time in shadow.',
  solar_storage: 'Stores more energy for observations in shadow.',
  prop_low: 'Lighter propulsion with less maneuvering reserve.',
  prop_high: 'More maneuvering reserve at a higher launch mass.',
  comms_basic: 'Returns less data during the downlink window.',
  comms_high: 'Returns more data and draws more power.',
  direct: 'Reaches the Moon sooner but requires more propulsion.',
  efficient: 'Takes longer and needs less propulsion.',
}

const weatherScenarios = {
  quiet: {
    label: 'Quiet solar conditions',
    outlook: 'Use this scenario to check whether the payload supports the mission’s science goal.',
    field: 'payloadId', choice: 'ice_spectrometer',
    ready: 'The spectrometer can look for signs of water ice.',
    gap: 'The mapping camera gives you terrain context. Choose the ice-sensitive spectrometer to investigate water ice.',
  },
  shadow: {
    label: 'Observation in shadow',
    outlook: 'During the observation window in shadow, the solar array stops generating power and the spacecraft draws on its battery.',
    field: 'powerId', choice: 'solar_storage',
    ready: 'Solar + storage gives your spacecraft more energy for the observation window.',
    gap: 'Lightweight solar has less stored energy. Consider solar + storage if the observation needs to run longer.',
  },
  solar: {
    label: 'Elevated solar activity',
    outlook: 'A solar disturbance can disrupt communications. Consider what you would prioritize if the link were only available briefly.',
    field: 'commsId', choice: 'comms_high',
    ready: 'The high-throughput antenna can return more science while the link is available.',
    gap: 'The basic antenna returns less data. Consider prioritizing the most valuable science packets.',
  },
} as const

function WeatherPlanner({ config }: { config: Save['config'] }) {
  const [scenario, setScenario] = useState<keyof typeof weatherScenarios>('quiet')
  const weather = weatherScenarios[scenario]
  const prepared = config[weather.field] === weather.choice
  return <section className="panel builder-weather">
    <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/> Environment / Scenario desk</p>
    <h2>Space weather</h2>
    <label className="control">
      Scenario
      <select value={scenario} onChange={event => {
        const selection = event.target.value
        if (selection === 'quiet' || selection === 'shadow' || selection === 'solar') setScenario(selection)
      }}>
        {Object.entries(weatherScenarios).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </select>
    </label>
    <div role="status">
      <p>{weather.outlook}</p>
      <p className="builder-weather-note"><strong>Your design</strong> {prepared ? weather.ready : weather.gap}</p>
    </div>
    <small>Scenarios are illustrative and do not change the flight simulation.</small>
  </section>
}

export function Builder({ game, save }: { game: Game; save: Save }) {
  const { config, alternative } = save
  const resources = game.engine?.computeResources(config)
  const report = game.engine?.evaluateFeasibility(config)
  const changed = configFields.filter(field => alternative && config[field] !== alternative[field])
  const candidateStatus = !alternative ? 'Save this design as a baseline for the trade study.'
    : changed.length === 0 ? 'Baseline saved. Change at least one option to create a design to compare.'
      : `${changed.length} of ${configFields.length} choices differ from your saved baseline.`

  return <section className="builder">
    <header className="builder-heading">
      <div className="builder-hero-copy">
        <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/> LUNA–01 / Mission design</p>
        <h1>Spacecraft builder</h1>
        <p className="lede">Build an orbiter to look for water ice. Pick one option in each category, then compare your design with a saved baseline.</p>
        <dl className="builder-brief">
          <div><dt>Target</dt><dd>Lunar south pole</dd></div>
          <div><dt>Objective</dt><dd>Water ice survey</dd></div>
        </dl>
      </div>
      <figure className="builder-orbit">
        <Orbit/>
        <figcaption><span>01 / Lunar approach</span><span>Orbit schematic</span></figcaption>
      </figure>
    </header>
    <div className="builder-layout">
      <div className="builder-choices">{configFields.map((field, index) => <fieldset className="panel builder-group" key={field} aria-labelledby={`builder-${field}`}>
        <h2 id={`builder-${field}`}><span aria-hidden="true">0{index + 1}</span> {fields[field]}</h2>
        <div className="builder-options">{options[field].map(([id, name]) => <label key={id}>
          <input type="radio" name={field} checked={config[field] === id} onChange={() => game.select(field, id)}
            aria-label={name} aria-describedby={`builder-${id}`}/>
          <span><strong>{name}</strong><small id={`builder-${id}`}>{optionNotes[id]}</small></span>
        </label>)}</div>
      </fieldset>)}</div>
      <aside className="builder-sidebar" aria-label="Design summary">
        <section className="panel builder-resources">
          <p className="eyebrow">Spacecraft / Resource envelope</p>
          <h2>Engineering limits</h2>
          <dl className="builder-caps">
            <div><dt>Budget</dt><dd>{resources ? <>{number(resources.costBU)} <small>/ </small></> : null}120 <small>BU</small></dd></div>
            <div><dt>Launch mass</dt><dd>{resources ? <>{number(resources.launchMassKg)} <small>/ </small></> : null}500 <small>kg</small></dd></div>
          </dl>
          {report ? <>
            <p className="tag" data-severity={report.eligible ? undefined : 'blocker'}>{report.eligible ? 'Engineering feasible' : 'Feasibility blockers'}</p>
            <Findings findings={[...report.blockers, ...report.warnings]}/>
          </> : <p>Live resource totals and engineering review need the shared simulation engine. You can still configure and save a design.</p>}
          {resources && <details><summary>All resource metrics</summary><ResourceMetrics report={resources}/></details>}
        </section>
        <WeatherPlanner config={config}/>
        <section className="panel builder-study">
          <p className="eyebrow">Configuration / Design log</p>
          <h2>Trade study</h2>
          <p role="status">{candidateStatus}</p>
          {alternative && <details><summary>Saved baseline</summary>
            <dl className="builder-baseline">{configFields.map(field => <div key={field}>
              <dt>{fields[field]}</dt><dd>{label(field, alternative[field])}{changed.includes(field) && <small> · Changed</small>}</dd>
            </div>)}</dl>
          </details>}
          <div className="builder-actions">
            <button className="quiet" onClick={game.saveAlternative}>{alternative ? 'Replace baseline with current design' : 'Save trade study candidate'}</button>
            <button className="primary" onClick={game.reviews} disabled={!game.engine}>Open engineering review</button>
          </div>
        </section>
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
