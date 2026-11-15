import { useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import gsap from 'gsap'
import { ScienceLead } from '../components/ScienceLead'
import { motionOK, warpThen } from '../space/motion'

/** One screen: a role, a question, and a clear way in. The call sign is optional. */
export function Briefing({ start }: { start: (callSign: string) => void }) {
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [launching, setLaunching] = useState(false)
  const hero = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!motionOK() || !hero.current) return
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .from('.intro-transmission', { opacity: 0, y: 10, duration: 2.2 }, 0.2)
        .from('.intro-title', { opacity: 0, y: 24, duration: 2.4 }, 0.55)
        .from('.intro-hero h1, .intro-brief', { opacity: 0, y: 20, duration: 2.2, stagger: 0.22 }, 1.0)
        .from('.intro-hero .lead, .intro-outline, .intro-form', { opacity: 0, y: 16, duration: 1.9, stagger: 0.28 }, 1.7)
    }, hero)
    return () => ctx.revert()
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (launching) return
    const callSign = draft.trim()
    if (callSign.length > 16) {
      setInvalid(true)
      return
    }
    setLaunching(true)
    if (motionOK()) gsap.to('.intro', { opacity: 0, scale: 0.97, duration: 1.4, ease: 'power3.in' })
    warpThen(() => start(callSign))
  }

  return <div className="intro-hero" ref={hero}>
    <p className="intro-transmission"><span className="builder-signal" aria-hidden="true"/>Mission 01 · Incoming assignment</p>
    <p className="intro-title">The Ice at the Edge of Shadow</p>
    <h1>You’re flight lead.</h1>
    <p className="intro-brief">An earlier survey picked up a possible ice signature in a crater near the Moon’s south pole.
      Bring back enough evidence to see whether it holds up.</p>
    <ScienceLead>The signal sits on a crater floor that never sees the Sun. To check it, your orbiter has to keep
      observing while it crosses the Moon’s shadow, and then get that data home.</ScienceLead>
    <ol className="intro-outline" aria-label="Your mission">
      <li><span aria-hidden="true">01</span> Pick where the orbiter looks.</li>
      <li><span aria-hidden="true">02</span> Build it within budget and launch mass.</li>
      <li><span aria-hidden="true">03</span> Fly the shadow pass. In the dark you’ll have one call to make: keep the sensor running, or save the battery.</li>
    </ol>
    <form className="intro-form" onSubmit={submit} noValidate>
      <label className="intro-callsign">
        <span>Call sign <small>(optional)</small></span>
        <input aria-label="Call sign (optional)" placeholder="e.g. Ada" autoComplete="nickname" maxLength={16}
          value={draft} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'intro-name-error' : undefined}
          onChange={event => { setDraft(event.target.value); setInvalid(false) }}/>
      </label>
      <button className="primary launch" type="submit" disabled={launching}>Take the console</button>
      {invalid && <p className="intro-note" id="intro-name-error" role="alert">Use 16 characters or fewer.</p>}
    </form>
  </div>
}
