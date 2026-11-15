import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal panel for things that should stay out of the way until asked for: control
 * guides, achievements, optional tools. Escape and the backdrop close it, focus stays
 * inside while it is open and returns to the control that opened it.
 */
export function Dialog({ title, close, closeLabel = 'Close', children }: {
  title: string; close: () => void; closeLabel?: string; children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const stops = panel.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')
      if (!stops.length) return
      const first = stops[0]!
      const last = stops[stops.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [close])

  return <div className="guide-backdrop" onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="guide panel" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
      <div className="spread"><h2>{title}</h2>
        <button ref={closeButton} type="button" className="quiet" onClick={close}>{closeLabel}</button></div>
      {children}
    </div>
  </div>
}
