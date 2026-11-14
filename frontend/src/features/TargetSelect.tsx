import { Transmission } from '../components/Radio'
import { luna01 } from '../missions/luna01'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { Game } from '../app/controller'
import type { Save } from '../app/save'
import {
  basisLabel, footprintById, footprints, formatLatLon, kmFromPole, regionById, regionFacts, regions, sources,
  unknownProperties, type CandidateRegion, type Fact, type Footprint, type RegionId,
} from '../app/regions'
import { motionOK, webglOK } from '../space/motion'
import type { View } from '../target/MoonGlobe'

const MoonGlobe = lazy(() => import('../target/MoonGlobe'))

const placed = (region: CandidateRegion) => Boolean(footprintById(region.footprintId)?.center.value)

function briefing(region: CandidateRegion | undefined, shared: Footprint | null, callSign: string) {
  const who = callSign || 'Commander'
  if (shared) return `That outline is LROC’s de Gerlache Rim map. NASA named two regions here, Rim 1 and Rim 2, and we can’t tell from the data which is which. Pick one from the list.`
  if (!region) return `${who}, we’ve identified thirteen historical candidate regions near the lunar south pole. Select the region you’d like LUNA‑01 to investigate.`
  const fp = footprintById(region.footprintId)
  const listed = region.in2024List.value ? 'It’s still on NASA’s 2024 shortlist.' : 'It isn’t on NASA’s 2024 shortlist under that name.'
  if (!fp?.center.value) return `${region.name}. We don’t have a verified position for this one, so I can’t put it on the globe. ${listed}`
  const where = formatLatLon(fp.center.value)
  return `${region.name}: ${where}, about ${kmFromPole(fp.center.value.lat)} km from the pole. LRO’s camera has mapped it at about one meter per pixel. ${listed}`
}

function SourceLink({ fact }: { fact: Fact<unknown> }) {
  return fact.source ? <a href={fact.source.url} target="_blank" rel="noreferrer">{fact.source.org}</a> : <span>None</span>
}

function ScienceBehind({ region }: { region: CandidateRegion }) {
  const fp = footprintById(region.footprintId)
  const rows: [string, string, Fact<unknown>][] = [
    ['Official name', region.name, { value: region.name, basis: 'reported', source: sources.nasa2022 }],
    ['Position (center)', fp?.center.value ? formatLatLon(fp.center.value) : 'Not verified', fp?.center ?? { value: null, basis: 'unknown', source: sources.usgsGrids }],
    ['Mapped area (LROC mosaic)', fp?.bounds.value ? `${Math.abs(fp.bounds.value.maxLat).toFixed(2)}–${Math.abs(fp.bounds.value.minLat).toFixed(2)}° S` : 'Not verified', fp?.bounds ?? { value: null, basis: 'unknown' }],
    ['On NASA’s 2024 list', region.in2024List.value ? 'Yes' : 'Not by this name', region.in2024List],
    ['Region size', 'About 15 × 15 km', regionFacts[0]],
  ]
  return <details className="science-behind">
    <summary>Science behind this</summary>
    <table>
      <thead><tr><th scope="col">What</th><th scope="col">Value</th><th scope="col">How we know</th><th scope="col">Source</th></tr></thead>
      <tbody>{rows.map(([what, value, fact]) => <tr key={what}>
        <th scope="row">{what}</th><td>{value}</td><td><span className="basis" data-basis={fact.basis}>{basisLabel[fact.basis]}</span></td><td><SourceLink fact={fact}/></td>
      </tr>)}</tbody>
    </table>
    {[fp?.center.note, region.in2024List.note].filter(Boolean).map(note => <p className="fine" key={note}>{note}</p>)}
    <h4>Not known for this region</h4>
    <ul>{unknownProperties.map(item => <li key={item.note}><span className="basis" data-basis="unknown">Unknown</span> {item.note}</li>)}</ul>
    <h4>About this view</h4>
    <ul>
      <li><span className="basis" data-basis="derived">Derived from data</span> Globe imagery: <a href={sources.svs4720.url} target="_blank" rel="noreferrer">NASA SVS CGI Moon Kit</a>, built from the LROC wide-angle camera mosaic. NASA notes this color map is optimized for appearance, not science.</li>
      <li><span className="basis" data-basis="assumed">Game assumption</span> The globe is lit from your viewpoint so every region is visible. It does not show real sunlight at the pole.</li>
      <li><span className="basis" data-basis="assumed">Game assumption</span> The globe is a smooth textured sphere. Mountains and craters are not shown in 3D.</li>
      <li><span className="basis" data-basis="fictional">Fiction</span> The ice signature in LUNA‑01’s story is part of the game, not a real detection.</li>
    </ul>
  </details>
}

