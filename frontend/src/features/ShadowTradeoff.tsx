import { useState } from 'react'
import type { Game } from '../app/controller'
import type { PowerId, TradeStudyEvidence } from '../app/contracts'
import { scenario } from '../app/engine'
import { label, options, rationaleLabels } from '../app/options'
import type { Save } from '../app/save'
import { shadowEnergy } from '../app/story'
import { number } from '../components/MissionData'
import { ScienceLead } from '../components/ScienceLead'
import { Term } from '../components/Term'

/**
 * The builder's teaching path: one meaningful tradeoff (battery vs. cost and mass),
 * walked through as a short sequence ending in a recorded trade study. All figures
 * come from the engine (resolveObservation, computeResources).
 */
export function ShadowTradeoff({ game, save }: { game: Game; save: Save }) {
  const engine = game.engine!
  const { config, alternative, evidence } = save
  const [rationale, setRationale] = useState<TradeStudyEvidence['rationale'] | ''>('')
  const iceReady = config.payloadId === 'ice_spectrometer'
  const hash = engine.hashConfig(config)
  const distinct = Boolean(alternative && engine.hashConfig(alternative) !== hash)
  const recorded = evidence?.tradeStudy && evidence.tradeStudy.chosenConfigHash === hash &&
    evidence.tradeStudy.configHashA === (alternative && engine.hashConfig(alternative)) ? evidence.tradeStudy : null

  const powers = options.powerId.map(([id, name]) => {
    const candidate = { ...config, powerId: id as PowerId }
    const energy = shadowEnergy(engine.resolveObservation(candidate, 'observe_full').event, scenario.shadowHours)
    const resources = engine.computeResources(candidate)
    return { id: id as PowerId, name, energy, resources }
  })
  const [light, storage] = powers

  return <section className="panel tradeoff" aria-labelledby="tradeoff-title">
    <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/> The key decision</p>
    <h2 id="tradeoff-title">Can we afford to stay awake in shadow?</h2>
    <ScienceLead>In shadow the solar panels give us nothing. If the battery runs dry, the sensor shuts off and we lose
      the crater floor, which is exactly where the signal is.</ScienceLead>

    <ol className="tradeoff-steps">
      <li data-done={iceReady || undefined}>
        <h3><span aria-hidden="true">1</span> Carry an instrument that can see ice</h3>
        {iceReady ? <p>The <strong>ice-sensitive spectrometer</strong> is on board. It draws more power than the camera,
          which is why the battery matters.</p> : <>
          <p>The mapping camera is cheaper, but it can’t detect ice. This mission needs the spectrometer.</p>
          <button className="primary" onClick={() => game.select('payloadId', 'ice_spectrometer')}>Use the ice spectrometer</button>
        </>}
      </li>

      <li data-done={iceReady && config.powerId === 'solar_storage' || undefined}>
        <h3><span aria-hidden="true">2</span> Compare the two power systems</h3>
        <p>For a full pass across the crater floor, the spacecraft must run on its <Term id="battery">battery</Term> for {scenario.shadowHours} hours.</p>
        <div className="power-compare">{powers.map(power => {
          const other = power.id === light.id ? storage : light
          const selected = config.powerId === power.id
          const e = power.energy
          const covered = e ? Math.min(1, e.available / e.needed) : 0
          return <article key={power.id} className="power-card" data-selected={selected || undefined}>
            <h4>{power.name}{selected && <span className="tag">Installed</span>}</h4>
            {e ? <>
              <div className="energy-bar" role="img" aria-label={`${number(e.available)} watt-hours available of ${number(e.needed)} needed`}>
                <span style={{ width: `${covered * 100}%` }}/>
              </div>
              <dl className="power-facts">
                <div><dt>Energy available</dt><dd>{number(e.available)} Wh</dd></div>
                <div><dt>Needed for a full pass</dt><dd>{number(e.needed)} Wh</dd></div>
                <div><dt>Survey it can record</dt><dd>{Math.round(e.coverage * 100)}%</dd></div>
                <div><dt>Cost and mass</dt><dd>{number(power.resources.costBU)} BU · {number(power.resources.launchMassKg)} kg</dd></div>
              </dl>
              <p className="power-delta">{power.id === storage.id
                ? `+${number(power.resources.costBU - other.resources.costBU)} BU and +${number(power.resources.launchMassKg - other.resources.launchMassKg)} kg over lightweight solar.`
                : e.coverage < 1 ? 'Cheaper and lighter, but the sensor would shut off partway through the shadow.' : 'Cheaper and lighter.'}</p>
            </> : <p>Energy figures are unavailable.</p>}
            <button aria-pressed={selected} onClick={() => game.select('powerId', power.id)}>
              {selected ? `${power.name} installed` : `Install ${power.name.toLowerCase()}`}</button>
          </article>
        })}</div>
      </li>

      <li data-done={Boolean(recorded) || undefined}>
        <h3><span aria-hidden="true">3</span> Record your decision</h3>
        <p>Engineers compare two designs before choosing. Save one as a <Term id="baseline">baseline</Term>, switch the
          power system, then say why you prefer the current design.</p>
        {!alternative && <button onClick={game.saveAlternative}>Save current design as baseline</button>}
        {alternative && !distinct && <p className="tradeoff-hint" role="status">Baseline saved with {label('powerId', alternative.powerId).toLowerCase()}.
          Now switch the power system (or any part) to compare.</p>}
        {distinct && !recorded && <div className="tradeoff-record">
          <label className="control">Why is the current design better?
            <select value={rationale} onChange={event => setRationale(event.target.value as typeof rationale)}>
              <option value="">Choose a reason</option>
              {Object.entries(rationaleLabels).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
            </select>
          </label>
          <button disabled={!rationale} onClick={() => { if (rationale) game.trade(rationale) }}>Record decision</button>
        </div>}
        {recorded && <p className="tradeoff-hint" role="status">Decision recorded: {rationaleLabels[recorded.rationale].toLowerCase()}.
          You can still change any part below; changing one clears this record.</p>}
        {alternative && <button className="quiet tradeoff-reset" onClick={game.saveAlternative}>Use current design as the baseline instead</button>}
      </li>
    </ol>
    <div className="tradeoff-next">
      <button className="primary" onClick={game.reviews}>Open engineering review</button>
      <p className="fine">Every part, the full numbers and planning tools are below.</p>
    </div>
  </section>
}
