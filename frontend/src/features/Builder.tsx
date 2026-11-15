import { useEffect, useRef } from 'react'
import type { Game } from '../app/controller'
import type { ConfigField, Finding, PowerId } from '../app/contracts'
import { designFindings, findingText, optionIssues, powerPreview, type PowerPreview } from '../app/design'
import { limits } from '../app/engine'
import { clock } from '../app/flight'
import { configFields, fields, label, options } from '../app/options'
import { estimateResources } from '../app/planning'
import { regionById } from '../app/regions'
import type { Save } from '../app/save'
import { number } from '../components/MissionData'
import { Transmission } from '../components/Radio'
import { ActionBar, OptionCard, Readout, ScreenHeader } from '../components/Screen'
import { Term } from '../components/Term'
import { CraftView } from '../craft/CraftView'
import { luna01 } from '../missions/luna01'
import { stepIndexFor, type MissionDefinition } from '../missions/types'

function PowerReadings({ preview }: { preview: PowerPreview }) {
  const share = Math.min(1, preview.batteryWh / Math.max(preview.batteryWh, preview.neededWh))
  const need = Math.min(1, preview.neededWh / Math.max(preview.batteryWh, preview.neededWh))
  return <div className="power-readings">
    <dl className="readouts">
      <Readout label="Solar output" value={number(preview.solarW)} unit="W" hint={`needs ${number(preview.sunlitLoadW)} W in sunlight`}/>
      <Readout label="Battery capacity" value={number(preview.batteryWh)} unit="Wh" hint={`full pass needs ${number(preview.neededWh)} Wh`}
        tone={preview.sustains ? 'good' : 'bad'}/>
      <Readout label="Shadow endurance" value={preview.enduranceH >= preview.shadowHours ? `${preview.shadowHours} h` : clock(preview.enduranceH)}
        hint={`of the ${preview.shadowHours} h pass · ${Math.round(preview.coverage * 100)}% survey coverage`} tone={preview.sustains ? 'good' : 'bad'}/>
    </dl>
    <div className="energy-compare" aria-hidden="true">
      <span className="energy-fill" data-short={!preview.sustains || undefined} style={{ width: `${share * 100}%` }}/>
      <span className="energy-need" style={{ left: `${need * 100}%` }}/>
    </div>
  </div>
}

