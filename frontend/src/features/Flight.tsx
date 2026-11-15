import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import type { Game } from '../app/controller'
import type { DownlinkAction, ObserveAction, ResolvedEvent, Universe } from '../app/contracts'
import { scenario } from '../app/engine'
import { assumptions, clock, downlinkBriefing, downlinkDetail, downlinkLine, observeDetail, shadowBriefing, shadowLine, shadowTimeline, tradeoffs, type ShadowFrame } from '../app/flight'
import { label, options } from '../app/options'
import { regionById } from '../app/regions'
import type { Save } from '../app/save'
import { eventById, metricLabels, points, shadowEnergy, shadowLeadLine, statusLabel } from '../app/story'
import { EvidenceMap } from '../components/EvidenceMap'
import { number, ResourceMetrics } from '../components/MissionData'
import { Orbit } from '../components/Orbit'
import { Transmission } from '../components/Radio'
import { ActionBar, Readout, ScreenHeader } from '../components/Screen'
import { Term } from '../components/Term'
import { CraftView } from '../craft/CraftView'
import { luna01 } from '../missions/luna01'
import type { Character } from '../missions/types'
import { motionOK } from '../space/motion'

const BEAT_MS = 1800
const crew = luna01.crew
const frameTitle = (frame: ShadowFrame, status: string) => ({
  ingress: 'Shadow ingress',
  progress: status === 'conserved' ? 'Holding in the dark' : 'Observing the crater floor',
  cutoff: status === 'bus_energy_failure' ? 'Battery empty: safe mode' : 'Low battery: instrument cutoff',
  egress: 'Back in sunlight',
})[frame.id]
const frameSpeaker: Record<ShadowFrame['id'], Character> = { ingress: crew.amina, progress: crew.chen, cutoff: crew.amina, egress: crew.reyes }

interface Beat { id: string; cue: string; title: string; from: Character; line: string; tone?: string }

function BeatCard({ beat, headingRef, children }: { beat: Beat; headingRef?: Ref<HTMLHeadingElement>; children?: ReactNode }) {
  return <article className="beat-card" data-cue={beat.cue} data-tone={beat.tone} aria-labelledby={`beat-${beat.id}`}>
    <p className="eyebrow"><span className="beat-cue" aria-hidden="true"/>Now</p>
    <h2 id={`beat-${beat.id}`} ref={headingRef} tabIndex={-1}>{beat.title}</h2>
    <Transmission from={beat.from} urgent>{beat.line}</Transmission>
    {children}
  </article>
}

function EventMetrics({ event }: { event: ResolvedEvent }) {
  return <dl className="metrics">{Object.entries(event.metrics).map(([name, value]) => {
    const [text, format] = metricLabels[name] ?? [name, number]
    return <div key={name}><dt>{text}</dt><dd>{format(value)}</dd></div>
  })}</dl>
}

/**
 * One event choice. Compact by default: the trade-off in a sentence, the numbers needed
 * to decide, and the button that commits. "Show details" opens in place and is a plain
 * disclosure: opening or closing it never selects or commits anything.
 */
