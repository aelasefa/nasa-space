import { useState } from 'react'
import type { DownlinkAction, ObserveAction, ResourceReport, SpacecraftConfig } from '../app/contracts'
import { options } from '../app/options'
import { planningLimits, rehearse, transfers } from '../app/planning'
import { delta, number } from '../components/MissionData'

export function PlanningMargins({ resources, config }: { resources: ResourceReport; config: SpacecraftConfig }) {
  const budget = planningLimits.budget - resources.costBU
  const mass = planningLimits.mass - resources.launchMassKg
  const transfer = transfers[config.trajectoryId]
  return <div className="planning-margins">
    <dl>
      <div><dt>Budget remaining</dt><dd data-negative={budget < 0}>{number(budget)} BU</dd></div>
      <div><dt>Mass allowance</dt><dd data-negative={mass < 0}>{number(mass)} kg</dd></div>
      <div><dt>Maneuver reserve</dt><dd data-negative={resources.deltaVMarginMps < 0}>{number(resources.deltaVMarginMps)} m/s</dd></div>
      <div><dt>Transfer time</dt><dd>{transfer.hours} h</dd></div>
    </dl>
    {budget < 0 || mass < 0 || resources.deltaVMarginMps < 0 ?
      <p>Revise the design: one or more planning margins are below zero.</p> : null}
  </div>
}

const comparisonRows = [
  ['costBU', 'Cost', 'BU'], ['launchMassKg', 'Launch mass', 'kg'],
  ['batteryWh', 'Usable battery', 'Wh'], ['deltaVMarginMps', 'Maneuver reserve', 'm/s'],
] as const

export function DesignComparison({ baseline, current }: { baseline: ResourceReport; current: ResourceReport }) {
  return <table className="planning-comparison">
    <caption>Current design vs. saved baseline</caption>
    <thead><tr><th scope="col">Resource</th><th scope="col">Current</th><th scope="col">Change</th></tr></thead>
    <tbody>{comparisonRows.map(([key, title, unit]) => <tr key={key}>
      <th scope="row">{title}</th><td>{number(current[key])} {unit}</td><td>{delta(current[key] - baseline[key])} {unit}</td>
    </tr>)}</tbody>
  </table>
}

export function MissionRehearsal({ config }: { config: SpacecraftConfig }) {
  const [observation, setObservation] = useState<ObserveAction>('observe_full')
  const [downlink, setDownlink] = useState<DownlinkAction>('science_first')
  const preview = rehearse(config, observation, downlink)
  return <section className="panel mission-rehearsal">
    <p className="eyebrow">Operations / Preflight</p>
    <h2>Mission rehearsal</h2>
    <p>Try an observation plan and downlink priority before committing to them in flight.</p>
    <div className="rehearsal-controls">
      <label className="control">Observation plan
        <select value={observation} onChange={event => setObservation(event.target.value === 'conserve' ? 'conserve' : 'observe_full')}>
          {options.observeAction.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="control">Downlink priority
        <select value={downlink} onChange={event => setDownlink(event.target.value === 'health_first' ? 'health_first' : 'science_first')}>
          {options.downlinkAction.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
    </div>
    <div role="status">
      <dl className="rehearsal-results">
        <div><dt>Shadow energy needed</dt><dd data-negative={preview.neededWh > preview.batteryWh}>{preview.neededWh} / {preview.batteryWh} Wh</dd></div>
        <div><dt>Science collected</dt><dd>{number(preview.collected)} / 100</dd></div>
        <div><dt>Downlink capacity</dt><dd>{number(preview.capacity)} / 100</dd></div>
        <div><dt>Science returned</dt><dd>{number(preview.returned)} / 100</dd></div>
      </dl>
      <p>{config.payloadId === 'mapping_camera' ? 'The camera maps terrain but returns no water ice science in this mission.' :
        preview.neededWh > preview.batteryWh ? 'The battery cannot sustain this plan for the full shadow window.' :
        preview.capacity < preview.collected ? 'The link cannot return all the science collected with this plan.' :
        'This plan can transmit all the science it collects.'}</p>
    </div>
    <small>Illustrative preflight estimate. It does not authorize launch or save flight decisions.</small>
  </section>
}
