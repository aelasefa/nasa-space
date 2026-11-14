import { useEffect, useRef } from 'react'
import { glossary } from '../app/glossary'

const steps = [
  ['Design', 'Pick one option for each of the five parts. Keep the total within budget and mass, and choose the ice-sensitive spectrometer: finding water ice is the goal.'],
  ['Compare', 'Save your design as a baseline, then change at least one part. Engineers always compare two options before committing.'],
  ['Review', 'Pass four checkpoints: the right instrument, no broken limits, a recorded reason for your choice, and every warning accepted.'],
  ['Fly', 'Make two calls in flight: how to use the battery in the Moon’s shadow, and what to send home first.'],
  ['Learn', 'Read the debrief to see what shaped the result, then replay the mission with one decision changed.'],
] as const

/** "How to play" plus the full glossary, opened from the top bar. */
export function Guide({ close }: { close: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus() }
  }, [close])

  return <div className="guide-backdrop" onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="guide panel" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="spread"><h2 id="guide-title">How LUNA‑01 works</h2>
        <button ref={closeButton} className="quiet" onClick={close}>Close guide</button></div>
      <p>You are planning a robotic orbiter that looks for water ice at the Moon’s south pole. All numbers are simplified game values.</p>
      <ol className="guide-steps">{steps.map(([title, text], index) => <li key={title}>
        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div>
      </li>)}</ol>
      <h3>Glossary</h3>
      <dl className="guide-glossary">{Object.values(glossary).map(entry => <div key={entry.term}>
        <dt>{entry.term}</dt><dd>{entry.long}</dd>
      </div>)}</dl>
    </div>
  </div>
}
