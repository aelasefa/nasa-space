import { useEffect, useRef, useState } from 'react'
import type { Game } from '../app/controller'
import type { ConfigField, PowerId, TradeStudyEvidence } from '../app/contracts'
import { limits, scenario } from '../app/engine'
import { configFields, fields, label, options, rationaleLabels } from '../app/options'
import { estimateResources } from '../app/planning'
import { regionById } from '../app/regions'
import type { Save } from '../app/save'
import { shadowEnergy } from '../app/story'
import { Findings, number, ResourceMetrics } from '../components/MissionData'
import { Term } from '../components/Term'
import { Transmission } from '../components/Radio'
import { CraftView } from '../craft/CraftView'
import { luna01 } from '../missions/luna01'
import type { MissionDefinition } from '../missions/types'
import { WeatherPlanner } from './Design'
import { DesignComparison, MissionRehearsal } from './MissionPlanning'

export function Builder({ game, save, mission = luna01 }: { game: Game; save: Save; mission?: MissionDefinition }) {
  const { config, alternative, evidence } = save
  const { engine } = game
  const end = mission.steps.length
  const [index, setIndex] = useState(() => evidence?.tradeStudy ? end : 0)
  const [rationale, setRationale] = useState<TradeStudyEvidence['rationale'] | ''>(evidence?.tradeStudy?.rationale ?? '')
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const step = mission.steps[index]
  const target = regionById(save.targetId)
  const resources = engine?.computeResources(config) ?? estimateResources(config)
  const feasibility = engine?.evaluateFeasibility(config)
  const findings = feasibility ? [...feasibility.blockers, ...feasibility.warnings] : []
  const baseline = engine && alternative ? engine.computeResources(alternative) : undefined
  const distinct = engine && alternative && engine.hashConfig(config) !== engine.hashConfig(alternative)
  const radio = step?.radio && mission.crew[step.radio.from]
  const described = [...new Set(mission.steps.flatMap(item => item.fields))]
  const craftLabel = [mission.name, ...configFields.map(field => label(field, config[field]))].join(' · ')

  useEffect(() => {
    if (engine && !alternative) game.baselineStarter()
  }, [engine, game, alternative])
  useEffect(() => {
    if (moved.current) {
      heading.current?.focus({ preventScroll: true })
      heading.current?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [index])
  const go = (next: number) => {
    moved.current = true
    setIndex(next)
  }

  function choices(field: ConfigField) {
    return <fieldset className="assembly-choices" key={field}>
      <legend>{fields[field]}</legend>
      {options[field].map(([id, name]) => {
        const info = mission.options[id]
        const specs = mission.specs(field, id)
        const energy = step?.preview === 'shadow-energy' && engine && field === 'powerId'
          ? shadowEnergy(engine.resolveObservation({ ...config, powerId: id as PowerId }, 'observe_full').event, scenario.shadowHours)
          : null
        const inputId = `assembly-${field}-${id}`
        return <div className="assembly-option" key={id} data-selected={config[field] === id || undefined}>
          <div className="assembly-option-name">
            <input type="radio" id={inputId} name={field} checked={config[field] === id}
              aria-describedby={`${inputId}-details`} onChange={() => game.select(field, id)}/>
            <label htmlFor={inputId}>{name}</label>
            {config[field] === id && <span className="tag" aria-hidden="true">Installed</span>}
          </div>
          <div id={`${inputId}-details`}>
            {info && <><p>{info.what}</p><p><strong>Trade-off:</strong> {info.tradeoff}</p></>}
            {(specs.length > 0 || energy) && <dl className="assembly-specs">
              {specs.filter(spec => !energy || spec.label !== 'Battery').map(spec => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
              {energy && <>
                <div><dt>Energy available</dt><dd>{number(energy.available)} Wh</dd></div>
                <div><dt>Needed for a full pass</dt><dd>{number(energy.needed)} Wh</dd></div>
                <div><dt>Survey coverage</dt><dd>{Math.round(energy.coverage * 100)}%</dd></div>
              </>}
            </dl>}
          </div>
        </div>
      })}
    </fieldset>
  }

  return <section className="assembly">
    <header className="builder-brief spread">
      <div><p className="eyebrow">{mission.name} / Assembly bay</p><h1>Spacecraft builder</h1></div>
      {target && <div className="assembly-target"><dl><dt>Observation target</dt><dd>{target.name}</dd></dl>
        <button onClick={game.retarget}>Change</button></div>}
    </header>
    <nav aria-label="Assembly progress"><ol className="assembly-steps">
      {mission.steps.map((item, i) => <li key={item.id}><button type="button" onClick={() => go(i)}
        aria-current={i === index ? 'step' : undefined}><span aria-hidden="true">{i + 1}</span> {item.label}</button></li>)}
      <li><button type="button" onClick={() => go(end)} aria-current={index === end ? 'step' : undefined}>Review design</button></li>
    </ol></nav>
    <div className="assembly-grid">
      <aside className="panel assembly-preview" aria-label="Spacecraft preview and resources">
        <CraftView design={mission.design(config)} focus={step?.focus} label={craftLabel}/>
        <dl className="assembly-specs assembly-hud">
          <div><dt>Budget used <Term id="bu" bare/></dt><dd>{number(resources.costBU)} / {limits.budget} BU</dd></div>
          <div><dt>Launch mass</dt><dd>{number(resources.launchMassKg)} / {limits.mass} kg</dd></div>
          <div><dt>Battery</dt><dd>{number(resources.batteryWh)} Wh</dd></div>
          <div><dt>Maneuver reserve</dt><dd>{number(resources.deltaVMarginMps)} m/s</dd></div>
        </dl>
        <p className="fine">{engine ? 'Illustrative model values' : 'Illustrative estimates · engine unavailable'}</p>
      </aside>

      <div className="panel assembly-card">
        {step ? <>
          <p className="eyebrow">Step {index + 1} of {end}</p>
          <h2 ref={heading} tabIndex={-1}>{step.title}</h2>
          <p><strong>What is it?</strong> {step.what}</p>
          <p><strong>Why do I need it?</strong> {step.why}</p>
          {step.fixedNote && <p className="notice">{step.fixedNote}</p>}
          {step.notModeled && <p className="fine">Not simulated: {step.notModeled.join(' · ')}</p>}
          {step.preview === 'shadow-energy' && engine && <p>Full-observation preview with your current instrument ({label('payloadId', config.payloadId)}).</p>}
          {step.fields.map(choices)}
          <Findings findings={findings.filter(item => step.fields.some(field => field === item.sourceField))}/>
          {radio && step.radio && <Transmission from={radio}>{step.radio.text}</Transmission>}
          <details key={step.id}><summary>Learn why</summary>
            <p>{step.learn.principle}</p>
            <ul>{step.learn.examples.map(({ text, source }) => <li key={text}>{text}{' '}
              <a href={source.url} target="_blank" rel="noreferrer">{source.org}: {source.title}</a></li>)}</ul>
            <h3>Model assumptions</h3>
            <ul>{step.learn.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
          </details>
        </> : <>
          <p className="eyebrow">Assembly complete</p>
          <h2 ref={heading} tabIndex={-1}>Review your design</h2>
          <ul className="assembly-installed">{described.map(field => <li key={field}>
            <span><strong>{fields[field]}:</strong> {label(field, config[field])}</span>
            <button aria-label={`Change ${fields[field].toLowerCase()}`} onClick={() => go(mission.steps.findIndex(item => item.fields.includes(field)))}>Change</button>
          </li>)}</ul>
          <p className="tag" data-passed={feasibility?.eligible || undefined}>{!feasibility ? 'Feasibility unavailable' : feasibility.eligible ? 'Within launch limits' : 'Launch blockers'}</p>
          <Findings findings={findings}/>
          {baseline && <>
            <h3>Configuration trade study</h3>
            <DesignComparison baseline={baseline} current={resources}/>
            {!distinct && <p>Change a part to compare your spacecraft with the baseline.</p>}
            <label className="control">Reason for choosing the current design
              <select value={rationale} onChange={event => setRationale(event.target.value as typeof rationale)}>
                <option value="">Choose a rationale</option>
                {Object.entries(rationaleLabels).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
              </select>
            </label>
            <button disabled={!distinct || !rationale} onClick={() => { if (rationale) game.trade(rationale) }}>Record decision</button>
            {evidence?.tradeStudy && <p role="status">Decision recorded: {rationaleLabels[evidence.tradeStudy.rationale]}.</p>}
            <p><button className="quiet" onClick={game.saveAlternative}>Use current design as the baseline instead</button></p>
          </>}
          <details><summary>Preflight planning tools</summary>
            <ResourceMetrics report={resources}/>
            <MissionRehearsal config={config}/><WeatherPlanner config={config}/>
          </details>
        </>}
        <div className="actions assembly-actions">
          <button disabled={index === 0} onClick={() => go(index - 1)}>Back</button>
          {step ? <button className="primary" onClick={() => go(index + 1)}>Continue</button>
            : <button className="primary" disabled={!engine} onClick={game.reviews}>Open engineering review</button>}
        </div>
      </div>
    </div>
  </section>
}
