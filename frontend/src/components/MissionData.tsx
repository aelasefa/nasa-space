import type { CausalFinding, Finding, ResolvedEvent, ResourceReport } from '../app/contracts'

export const metrics = {
  costBU: ['Budget', 'BU'], launchMassKg: ['Launch mass', 'kg'],
  sunlitScienceLoadW: ['Science load', 'W'], sunlitScienceMarginW: ['Science power margin', 'W'],
  downlinkLoadW: ['Downlink load', 'W'], sunlitDownlinkMarginW: ['Downlink power margin', 'W'],
  deltaVMarginMps: ['Delta-v margin', 'm/s'], batteryWh: ['Usable battery', 'Wh'],
} satisfies Record<keyof ResourceReport, [string, string]>

export const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
export const delta = (value: number) => (value > 0 ? '+' : '') + number(value)
export const readable = (text: string) => text.replaceAll('_', ' ')
export const eventNames = { arrival: 'Lunar arrival', E1: 'Observation window', E2: 'Science downlink' }
export const outcomes = { success: 'Success', partial: 'Partial success', failure: 'Failure' }

export function ResourceMetrics({ report }: { report: ResourceReport }) {
  return <dl className="metrics">{(Object.keys(metrics) as (keyof ResourceReport)[]).map(key => {
    const [name, unit] = metrics[key]
    return <div key={key}><dt>{name}</dt><dd>{number(report[key])} <small>{unit}</small></dd></div>
  })}</dl>
}

export function Findings({ findings }: { findings: Finding[] }) {
  return <ul className="findings">{findings.map(item => <li key={item.id} data-severity={item.severity}>{item.message}</li>)}</ul>
}

export function Timeline({ events }: { events: ResolvedEvent[] }) {
  return <ol className="timeline">{events.map(event => <li key={event.id}>
    <strong>{eventNames[event.id]}</strong> <span className="tag">{readable(event.status)}</span>
    <p>{event.description}</p>
  </li>)}</ol>
}

export function Causes({ causes }: { causes: CausalFinding[] }) {
  return causes.length ? <ul className="causes">{causes.map(cause => <li key={cause.id}>
    <small>{eventNames[cause.eventId as keyof typeof eventNames] ?? readable(cause.eventId)} · {readable(cause.constraintId)}</small>
    <p>{cause.effect}</p>
  </li>)}</ul> : <p>No causal findings were reported by the model.</p>
}
