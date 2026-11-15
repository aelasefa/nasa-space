import type { DesignReading } from '../app/design'
import { limits } from '../app/engine'
import { number } from './MissionData'

/*
 * Paired horizontal bars: starter vs. current design, on one shared scale per measure.
 * Values are engine readings (see app/design.ts). Every bar carries its value as text,
 * so the chart reads the same without the graphics.
 */

interface Pair { name: string; value: number; text: string; marker?: number; short?: boolean }
interface Measure { id: string; title: string; limit?: string; scale: number; rows: Pair[]; over?: number }

function Chart({ measure }: { measure: Measure }) {
  const at = (value: number) => `${Math.min(100, Math.max(0, value / measure.scale * 100))}%`
  return <figure className="pair-chart" aria-labelledby={`pair-${measure.id}`}>
    <figcaption id={`pair-${measure.id}`}><strong>{measure.title}</strong>{measure.limit && <span>{measure.limit}</span>}</figcaption>
    {measure.rows.map(row => <div className="pair-row" key={row.name} data-mine={row.name === 'Yours' || undefined}>
      <span className="pair-label">{row.name}</span>
      <span className="pair-track" aria-hidden="true">
        <span className="pair-fill" data-short={row.short || undefined} style={{ width: at(row.value) }}/>
        {row.marker !== undefined && <span className="pair-marker" style={{ left: at(row.marker) }}/>}
      </span>
      <span className="pair-value">{row.text}</span>
    </div>)}
  </figure>
}

export function TradeCharts({ starter, mine }: { starter: DesignReading; mine: DesignReading }) {
  const energyScale = Math.max(starter.batteryWh, starter.shadowNeedWh, mine.batteryWh, mine.shadowNeedWh)
  const pairs = (pick: (reading: DesignReading) => Omit<Pair, 'name'>) => [{ name: 'Starter', ...pick(starter) }, { name: 'Yours', ...pick(mine) }]
  const measures: Measure[] = [
    { id: 'mass', title: 'Launch mass', limit: `Limit ${limits.mass} kg`, scale: limits.mass,
      rows: pairs(r => ({ value: r.massKg, text: `${number(r.massKg)} kg`, short: r.massKg > limits.mass })) },
    { id: 'budget', title: 'Budget', limit: `Limit ${limits.budget} BU`, scale: limits.budget,
      rows: pairs(r => ({ value: r.costBU, text: `${number(r.costBU)} BU`, short: r.costBU > limits.budget })) },
    { id: 'battery', title: 'Battery vs. shadow demand', limit: 'Tick = energy a full observation needs', scale: energyScale,
      rows: pairs(r => ({ value: r.batteryWh, marker: r.shadowNeedWh, short: r.batteryWh < r.shadowNeedWh,
        text: `${number(r.batteryWh)} of ${number(r.shadowNeedWh)} Wh needed` })) },
    { id: 'link', title: 'Downlink capacity', limit: 'Full dataset 100 points', scale: 100,
      rows: pairs(r => ({ value: r.linkPoints, text: `${number(r.linkPoints)} of 100 points`, short: r.linkPoints < 100 })) },
  ]
  return <div className="pair-charts">{measures.map(measure => <Chart key={measure.id} measure={measure}/>)}</div>
}
