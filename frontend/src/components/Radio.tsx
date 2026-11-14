import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character } from '../missions/types'

/*
 * Mission Control radio. Every transmission is a caption first: always visible, in
 * place, never a popup. Voice is optional and off by default; when the player turns it
 * on, new transmissions are also read aloud with the browser's speech synthesis.
 * Dialogue is fictional and labelled as such where it appears.
 */

const VoiceContext = createContext<{ on: boolean; supported: boolean; toggle: () => void }>({ on: false, supported: false, toggle: () => {} })
const KEY = 'luna01:voice'

export function RadioProvider({ children }: { children: ReactNode }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
  const [on, setOn] = useState(() => {
    try { return supported && window.localStorage.getItem(KEY) === 'on' } catch { return false }
  })
  const value = useMemo(() => ({
    on, supported,
    toggle: () => setOn(current => {
      const next = !current
      try { window.localStorage.setItem(KEY, next ? 'on' : 'off') } catch { /* preference only */ }
      if (!next) window.speechSynthesis?.cancel()
      return next
    }),
  }), [on, supported])
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}

/** Mute control for the top bar. Hidden where the browser has no speech synthesis. */
export function VoiceToggle() {
  const { on, supported, toggle } = useContext(VoiceContext)
  if (!supported) return null
  return <button type="button" className="quiet" aria-pressed={on} onClick={toggle}>{on ? 'Radio voice: on' : 'Radio voice: off'}</button>
}

/** One radio message from a crew member, shown as a caption. `urgent` asks screen readers to announce it. */
export function Transmission({ from, children, urgent = false }: { from: Character; children: string; urgent?: boolean }) {
  const { on } = useContext(VoiceContext)
  useEffect(() => {
    if (!on) return
    const utterance = new window.SpeechSynthesisUtterance(children)
    utterance.rate = 1.02
    window.speechSynthesis.speak(utterance)
    return () => window.speechSynthesis.cancel()
  }, [on, children])
  return <figure className="lead" style={{ borderLeftColor: from.tone }}>
    <span className="lead-avatar" aria-hidden="true" style={{ background: from.tone }}>{from.initials}</span>
    <div>
      <blockquote role={urgent ? 'status' : undefined}>{children}</blockquote>
      <figcaption>{from.name} · {from.role} · Fictional dialogue</figcaption>
    </div>
  </figure>
}
