import type { ReactNode } from 'react'
import type { Game } from '../app/controller'
import type { Finding, ReviewGate, TradeStudyEvidence, WarningId } from '../app/contracts'
import { findingText, readDesign, tradeTakeaway } from '../app/design'
import { configFields, fields, initialConfig, label, rationaleLabels } from '../app/options'
import { regionById } from '../app/regions'
import type { Save } from '../app/save'
import { ActionBar, OptionCard, ScreenHeader } from '../components/Screen'
import { Term } from '../components/Term'
import { TradeCharts } from '../components/TradeCharts'
import { luna01 } from '../missions/luna01'
import { stepIndexFor, type MissionDefinition } from '../missions/types'
import { WeatherPlanner } from './Design'
import { MissionRehearsal } from './MissionPlanning'

type Rationale = TradeStudyEvidence['rationale']
const gates: Record<ReviewGate, [string, string]> = {
  CML1: ['Charter', 'Does the instrument match the goal of finding water ice?'],
  CML2: ['Feasibility', 'Does the design stay within budget, mass, power and fuel limits?'],
  CML3: ['Trade study', 'Did you compare two designs and say why you chose this one?'],
  CML4: ['Point design', 'Have you looked at every remaining risk and accepted it?'],
}

const jump = (id: string) => {
  const target = document.getElementById(id)
  target?.scrollIntoView?.({ block: 'start' })
  target?.focus({ preventScroll: true })
}