export function Builder({ game, save, mission = luna01, step: index, onStep, canEdit }: {
  game: Game; save: Save; mission?: MissionDefinition; step: number; onStep: (step: number) => void
  /** When set (multiplayer), only owned fields are editable. */
  canEdit?: (field: ConfigField) => boolean
}) {
  const { config, alternative } = save
  const { engine } = game
  const end = mission.steps.length - 1
  const step = mission.steps[Math.min(index, end)]
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const target = regionById(save.targetId)
  const resources = engine?.computeResources(config) ?? estimateResources(config)
  const findings = engine ? designFindings(engine, config) : []
  const blockers = findings.filter(item => item.severity === 'blocker')
  const warnings = findings.filter(item => item.severity === 'warning')
  const radio = step.radio && mission.crew[step.radio.from]
  const craftLabel = [mission.name, ...configFields.map(field => label(field, config[field]))].join(' · ')
  const issueSteps = new Set(blockers.map(item => stepIndexFor(mission, item.sourceField)))

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
    onStep(Math.max(0, Math.min(end, next)))
  }
  const fix = (finding: Finding) => {
    const at = stepIndexFor(mission, finding.sourceField)
    return at < 0 ? null : <button type="button" className="link-action" onClick={() => go(at)}>Fix in {mission.steps[at].label}</button>
  }

  function choices(field: ConfigField) {
    return <fieldset className="option-group" key={field}>
      <legend>{fields[field]}</legend>
      {options[field].map(([id, name]) => {
        const info = mission.options[id]
        const issues = engine ? optionIssues(engine, config, field, id) : []
        const blocks = issues.some(item => item.severity === 'blocker')
        const preview = step.preview === 'shadow-energy' && engine && field === 'powerId' ? powerPreview(engine, config, id as PowerId) : null
        const specs = mission.specs(field, id).filter(spec => !preview || spec.label === 'Cost' || spec.label === 'Mass')
        return <OptionCard key={id} name={field} id={id} title={name} checked={config[field] === id}
          disabled={canEdit ? !canEdit(field) : false}
          onChange={() => game.select(field, id)}
          tone={blocks ? 'bad' : issues.length ? 'warn' : undefined}
          tag={<>{config[field] === id && <span className="tag">Installed</span>}
            {issues.length > 0 && <span className="tag" data-tone={blocks ? 'bad' : 'warn'}>{blocks ? 'Blocks launch' : 'Warning'}</span>}</>}>
          {info && <><p>{info.what}</p><p><strong>Trade-off:</strong> {info.tradeoff}</p></>}
          {specs.length > 0 && <dl className="option-specs">{specs.map(spec => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}
          {preview && <PowerReadings preview={preview}/>}
          {issues.length > 0 && <ul className="findings">{issues.map(item =>
            <li key={item.id} data-severity={item.severity}>{findingText(item, mission.findingText)}</li>)}</ul>}
        </OptionCard>
      })}
    </fieldset>
  }

  return <section className="assembly">
    <ScreenHeader eyebrow={`${mission.name} · Assembly bay`} title="Spacecraft builder"
      lede="Pick one option for each part. Every number comes from the mission model."
      aside={target && <div className="screen-target"><dl><dt>Observation target</dt><dd>{target.name}</dd></dl>
        <button type="button" onClick={game.retarget}>Change</button></div>}/>
    <nav aria-label="Assembly progress"><ol className="assembly-steps">
      {mission.steps.map((item, i) => <li key={item.id}><button type="button" onClick={() => go(i)}
        aria-current={i === index ? 'step' : undefined} data-issue={issueSteps.has(i) || undefined}>
        <span aria-hidden="true">{i + 1}</span> {item.label}{issueSteps.has(i) && <span className="sr-only"> (launch blocker)</span>}
      </button></li>)}
    </ol></nav>
    <div className="assembly-grid">
      <aside className="panel assembly-preview" aria-label="Spacecraft preview and resources">
        <CraftView design={mission.design(config)} focus={step.focus} label={craftLabel}/>
        <dl className="readouts assembly-hud">
          <Readout label={<>Budget <Term id="bu" bare/></>} value={`${number(resources.costBU)} / ${limits.budget}`} unit="BU" tone={resources.costBU > limits.budget ? 'bad' : undefined}/>
          <Readout label="Launch mass" value={`${number(resources.launchMassKg)} / ${limits.mass}`} unit="kg" tone={resources.launchMassKg > limits.mass ? 'bad' : undefined}/>
          <Readout label="Battery" value={number(resources.batteryWh)} unit="Wh"/>
          <Readout label="Fuel reserve" value={number(resources.deltaVMarginMps)} unit="m/s" tone={resources.deltaVMarginMps < 0 ? 'bad' : undefined}/>
        </dl>
        {engine && <section className="launch-check" aria-labelledby="launch-check-title">
          <h2 id="launch-check-title" className="eyebrow">Launch check</h2>
          {blockers.length === 0 ? <p className="fine">No launch blockers.{warnings.length ? ` ${warnings.length} warning${warnings.length > 1 ? 's' : ''} to accept in the review.` : ''}</p>
            : <ul className="findings">{blockers.map(item => <li key={item.id} data-severity="blocker">
              {findingText(item, mission.findingText)} {fix(item)}</li>)}</ul>}
        </section>}
        <p className="fine">{engine ? 'Illustrative model values' : 'Illustrative estimates · engine unavailable'}</p>
      </aside>

      <div className="panel assembly-card">
        <p className="eyebrow">Step {index + 1} of {end + 1}</p>
        <h2 ref={heading} tabIndex={-1}>{step.title}</h2>
        <p><strong>What is it?</strong> {step.what}</p>
        <p><strong>Why do I need it?</strong> {step.why}</p>
        {step.fixedNote && <p className="notice">{step.fixedNote}</p>}
        {step.notModeled && <p className="fine">Not simulated: {step.notModeled.join(' · ')}</p>}
        {step.preview === 'shadow-energy' && engine && <p className="fine">Shadow figures assume a full observation with your current instrument ({label('payloadId', config.payloadId)}).</p>}
        {step.fields.map(field => {
          const locked = canEdit && !canEdit(field)
          return <div key={field}>{locked && <p className="fine">Owned by another role — empty seats fall back so a crew of two still covers every subsystem.</p>}{choices(field)}</div>
        })}
        {radio && step.radio && <Transmission from={radio}>{step.radio.text}</Transmission>}
        <details key={step.id} className="learn">
          <summary>Learn why this step matters</summary>
          <div className="learn-body">
            <p className="learn-principle">{step.learn.principle}</p>
            {step.learn.examples.length > 0 && <>
              <h3>From real missions</h3>
              <ul className="learn-list">{step.learn.examples.map(({ text, source }) =>
                <li key={text}>
                  <span className="basis" data-basis="reported">Sourced fact</span>
                  <span>{text}{' '}<a href={source.url} target="_blank" rel="noreferrer">{source.org}: {source.title}</a></span>
                </li>)}</ul>
            </>}
            <h3>In this game</h3>
            <ul className="learn-list">{step.learn.assumptions.map(item =>
              <li key={item}>
                <span className="basis" data-basis="assumed">Game assumption</span>
                <span>{item}</span>
              </li>)}</ul>
          </div>
        </details>
      </div>
    </div>
    <ActionBar label="Assembly navigation" status={index < end ? `Next: ${mission.steps[index + 1].label}` : 'Assembly complete'}>
      <button type="button" disabled={index === 0} onClick={() => go(index - 1)}>Back</button>
      {index < end ? <button type="button" className="primary" onClick={() => go(index + 1)}>Continue</button>
        : <button type="button" className="primary" disabled={!engine} onClick={game.reviews}>Open engineering review</button>}
    </ActionBar>
  </section>
}