export function TargetSelect({ game, save, callSign = '' }: { game: Game; save: Save; callSign?: string }) {
  const selected = regionById(save.targetId)
  const [view, setView] = useState<View>(() => selected?.footprintId ? { footprintId: selected.footprintId } : motionOK() ? 'globe' : 'pole')
  const [shared, setShared] = useState<Footprint | null>(null)
  const canRender = webglOK()

  // Open on the whole Moon, then glide to the south pole: the "this is interactive" moment.
  useEffect(() => {
    if (selected || !motionOK()) return
    const timer = window.setTimeout(() => setView(current => current === 'globe' ? 'pole' : current), 1100)
    return () => window.clearTimeout(timer)
  }, [selected])

  const choose = useCallback((id: RegionId) => {
    setShared(null)
    game.chooseTarget(id)
    const fp = footprintById(regionById(id)?.footprintId)
    if (fp?.center.value) setView({ footprintId: fp.id })
  }, [game])
  const chooseFootprint = useCallback((id: string) => {
    const fp = footprintById(id)
    if (!fp) return
    if (fp.regionIds.length === 1) choose(fp.regionIds[0])
    else { setShared(fp); setView({ footprintId: fp.id }) }
  }, [choose])
  const noop = useCallback(() => {}, [])
  const fp = footprintById(selected?.footprintId)

  return <section className="target">
    <header className="target-head">
      <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/> Step 1 · Observation target</p>
      <h1>Where should LUNA‑01 look?</h1>
      <p className="lede">Spin the Moon and pick one of NASA’s candidate regions near the south pole. Your orbiter will point its instrument there.</p>
      <p className="historical"><strong>Historical dataset.</strong> These are the 13 regions NASA named in <a href={sources.nasa2022.url} target="_blank" rel="noreferrer">August 2022</a> as
        candidate Artemis III landing regions. In <a href={sources.nasa2024.url} target="_blank" rel="noreferrer">October 2024</a> NASA narrowed its list to nine.
        They are places studied for landing, not detected ice deposits.</p>
    </header>

    <div className="target-stage">
      <div className="target-globe">
        {canRender ? <Suspense fallback={<p className="globe-loading">Loading the Moon…</p>}>
          <MoonGlobe view={view} selectedFootprint={shared?.id ?? selected?.footprintId ?? null} onSelectFootprint={chooseFootprint}
            markerLabel={item => item.regionIds.map(id => regionById(id)!.name).join(' / ')} onInteract={noop}/>
        </Suspense> : <p className="globe-loading">The 3D Moon needs WebGL, which isn’t available here. Use the list to choose a region.</p>}
        <div className="globe-views" role="group" aria-label="Globe view">
          <button type="button" aria-pressed={view === 'pole'} onClick={() => setView('pole')}>South pole</button>
          <button type="button" aria-pressed={view === 'globe'} onClick={() => setView('globe')}>Whole Moon</button>
        </div>
        <p className="globe-credit">Imagery: NASA LRO / LROC · NASA SVS. Drag to rotate, scroll or pinch to zoom.</p>
      </div>

      <aside className="target-side panel" aria-label="Candidate regions">
        <Transmission from={luna01.crew.reyes} urgent>{briefing(selected, shared, callSign)}</Transmission>
        {shared && <div className="shared-choice" role="group" aria-label="Regions in this mapped area">
          {shared.regionIds.map(id => <button key={id} type="button" onClick={() => choose(id)}>{regionById(id)!.name}</button>)}
        </div>}
        <h2 className="target-list-title">13 candidate regions <small>({footprints.length} mapped areas on the globe)</small></h2>
        <ol className="region-list">{regions.map(region => <li key={region.id}>
          <button type="button" aria-pressed={region.id === selected?.id} onClick={() => choose(region.id)}>
            <strong>{region.name}</strong>
            <span>{placed(region) ? formatLatLon(footprintById(region.footprintId)!.center.value!) : 'Position not yet verified'}
              {region.in2024List.value && <em> · on 2024 list</em>}</span>
          </button>
        </li>)}</ol>
      </aside>
    </div>

    {selected && <section className="panel target-detail" aria-labelledby="target-name">
      <div className="target-detail-main">
        <p className="eyebrow">Selected region</p>
        <h2 id="target-name">{selected.name}</h2>
        <p className="target-where">{fp?.center.value ? <>{formatLatLon(fp.center.value)} · about {kmFromPole(fp.center.value.lat)} km from the south pole</> : 'Position not yet verified'}</p>
        <p>{selected.summary}</p>
        <h3>What NASA said about all 13 regions</h3>
        <ul className="facts">{regionFacts.slice(1, 4).map(fact => <li key={fact.value}>{fact.value}</li>)}</ul>
      </div>
      <div className="target-detail-side">
        <h3>What this means for LUNA‑01</h3>
        <p>LUNA‑01 stays in orbit. Choosing this region means pointing its instrument here during the shadow pass, not landing.</p>
        <p className="fine">In this version the mission simulation uses one observation scenario for every region. Your choice is recorded,
          but it does not change power, data or score: modeling region-specific lighting and communication needs data we don’t have yet.</p>
        <button className="primary" onClick={game.confirmTarget}>Set {selected.name} as target</button>
      </div>
      <ScienceBehind region={selected}/>
    </section>}
  </section>
}