function ChoiceCard({ id, name, telemetry, onCommit, children }: {
  id: ObserveAction | DownlinkAction; name: string; telemetry: ReactNode; onCommit: () => void; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return <div className="choice-card" id={`choice-${id}`} role="group" aria-label={name}>
    <p className="choice-tradeoff" id={`choice-${id}-tradeoff`}>{tradeoffs[id]}</p>
    {telemetry}
    <button type="button" className="commit" onClick={onCommit} aria-describedby={`choice-${id}-tradeoff`}>{name}</button>
    <details className="choice-details" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{open ? 'Hide details' : 'Show details'}<span className="sr-only"> for {name}</span></summary>
      <div className="choice-details-body">{children}</div>
    </details>
  </div>
}

function Assumptions({ items }: { items: readonly string[] }) {
  return <>
    <h4>Model assumptions</h4>
    <ul className="choice-notes">{items.map(item => <li key={item}>{item}</li>)}</ul>
  </>
}

export function Flight({ game, save, callSign, universe }: { game: Game; save: Save; callSign?: string; universe?: Universe }) {
  const engine = game.engine!
  const { config } = save
  const hours = scenario.shadowHours
  const target = regionById(save.targetId)?.name
  const resources = engine.computeResources(config)
  const full = engine.resolveObservation(config, 'observe_full').event
  const capacity = shadowEnergy(full, hours)?.available ?? resources.batteryWh
  const event = save.observation ? engine.resolveObservation(config, save.observation).event : null
  const run = (observeAction: ObserveAction, downlinkAction: DownlinkAction) => {
    const attempt = engine.simulateMission({ config, decisions: { observeAction, downlinkAction }, scenarioId: 'lunar_south_pole_ice_v1', modelVersion: engine.modelVersion })
    return attempt.kind === 'completed' ? attempt.result : null
  }
  const recorded = save.observation ? run(save.observation, 'science_first')?.collectedSciencePoints ?? 0 : 0
  const frames = event ? shadowTimeline(event, hours, recorded) : null
  // After a reload the shadow pass has already happened: don't replay it.
  const [shown, setShown] = useState(() => save.observation ? Number.POSITIVE_INFINITY : 0)
  const playing = Boolean(event && frames && shown < frames.length)
  const stage = !event ? 'decide' : playing ? 'shadow' : universe ? 'downlinked' : 'sunlight'
  const frame = frames ? frames[Math.min(shown, frames.length) - 1] ?? null : null
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => setShown(count => count + 1), BEAT_MS)
    return () => window.clearTimeout(timer)
  }, [playing, shown])
  useEffect(() => {
    if (stage === 'decide') return
    heading.current?.focus({ preventScroll: true })
    // Once per stage, not per beat: the new heading must be on screen after a choice is committed.
    heading.current?.scrollIntoView?.({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'auto' })
  }, [stage])

  const observe = (action: ObserveAction) => {
    game.observe(action)
    setShown(motionOK() ? 1 : Number.POSITIVE_INFINITY)
  }

  const arrival: Beat = { id: 'arrival', cue: 'arrival', title: 'Orbit achieved', from: crew.reyes,
    line: `Orbit achieved${callSign ? `, ${callSign}` : ''}. ${scenario.travelTime(config.trajectoryId)} on the ${label('trajectoryId', config.trajectoryId).toLowerCase()}, ${number(resources.deltaVMarginMps)} m/s of fuel to spare.${target ? ` ${target} is coming up below us.` : ''}` }
  const decide: Beat = { id: 'decide', cue: 'decision', title: 'Shadow pass ahead: keep observing, or save the battery?', from: crew.amina, line: shadowBriefing(config, full, hours) }
  const shadowBeats: Beat[] = event && frames ? frames.slice(0, Math.min(shown, frames.length)).map(item => ({
    id: item.id, cue: item.id, tone: item.tone, title: frameTitle(item, event.status), from: frameSpeaker[item.id],
    line: shadowLine(item, event.status, config, hours, target),
  })) : []
  const downlinkPreviews = save.observation ? options.downlinkAction.map(([id, name]) => {
    const result = run(save.observation!, id)
    const e2 = result ? eventById(result, 'E2') : undefined
    return { id, name, sent: result ? points(result.returnedSciencePoints) : null, capacity: e2?.metrics.scienceDownlinkCapacity, event: e2 }
  }) : []
  const sunlight: Beat = { id: 'sunlight', cue: 'sunlight', title: 'Downlink window: what do we send first?', from: crew.reyes,
    line: downlinkBriefing(config, recorded, downlinkPreviews[0]?.capacity) }
  const downlinked: Beat | null = universe ? { id: 'downlink', cue: 'downlink', title: 'Downlink complete', from: crew.reyes,
    tone: universe.result.returnedSciencePoints < universe.result.collectedSciencePoints ? 'warn' : 'good',
    line: downlinkLine(config, universe.input.decisions.downlinkAction, universe.result.collectedSciencePoints, universe.result.returnedSciencePoints, callSign) } : null
  const current = stage === 'decide' ? decide : stage === 'shadow' ? shadowBeats.at(-1)! : stage === 'sunlight' ? sunlight : downlinked!
  const lead: Beat | null = event && (stage === 'sunlight' || stage === 'downlinked') ? { id: 'lead', cue: 'sunlight', title: 'Science lead on the pass',
    from: crew.chen, line: shadowLeadLine(event.status) } : null
  const log = [...shadowBeats, ...(lead ? [lead] : []), ...(universe ? [sunlight] : [])].filter(item => item.id !== current.id)

  const inShadow = stage === 'shadow' && frame?.id !== 'egress'
  const battery = frame?.batteryWh ?? capacity
  const timeLeft = !event ? hours : frame ? hours - frame.at : 0

  return <section className="mission-control">
    <ScreenHeader eyebrow={`${luna01.name} · Mission control${target ? ` · ${target}` : ''}`} title="Mission control"
      aside={<ol className="stages" aria-label="Mission stages">
        <li aria-current={stage === 'decide' ? 'step' : undefined} data-done={stage !== 'decide' || undefined}>01 · Arrival</li>
        <li aria-current={stage === 'shadow' ? 'step' : undefined} data-done={stage === 'sunlight' || stage === 'downlinked' || undefined}>02 · Shadow pass</li>
        <li aria-current={stage === 'sunlight' || stage === 'downlinked' ? 'step' : undefined}>03 · Downlink</li>
      </ol>}/>
    <p className="arrival" role="status"><span aria-hidden="true">✓</span> {arrival.line}</p>

    <div className="mc-grid">
      <dl className="readouts shadow-hud mc-hud" aria-label="Shadow pass telemetry">
        <Readout label="Battery remaining" value={number(Math.round(battery))} unit={`/ ${number(capacity)} Wh`}
          tone={battery / Math.max(1, capacity) < 0.2 ? 'bad' : undefined}
          hint={<span className="hud-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, battery / Math.max(1, capacity)) * 100}%` }}/></span>}/>
        <Readout label="Time left in shadow" value={timeLeft > 0 ? clock(timeLeft) : '0 min'} hint={!event ? `${hours} h pass ahead` : timeLeft > 0 ? 'Running on battery' : 'Back in sunlight'}/>
        <Readout label="Ice science on board" value={frame ? points(frame.science) : event ? points(recorded) : '—'} unit="/ 100 pts"
          hint={universe ? `${points(universe.result.returnedSciencePoints)} received on Earth` : undefined}/>
      </dl>

      <div className="panel mc-decision" aria-live="polite">
        <BeatCard beat={current} headingRef={heading}>
          {stage === 'decide' && <>
            <p className="fine choices-hint">Pick one. The choice is final for this flight.</p>
            <div className="choices-flight">{options.observeAction.map(([id, name]) => {
              const preview = run(id, 'science_first')
              const outcome = engine.resolveObservation(config, id).event
              const end = shadowTimeline(outcome, hours, preview?.collectedSciencePoints ?? 0)?.at(-1)
              return <ChoiceCard key={id} id={id} name={name} onCommit={() => observe(id)} telemetry={
                <dl className="choice-telemetry">
                  <div><dt>Ice points on board</dt><dd>{preview ? points(preview.collectedSciencePoints) : '—'}<small> / 100</small></dd></div>
                  <div><dt>Battery after the pass</dt><dd>{end ? number(Math.round(end.batteryWh)) : '—'}<small> Wh</small></dd></div>
                </dl>}>
                <p>{observeDetail(config, outcome, hours)}</p>
                <h4>Engine preview: {statusLabel(outcome.status).toLowerCase()}</h4>
                <EventMetrics event={outcome}/>
                <Assumptions items={assumptions.observe}/>
              </ChoiceCard>
            })}</div>
          </>}
          {stage === 'shadow' && <button type="button" className="quiet" onClick={() => setShown(Number.POSITIVE_INFINITY)}>Skip to result</button>}
          {stage === 'sunlight' && event && <>
            <p className="pass-headline" data-tone={frames?.at(-1)?.tone}><strong>Shadow pass: {statusLabel(event.status)}.</strong> {points(recorded)} of 100 ice points on board.</p>
            <p className="fine choices-hint">Pick one. The choice is final for this flight.</p>
            <div className="choices-flight">{downlinkPreviews.map(preview => <ChoiceCard key={preview.id} id={preview.id} name={preview.name}
              onCommit={() => game.downlink(preview.id)} telemetry={preview.sent !== null && <>
                <p className="choice-sends"><strong>Sends {preview.sent} of {points(recorded)}</strong> recorded points to Earth.</p>
                <div className="energy-bar" aria-hidden="true"><span style={{ width: `${recorded ? (preview.sent / recorded) * 100 : 0}%` }}/></div>
              </>}>
              {preview.sent !== null && <p>{downlinkDetail(preview.id, recorded, preview.sent, preview.capacity)}</p>}
              {preview.event && <>
                <h4>Engine preview: {statusLabel(preview.event.status).toLowerCase()}</h4>
                <EventMetrics event={preview.event}/>
              </>}
              <Assumptions items={assumptions.downlink}/>
            </ChoiceCard>)}</div>
          </>}
        </BeatCard>
        {log.length > 0 && <details className="flight-log" open={stage === 'shadow' || stage === 'downlinked'}><summary>Flight log</summary>
          <ol className="beats">{log.map(item => <li key={item.id} data-tone={item.tone}><strong>{item.title}</strong><p>{item.line}</p></li>)}</ol>
        </details>}
      </div>

      <div className="panel mc-status" data-shadow={inShadow || undefined} data-cue={current.cue}>
        <div className="mc-orbit"><Orbit active/><span className="mc-shadow" aria-hidden="true"/></div>
        <CraftView design={luna01.design(config)} label="LUNA-01 in flight"
          effects={{ shadow: inShadow, scanning: stage === 'shadow' && Boolean(frame?.scanning), downlink: stage === 'downlinked' }}/>
        {(stage === 'sunlight' || stage === 'downlinked') && <EvidenceMap title={universe ? 'Recorded vs. received' : 'Recorded on the orbiter'}
          recorded={recorded} received={universe ? universe.result.returnedSciencePoints : null}/>}
        <p className="fine">Playback of the engine’s result. Values at each beat follow its shadow-pass energy model.</p>
      </div>
    </div>

    {event && stage !== 'shadow' && <details className="panel mc-telemetry"><summary>Detailed telemetry</summary>
      <EventMetrics event={event}/>
      <h3><Term id="margin">Spacecraft resources</Term></h3>
      <ResourceMetrics report={resources}/>
    </details>}

    {stage === 'downlinked' && <ActionBar label="Mission control" status="Flight complete">
      <button type="button" className="primary" onClick={game.finishPlayback}>Open debrief</button>
    </ActionBar>}
  </section>
}
