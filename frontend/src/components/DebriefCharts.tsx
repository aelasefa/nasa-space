import type { ReactNode } from 'react'
import type { MissionResult } from '../app/contracts'
import { limits } from '../app/engine'
import { number } from './MissionData'
import { Term } from './Term'

// Every value plotted here comes straight from the engine's MissionResult; the
// charts only rescale it. Weights match the MPI categories in GAME_RULES.md §7.
const scoreParts = [
  ['science', 'Science returned', 40, 'Science points that reached Earth.'],
  ['efficiency', 'Resource efficiency', 25, 'Science returned for the budget and mass you spent.'],
  ['reliability', 'Reliability', 15, 'Whether the observation ran without an energy cutoff.'],
  ['engineering', 'Engineering quality', 10, 'Fewer accepted warnings score higher.'],
  ['operations', 'Operations', 10, 'Sensible choices during the two flight decisions.'],
] as const

interface Row { label: ReactNode; name: string; value: number; max: number; scale: number; text: string; note?: string; over?: boolean }

/** Horizontal bars on one shared scale: a track shows what was possible, the fill what was earned. */
function Bars({ rows, caption }: { rows: Row[]; caption: string }) {
  return <figure className="bars">
    <figcaption className="sr-only">{caption}</figcaption>
    {rows.map(row => <div className="bar-row" key={row.name} tabIndex={0}
      aria-label={`${row.name}: ${row.text}${row.note ? `. ${row.note}` : ''}`}>
      <div className="bar-label">{row.label}</div>
      <div className="bar-track" style={{ width: `${(row.max / row.scale) * 100}%` }}>
        <div className="bar-fill" data-over={row.over || undefined}
          style={{ width: `${Math.min(100, Math.max(0, (row.value / row.max) * 100))}%` }}/>
      </div>
      <div className="bar-value">{row.text}</div>
      {row.note && <div className="bar-tip" role="presentation">{row.note}</div>}
    </div>)}
  </figure>
}

export function ScoreChart({ result }: { result: MissionResult }) {
  const { score } = result
  const rows = scoreParts.map(([key, name, weight, note]) => {
    const max = weight * 10
    const value = score[key] * weight / 10
    return { label: name, name, value, max, scale: 400, text: `${Math.round(value)} / ${max}`, note }
  })
  const capped = score.rawMPI > score.mpi
  return <section className="panel chart-panel">
    <h2>Where your score came from</h2>
    <p className="chart-sub">Points earned in each part of the <Term id="mpi">Mission Performance Index</Term>, out of what each part can give.</p>
    <Bars rows={rows} caption="Score by category"/>
    <p className="chart-total"><strong>{number(score.mpi)}</strong> / 1,000 MPI
      {capped && <> · raw total {number(score.rawMPI)}, limited by the <Term id="cap">outcome cap</Term> of {number(score.cap)}</>}</p>
  </section>
}

export function ScienceChart({ result }: { result: MissionResult }) {
  const collected = result.collectedSciencePoints
  const returned = result.returnedSciencePoints
  const lostInShadow = 100 - collected
  const lostInDownlink = collected - returned
  const rows: Row[] = [
    { label: 'Possible', name: 'Possible', value: 100, max: 100, scale: 100, text: '100' },
    { label: 'Collected', name: 'Collected', value: collected, max: 100, scale: 100, text: number(collected),
      note: lostInShadow > 0 ? `${number(lostInShadow)} lost during observation` : 'Nothing lost during observation' },
    { label: 'Sent to Earth', name: 'Sent to Earth', value: returned, max: 100, scale: 100, text: number(returned),
      note: lostInDownlink > 0 ? `${number(lostInDownlink)} could not be sent` : 'Everything collected was sent' },
  ]
  return <section className="panel chart-panel">
    <h2>What happened to the science</h2>
    <p className="chart-sub"><Term id="science">Science points</Term> at each stage. Only what reaches Earth counts.</p>
    <Bars rows={rows} caption="Science points by stage"/>
    <ul className="chart-notes">
      <li>{lostInShadow > 0 ? <><strong>{number(lostInShadow)} points</strong> were never collected: the battery ran short or the observation was cut back.</> :
        <>The instrument collected everything it could.</>}</li>
      <li>{lostInDownlink > 0 ? <><strong>{number(lostInDownlink)} points</strong> stayed on board: the <Term id="downlink">downlink</Term> could not send them all.</> :
        <>Every collected point made it home.</>}</li>
    </ul>
  </section>
}

export function ResourceChart({ result }: { result: MissionResult }) {
  const { costBU, launchMassKg } = result.resources
  const rows: Row[] = [
    { label: <Term id="bu">Budget</Term>, name: 'Budget', value: costBU, max: limits.budget, scale: limits.budget,
      text: `${number(costBU)} / ${limits.budget} BU`, over: costBU > limits.budget },
    { label: <Term id="mass">Launch mass</Term>, name: 'Launch mass', value: launchMassKg, max: limits.mass, scale: limits.mass,
      text: `${number(launchMassKg)} / ${limits.mass} kg`, over: launchMassKg > limits.mass },
  ]
  return <section className="panel chart-panel">
    <h2>How much you spent</h2>
    <p className="chart-sub">Spending less for the same science raises your efficiency score.</p>
    <Bars rows={rows} caption="Resources used against their limits"/>
  </section>
}