export function Review({ game, save, mission = luna01, openStep, rationale, onRationale }: {
  game: Game; save: Save; mission?: MissionDefinition; openStep: (step: number) => void
  rationale: Rationale | ''; onRationale: (value: Rationale) => void
}) {
  const { engine } = game
  if (!engine || !save.evidence) return null
  const { evidence, config, alternative } = save
  const baseline = alternative ?? initialConfig
  const report = engine.evaluateReviews(config, evidence)
  const warnings = engine.evaluateFeasibility(config).warnings
  const distinct = engine.hashConfig(baseline) !== engine.hashConfig(config)
  const starter = readDesign(engine, baseline)
  const mine = readDesign(engine, config)
  const recorded = evidence.tradeStudy
  const target = regionById(save.targetId)
  const passed = (Object.keys(gates) as ReviewGate[]).filter(gate => report.gates[gate].passed).length
  const choice = rationale || recorded?.rationale || ''
  const stepFor = (field: string) => stepIndexFor(mission, field)

  const toStep = (field: string, text?: string): ReactNode => {
    const at = stepFor(field)
    return at < 0 ? null : <button type="button" className="link-action" onClick={() => openStep(at)}>{text ?? `Fix in ${mission.steps[at].label}`}</button>
  }
  const describe = (finding: Finding) => {
    const warning = warnings.find(item => `CML4_UNACKNOWLEDGED_${item.id.toUpperCase()}` === finding.id)
    return warning ? `Not yet accepted: ${findingText(warning, mission.findingText)}` : findingText(finding, mission.findingText)
  }
  const action = (gate: ReviewGate, finding: Finding): ReactNode => {
    if (gate === 'CML3') return <button type="button" className="link-action" onClick={() => jump('trade-study')}>Go to trade study</button>
    if (finding.id.startsWith('CML4_UNACKNOWLEDGED_')) return <><button type="button" className="link-action" onClick={() => jump('warnings')}>Accept it</button>
      {toStep(finding.sourceField, 'or fix the part')}</>
    return toStep(finding.sourceField)
  }
  const open = (Object.keys(gates) as ReviewGate[]).find(gate => !report.gates[gate].passed)
  const next = !open ? 'All four checkpoints passed. Authorize launch.'
    : open === 'CML1' ? 'Next: swap in an instrument that can detect ice.'
      : open === 'CML2' ? 'Next: fix the launch blockers below.'
        : open === 'CML3' ? (distinct ? 'Next: pick a reason in the trade study and record it.' : 'Next: change at least one part from the starter.')
          : 'Next: accept the remaining warnings.'

  return <section className="review">
    <ScreenHeader eyebrow={`${mission.name} · Engineering review`} title="Engineering review"
      lede={<>Before launch your design must pass four checkpoints, the <Term id="cml">CML review gates</Term>.</>}
      aside={<p className="tag" data-passed={!open || undefined}>{passed} of 4 checkpoints passed</p>}/>

    <div className="review-grid">
      <div className="review-main">
        <section className="panel" aria-labelledby="gates-title">
          <h2 id="gates-title">Launch checklist</h2>
          <ol className="gate-list">{(Object.keys(gates) as ReviewGate[]).map(gate => {
            const { passed: ok, findings } = report.gates[gate]
            return <li key={gate} data-open={!ok || undefined}>
              <div className="spread"><strong>{gate} · {gates[gate][0]}</strong>
                <span className="tag" data-passed={ok || undefined}>{ok ? 'Passed' : 'Open'}</span></div>
              <p className="gate-plain">{gates[gate][1]}</p>
              {!ok && <ul className="findings">{findings.map(item => <li key={item.id} data-severity="blocker">
                {describe(item)} {action(gate, item)}</li>)}</ul>}
            </li>
          })}</ol>
        </section>

        <section className="panel" id="trade-study" tabIndex={-1} aria-labelledby="trade-title">
          <h2 id="trade-title">Trade study: starter vs. your design</h2>
          <p className="fine">The starter design is the baseline. Same engine, same limits.</p>
          <TradeCharts starter={starter} mine={mine}/>
          <p className="takeaway"><strong>Takeaway</strong> {distinct ? tradeTakeaway(starter, mine) : 'Your design is identical to the starter, so there is nothing to compare yet.'}</p>
          {!distinct ? <p className="next-action">The review needs two different designs. Change at least one part; the instrument is the obvious place to start.{' '}
            {toStep('payloadId', `Go to ${mission.steps[stepFor('payloadId')]?.label ?? 'builder'}`)}</p> : <>
            <fieldset className="option-group option-row">
              <legend>Main reason for choosing your design</legend>
              {(Object.entries(rationaleLabels) as [Rationale, string][]).map(([id, text]) =>
                <OptionCard key={id} name="rationale" id={id} title={text} checked={choice === id} onChange={() => onRationale(id)}/>)}
            </fieldset>
            <div className="trade-record">
              <button type="button" disabled={!choice || recorded?.rationale === choice} onClick={() => { if (choice) game.trade(choice) }}>
                {recorded ? 'Update trade study' : 'Record trade study'}</button>
              {recorded && <p role="status">Recorded: {rationaleLabels[recorded.rationale]}.</p>}
            </div>
          </>}
        </section>
      </div>

      <div className="review-side">
        <section className="panel" aria-labelledby="summary-title">
          <h2 id="summary-title">Design summary</h2>
          {target && <p className="fine"><strong>Target:</strong> {target.name}. A historical Artemis III landing candidate (2022). LUNA‑01 observes it from orbit in the game’s single shadow-pass scenario, so the region doesn’t change the simulation.</p>}
          <ul className="assembly-installed">{configFields.map(field => <li key={field}>
            <span><strong>{fields[field]}:</strong> {label(field, config[field])}</span>
            {stepFor(field) >= 0 && <button type="button" aria-label={`Change ${fields[field].toLowerCase()}`} onClick={() => openStep(stepFor(field))}>Change</button>}
          </li>)}</ul>
        </section>

        <section className="panel" id="warnings" tabIndex={-1} aria-labelledby="warnings-title">
          <h2 id="warnings-title">Accept remaining warnings <Term id="warning" bare/></h2>
          {warnings.length === 0 ? <p>No warnings to accept.</p> : <p className="fine">Accept each risk, or go back and change the part.</p>}
          {warnings.map(item => <div className="check-row" key={item.id}>
            <label className="check"><input type="checkbox" checked={evidence.acknowledgedWarnings.includes(item.id as WarningId)}
              onChange={event => game.acknowledge(item.id as WarningId, event.target.checked)}/>{findingText(item, mission.findingText)}</label>
            {toStep(item.sourceField, `Change in ${mission.steps[stepFor(item.sourceField)]?.label}`)}
          </div>)}
        </section>

        <details className="panel"><summary>Preflight planning tools</summary>
          <MissionRehearsal config={config}/><WeatherPlanner config={config}/>
        </details>
      </div>
    </div>

    <ActionBar label="Launch authorization" status={next}>
      <button type="button" onClick={() => openStep(mission.steps.length - 1)}>Back to builder</button>
      <button type="button" className="primary" disabled={!report.authorized} onClick={game.launch}>Authorize launch</button>
    </ActionBar>
  </section>
}
