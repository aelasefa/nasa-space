import { useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motionOK, warpThen } from '../space/motion'


export function Briefing({ start }: { start: () => void }) {
  const [draft, setDraft] = useState('')
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [launching, setLaunching] = useState(false)
  const scrollCue = useRef<HTMLAnchorElement>(null)
  const greeting = useRef<HTMLDivElement>(null)
  const crawl = useRef<HTMLDivElement>(null)

  // Title sequence for the greeting.
  useLayoutEffect(() => {
    if (!motionOK() || !greeting.current) return
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .from('.intro-transmission', { opacity: 0, y: 12, letterSpacing: '.6em', duration: 1.6 }, 0.2)
        .from('.intro-form h1', { opacity: 0, y: 40, duration: 1.4 }, 0.45)
        .from('.intro-form input', { opacity: 0, clipPath: 'inset(0 100% 0 0)', duration: 1.6 }, 0.7)
        .from('.intro-submit', { opacity: 0, x: -10, duration: 1 }, 1.1)
    }, greeting)
    return () => ctx.revert()
  }, [])

  // Opening crawl: text slides up a tilted plane as the reader scrolls.
  useLayoutEffect(() => {
    if (!name) return
    scrollCue.current?.focus({ preventScroll: true })
    const root = crawl.current
    if (!root || !motionOK()) return
    gsap.registerPlugin(ScrollTrigger)
    root.classList.add('crawl-live')
    const ctx = gsap.context(() => {
      gsap.from('.intro-cue', { opacity: 0, y: -8, duration: 1, ease: 'power2.out' })
      const text = root.querySelector<HTMLElement>('.crawl-text')!
      const plane = root.querySelector<HTMLElement>('.crawl-plane')!
      gsap.fromTo(text, { y: 0 }, {
        y: () => -(plane.offsetHeight + text.offsetHeight),
        ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true },
      })
      gsap.from('.intro-finish > *', {
        opacity: 0, y: 30, stagger: 0.12, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: '.intro-finish', start: 'top 80%' },
      })
    }, root.parentElement ?? root)
    ScrollTrigger.refresh()
    return () => { ctx.revert(); root.classList.remove('crawl-live') }
  }, [name])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name) return
    const trimmed = draft.trim()
    if (trimmed.length < 1 || trimmed.length > 16) {
      setInvalid(true)
      return
    }
    setName(trimmed)
  }

  function launch() {
    if (launching) return
    setLaunching(true)
    if (motionOK()) gsap.to('.intro', { opacity: 0, scale: 0.96, duration: 0.9, ease: 'power3.in' })
    warpThen(start)
  }

  return <>
    <div className="intro-beat intro-greeting" ref={greeting}>
      <form className="intro-form" onSubmit={submit}>
        <p className="intro-transmission" aria-hidden="true"><span className="builder-signal"/>Incoming transmission · LUNA‑01</p>
        <h1>Hi,</h1>
        <input aria-label="Your name" placeholder="mission planner’s name" autoComplete="given-name" maxLength={16}
          className={name.length >= 12 ? 'intro-name-long' : undefined}
          value={name || draft} readOnly={Boolean(name)} tabIndex={name ? -1 : undefined}
          aria-invalid={invalid || undefined} aria-describedby={invalid ? 'intro-name-error' : undefined}
          onChange={event => { setDraft(event.target.value); setInvalid(false) }}/>
        {!name && <button className="intro-submit" type="submit" aria-label="Continue">→</button>}
        {invalid && <p className="intro-note" id="intro-name-error" role="alert">Enter a name with 1–16 characters.</p>}
        {name && <a className="intro-note intro-cue" href="#intro-crawl" ref={scrollCue}>Scroll to begin <span aria-hidden="true">↓</span></a>}
      </form>
    </div>
    {name && <>
      <div className="crawl" id="intro-crawl" ref={crawl}>
        <div className="crawl-stage">
          <div className="crawl-plane">
            <div className="crawl-text">
              <p className="crawl-episode">Mission 01</p>
              <p className="crawl-title">The Ice at the Edge of Shadow</p>
              {[
                `Welcome to LUNA‑01, ${name}.`,
                'You’re sending an orbiter to the Moon’s south pole.',
                'Your mission is to look for evidence of water ice.',
                'You’ll choose what goes aboard, what to observe, and what to send back to Earth.',
                'After the mission, you can change one decision and see what would have happened.',
              ].map((line, index) => <p className="crawl-line" key={index}
                id={index === 0 ? 'intro-welcome' : undefined} tabIndex={index === 0 ? -1 : undefined}>{line}</p>)}
            </div>
          </div>
        </div>
      </div>
      <div className="intro-beat intro-finish">
        <p className="intro-transmission">Launch window open</p>
        <button className="primary launch" onClick={launch} disabled={launching}>Start mission</button>
      </div>
    </>}
  </>
}
