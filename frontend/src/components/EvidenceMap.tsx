import { useId } from 'react'
import { points } from '../app/story'

/*
 * Illustrative survey map of the target crater: 100 tiles, one per science point.
 * The orbiter records tiles in order: the sunlit rim first (tiles 1–50), then the
 * shadowed floor (51–100), and sends them home in the same order. The tiles that show
 * the ice signature are fixed scenery, not a modeled quantity.
 */
const COLS = 10
const signal = new Set([56, 57, 64, 65, 66, 67, 73, 74, 75, 76, 77, 78, 84, 85, 86, 87, 95, 96])

export function EvidenceMap({ recorded, received, title }: { recorded: number; received: number | null; title: string }) {
  const clip = `crater-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const rec = points(recorded)
  const got = received === null ? null : points(received)
  const seen = [...signal].filter(tile => tile <= (got ?? rec)).length
  const summary = got === null
    ? `${rec} of 100 tiles recorded on the orbiter. ${seen} of ${signal.size} tiles with the ice signature recorded.`
    : `${got} of 100 tiles received on Earth, ${rec} recorded on the orbiter. Earth can see the ice signature in ${seen} of ${signal.size} tiles.`
  return <figure className="evidence">
    <figcaption><strong>{title}</strong><span>{summary}</span></figcaption>
    <svg viewBox="0 0 220 252" role="img" aria-label={summary}>
      <text x="110" y="10" className="evidence-label">SUNLIT RIM · RECORDED FIRST</text>
      <g transform="translate(0 16)">
      <defs><clipPath id={clip}><circle cx="110" cy="110" r="108"/></clipPath></defs>
      <circle cx="110" cy="110" r="108" className="evidence-rim"/>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="110" width="220" height="110" className="evidence-shadow"/>
        {Array.from({ length: 100 }, (_, index) => {
          const tile = index + 1
          const x = 10 + (index % COLS) * 20
          const y = 10 + Math.floor(index / COLS) * 20
          const state = got !== null && tile <= got ? 'received' : tile <= rec ? 'recorded' : 'missing'
          return <g key={tile} data-state={state}>
            <rect x={x + 1} y={y + 1} width="18" height="18" rx="3" className={`tile tile-${state}`}/>
            {signal.has(tile) && state !== 'missing' && <path d={`M${x + 10} ${y + 5} L${x + 15} ${y + 10} L${x + 10} ${y + 15} L${x + 5} ${y + 10} Z`}
              className={`signal signal-${state}`}/>}
          </g>
        })}
      </g>
      </g>
      <text x="110" y="250" className="evidence-label">SHADOWED FLOOR · RECORDED LAST</text>
    </svg>
    <ul className="evidence-key">
      {received !== null && <li><span className="key key-received"/>Received on Earth</li>}
      <li><span className="key key-recorded"/>{received === null ? 'Recorded on the orbiter' : 'Recorded, still on the orbiter'}</li>
      <li><span className="key key-missing"/>Not recorded</li>
      <li><span className="key key-signal"/>Ice signature</li>
    </ul>
    <small>Illustrative map: each tile is one science point.</small>
  </figure>
}
