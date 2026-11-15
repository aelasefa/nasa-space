import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { experiences, fromPage } from '../app/experiences'
import { Dialog } from '../components/Dialog'
import { ExperienceBar } from '../components/Experience'
import { Readout } from '../components/Screen'
import { webglOK } from '../space/motion'
import { apollo, controls, honesty, loadMuted, modelSources, saveMuted } from './content'
import type { DriveControl, RoverSim, RoverTelemetry } from './runtime/sim'

const cameras = ['Cockpit', 'Chase', 'Wheels', 'Orbit']
const lights = ['off', 'low', 'high']
const limits = [3, 7, 12]
const signed = (value: number, digits = 0) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`

function bearing(deg: number) {
  const size = Math.abs(deg)
  return size < 4 ? 'Dead ahead' : `${size}° to the ${deg > 0 ? 'right' : 'left'}`
}

function KeyList({ title, rows }: { title: string; rows: readonly (readonly [string, string])[] }) {
  return <section>
    <h3>{title}</h3>
    <dl className="rover-keys">{rows.map(([key, action]) => <div key={key}><dt>{key}</dt><dd>{action}</dd></div>)}</dl>
  </section>
}

/** The control guide. Opened on demand; also the body of the no-WebGL fallback. */
function ControlGuide({ vr }: { vr: boolean | null }) {
  return <>
    <div className="rover-guide">
      <KeyList title="Keyboard" rows={controls.keyboard}/>
      <KeyList title="Touch" rows={controls.touch}/>
      <KeyList title="VR headset" rows={controls.headset}/>
    </div>
    <p className="fine">{vr ? 'A headset is available: use Enter VR in the top bar.'
      : vr === false ? 'No VR headset was found in this browser, so Enter VR is hidden. Everything works without one.'
      : 'Enter VR appears in the top bar when the browser reports a headset.'}</p>
    <h3>What is simulated</h3>
    <ul className="choice-notes">{honesty.map(line => <li key={line}>{line}</li>)}</ul>
  </>
}

/** A hold-to-drive button for touch and mouse. Releasing, leaving or cancelling always stops. */
function PadButton({ control, label, drive, children }: { control: DriveControl; label: string; drive: (control: DriveControl, active: boolean) => void; children: ReactNode }) {
  const set = (active: boolean) => drive(control, active)
  const down = (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); set(true) }
  const key = (active: boolean) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); set(active) }
  }
  return <button type="button" className="rover-pad-button" data-control={control} aria-label={label}
    onPointerDown={down} onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}
    onKeyDown={key(true)} onKeyUp={key(false)} onBlur={() => set(false)} onContextMenu={event => event.preventDefault()}>{children}</button>
}

export function RoverApp() {
  const view = useRef<HTMLDivElement>(null)
  const sim = useRef<RoverSim | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(() => webglOK() ? 'loading' : 'unavailable')
  const [t, setTelemetry] = useState<RoverTelemetry | null>(null)
  const [notice, setNotice] = useState('')
  const [muted, setMuted] = useState(loadMuted)
  const [vr, setVr] = useState<boolean | null>(null)
  const [dialog, setDialog] = useState<null | 'guide' | 'models'>(null)
  const [pad, setPad] = useState(false)
  const [driven, setDriven] = useState(false)
  const [model, setModel] = useState<{ busy?: boolean; text: string; failed?: boolean }>({ text: '' })
  const menu = useRef<HTMLDetailsElement>(null)
  const mutedAtStart = useRef(muted)

  useEffect(() => {
    if (!webglOK() || !view.current) return
    let cancelled = false
    let created: RoverSim | null = null
    import('./runtime/sim.js').then(({ createRoverSim }) => {
      if (cancelled || !view.current) return
      created = createRoverSim(view.current, {
        onTelemetry: reading => { setTelemetry(reading); if (Math.abs(reading.speedKmh) > 0.5) setDriven(true) },
        onNotice: setNotice,
      })
      created.setMuted(mutedAtStart.current)
      sim.current = created
      setStatus('ready')
      void created.vrSupported().then(supported => { if (!cancelled) setVr(supported) })
    }).catch(() => { if (!cancelled) setStatus('unavailable') })
    return () => { cancelled = true; created?.dispose(); sim.current = null }
  }, [])

  // The keyboard drives only while the view is the thing in front.
  useEffect(() => { sim.current?.setInputEnabled(dialog === null) }, [dialog, status])
  // Command confirmations are a courtesy: the state they report is also on a button or a
  // readout, so they clear themselves after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (status !== 'ready') return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === '?' && !(event.target instanceof HTMLInputElement)) setDialog('guide')
      if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus() }
    }
    const outside = (event: globalThis.PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside) }
  }, [status])

  const closeDialog = useCallback(() => setDialog(null), [])
  const drive = useCallback((control: DriveControl, active: boolean) => sim.current?.setDrive(control, active), [])
  const toggleSound = () => { const next = !muted; setMuted(next); saveMuted(next); sim.current?.setMuted(next) }
  const closeMenu = () => { if (menu.current) menu.current.open = false }
  const enterVR = () => { sim.current?.enterVR().catch(() => setNotice('The headset session could not start. You can keep driving on this screen.')) }

  async function place(source: string | File, name: string, scale?: number) {
    if (!sim.current) return
    setModel({ busy: true, text: `Loading ${name}…` })
    try {
      await sim.current.loadModel(source, scale)
      setModel({ text: `${name} is on the surface, 25 m ahead of the starting point.` })
    } catch {
      setModel({ failed: true, text: `${name} could not be loaded. The drive works without it: the model is optional.` })
    }
  }
  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void place(file, file.name)
    event.target.value = ''
  }

  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const { rover } = experiences

  if (status === 'unavailable') return <div className="rover-app rover-app-fallback">
    <ExperienceBar name={rover.name} hubHref={fromPage.hub}/>
    <main className="rover-fallback">
      <section className="panel" aria-labelledby="rover-fallback-title">
        <p className="eyebrow">{rover.kind}</p>
        <h1 id="rover-fallback-title">The 3D drive can’t start here</h1>
        <p>This browser did not provide WebGL, which the rover view needs. It may be switched off, blocked, or missing on this device.
          Nothing was lost: the rover keeps no progress.</p>
        <div className="actions">
          <a className="button primary" href={fromPage.hub}>Back to mission hub</a>
          <a className="button" href={fromPage.academy}>Open the Training Academy</a>
        </div>
        <h2>What the drive offers</h2>
        <p>{rover.summary}</p>
        <ControlGuide vr={null}/>
      </section>
    </main>
  </div>

  return <div className="rover-app">
    <ExperienceBar name={rover.name} hubHref={fromPage.hub}>
      <div className="rover-toolbar" role="toolbar" aria-label="View, sound and help">
        <button type="button" onClick={() => sim.current?.cycleCamera()} disabled={!t} aria-describedby="rover-camera-hint">
          Camera: {cameras[t?.camera ?? 0]}</button>
        <span id="rover-camera-hint" className="sr-only">Switches to the next camera. Shortcut: C.</span>
        <button type="button" aria-pressed={!muted} onClick={toggleSound}>Sound: {muted ? 'off' : 'on'}</button>
        {vr && <button type="button" onClick={t?.presenting ? () => void sim.current?.exitVR() : enterVR}>{t?.presenting ? 'Exit VR' : 'Enter VR'}</button>}
        <button type="button" onClick={() => setDialog('guide')} aria-haspopup="dialog">Controls</button>
      </div>
    </ExperienceBar>

    <main className="rover-stage">
      <h1 className="sr-only">{rover.name}</h1>
      <div className="rover-view" ref={view}/>
      {status === 'loading' && <p className="rover-loading" role="status">Preparing the rover…</p>}

      {t && <>
        <section className="rover-hud" aria-label="Rover telemetry">
          <dl className="readouts rover-readouts">
            <Readout label="Speed" value={Math.abs(t.speedKmh).toFixed(1)} unit="km/h"
              hint={t.braking ? 'Braking' : t.autoNav ? 'Auto-drive' : t.speedKmh < -0.1 ? 'Reverse' : undefined}/>
            <Readout label="Battery" value={Math.round(t.batteryPct)} unit="%" tone={t.batteryPct < 25 ? 'bad' : undefined}
              hint={t.inShadow ? 'In shadow: no solar' : 'Sunlit: charging'}/>
            <Readout label="Target" value={t.targetDistanceM} unit="m"
              hint={<><span className="rover-bearing" aria-hidden="true" style={{ transform: `rotate(${t.targetBearingDeg}deg)` }}>↑</span> {bearing(t.targetBearingDeg)}</>}/>
            <Readout label="Thermal margin" value={signed(t.thermalMarginC)} unit="°C"
              tone={t.thermalMarginC < 0 ? 'bad' : t.thermalMarginC < 10 ? 'warn' : undefined}
              hint={t.thermalMarginC < 0 ? 'Below the cold limit' : undefined}/>
            <Readout label="Ice signal" value={t.icePercent.toFixed(1)} unit="wt%" tone={t.iceSignal > 0.4 ? 'good' : undefined}
              hint={t.iceSignal > 0.4 ? 'Strong: try the drill' : undefined}/>
          </dl>
          <details className="rover-more">
            <summary>More telemetry</summary>
            <dl className="rover-more-list">
              <div><dt>Target</dt><dd>{t.targetName}</dd></div>
              <div><dt>Pitch / roll</dt><dd>{signed(t.pitchDeg, 1)}° / {signed(t.rollDeg, 1)}°</dd></div>
              <div><dt>Solar input</dt><dd>{t.solarW} W</dd></div>
              <div><dt>Drive and lights</dt><dd>{t.loadW} W</dd></div>
              <div><dt>Last drill sample</dt><dd>{t.sample === null ? 'None yet' : `${t.sample.toFixed(1)} wt%`}</dd></div>
            </dl>
            <p className="fine">Illustrative game values on simulated terrain.</p>
          </details>
        </section>

        <p className="rover-notice" role="status">{notice}</p>
        {!driven && <p className="rover-hint">{coarse ? 'Hold the pad to drive. Drag the view to look around.'
          : 'Drive with W A S D or the arrow keys. Space brakes. Drag the view to look around.'}</p>}

        <div className="rover-deck">
          <div className="rover-pad" data-on={pad || undefined} role="group" aria-label="Drive pad">
            <PadButton control="fwd" label="Drive forward" drive={drive}>▲</PadButton>
            <PadButton control="left" label="Steer left" drive={drive}>◀</PadButton>
            <PadButton control="brake" label="Brake" drive={drive}>Stop</PadButton>
            <PadButton control="right" label="Steer right" drive={drive}>▶</PadButton>
            <PadButton control="rev" label="Reverse" drive={drive}>▼</PadButton>
          </div>

          <div className="rover-commands" role="group" aria-label="Rover commands">
            <button type="button" aria-pressed={t.autoNav} onClick={() => sim.current?.toggleAutoNav()}>Auto-drive</button>
            <button type="button" disabled={t.drilling} onClick={() => sim.current?.drill()}>{t.drilling ? 'Drilling…' : 'Drill and scan'}</button>
            <button type="button" onClick={() => sim.current?.nextTarget()}>Next target</button>
            <details className="nav-settings rover-menu" ref={menu}>
              <summary>More</summary>
              <div className="nav-settings-menu">
                <button type="button" className="quiet" onClick={() => sim.current?.toggleHeadlights()}>Headlights: {lights[t.headlights]}</button>
                <button type="button" className="quiet" onClick={() => sim.current?.setSpeedLimit(limits[(limits.indexOf(t.speedLimitKmh) + 1) % limits.length]!)}>
                  Speed limit: {t.speedLimitKmh} km/h</button>
                <button type="button" className="quiet" onClick={() => { sim.current?.alignToSun(); closeMenu() }}>Face the Sun</button>
                <button type="button" className="quiet" onClick={() => { sim.current?.reset(); closeMenu() }}>Back to the rim</button>
                <button type="button" className="quiet" aria-pressed={pad} onClick={() => setPad(on => !on)}>On-screen drive pad</button>
                <button type="button" className="quiet" aria-haspopup="dialog" onClick={() => { closeMenu(); setDialog('models') }}>Scene models…</button>
              </div>
            </details>
          </div>
        </div>
      </>}
    </main>

    {dialog === 'guide' && <Dialog title="Rover controls" close={closeDialog} closeLabel="Close controls"><ControlGuide vr={vr}/></Dialog>}
    {dialog === 'models' && <Dialog title="Scene models" close={closeDialog} closeLabel="Close models">
      <p>Optional. Place one extra 3D model on the surface as a landmark. The drive never depends on it.</p>
      <div className="actions">
        <button type="button" disabled={model.busy} onClick={() => void place(new URL(apollo.path, document.baseURI).href, apollo.name, apollo.scale)}>
          Place the {apollo.name}</button>
        <label className="button rover-file">Load a .glb file from this device
          <input type="file" accept=".glb,.gltf,model/gltf-binary" className="sr-only" onChange={pickFile} disabled={model.busy}/></label>
        <button type="button" className="quiet" disabled={!t?.hasModel} onClick={() => { sim.current?.clearModel(); setModel({ text: 'Model removed.' }) }}>Remove model</button>
      </div>
      <p className={model.failed ? 'notice' : 'fine'} role="status">{model.text}</p>
      <p className="fine">{apollo.name}: {apollo.credit} It is bundled with the game, so it loads without a network connection.</p>
      <h3>More models</h3>
      <p className="fine">Download a model from one of these sites, then load the file here. The game does not fetch from them.</p>
      <ul className="choice-notes">{modelSources.map(source =>
        <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul>
    </Dialog>}
  </div>
}
