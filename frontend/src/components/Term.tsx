import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { glossary, type TermId } from '../app/glossary'

/**
 * Inline jargon explainer: the label stays plain text and a small "?" button
 * beside it opens a one-line definition on hover, focus or tap.
 */
export function Term({ id, children, bare = false }: { id: TermId; children?: ReactNode; bare?: boolean }) {
  const entry = glossary[id]
  const [open, setOpen] = useState(false)
  const tip = useId()
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])

  return <span className="term" ref={root} data-open={open || undefined}>
    {bare ? null : children ?? entry.term}
    <button type="button" className="term-help" aria-label={`What is ${entry.term}?`} aria-expanded={open}
      aria-describedby={tip} onClick={() => setOpen(!open)}>?</button>
    <span className="term-pop" role="tooltip" id={tip}><strong>{entry.term}</strong> {entry.long}</span>
  </span>
}
