import { experiences, pages } from '../app/experiences'

const phaseNames: Record<string, string> = {
  target: 'choosing a target', builder: 'building the orbiter', reviews: 'in engineering review',
  flight: 'in Mission Control', debrief: 'at the debrief', multiverse: 'comparing replays',
}

/**
 * The entry screen: three experiences, each with one description and one way in.
 * Solo and crew sit inside the Orbiter card because they are two ways to play one mission.
 */
export function Hub({ soloPhase, crewCode, onSolo, onCrew }: {
  /** Phase of the solo draft saved on this device, if the mission has started. */
  soloPhase?: string
  /** Room code of a guest mission saved on this device. */
  crewCode?: string
  onSolo: () => void
  onCrew: () => void
}) {
  const { orbiter, rover, academy } = experiences
  const resume = soloPhase ? phaseNames[soloPhase] : undefined
  return <section className="hub" aria-labelledby="hub-title">
    <p className="intro-transmission"><span className="builder-signal" aria-hidden="true"/>Mission hub · Lunar south pole</p>
    <h1 id="hub-title">Amanar</h1>
    <p className="lede">Three ways to explore the Moon’s south pole. Start with any of them.</p>

    <ul className="hub-grid">
      <li className="panel hub-card hub-card-lead" aria-labelledby="hub-orbiter">
        <p className="eyebrow">{orbiter.kind}</p>
        <h2 id="hub-orbiter">{orbiter.name}</h2>
        <p>{orbiter.summary}</p>
        <div className="hub-ways" role="group" aria-label="Two ways to play the Orbiter mission">
          <div className="hub-way">
            <button type="button" className="primary" onClick={onSolo} aria-describedby="hub-solo-note">
              {resume ? 'Resume solo mission' : 'Fly solo'}</button>
            <p className="fine" id="hub-solo-note">{resume ? `Your draft is saved on this device, ${resume}.` : 'On your own. Your draft stays on this device.'}</p>
          </div>
          <div className="hub-way">
            <button type="button" onClick={onCrew} aria-describedby="hub-crew-note">
              {crewCode ? 'Rejoin your crew' : 'Fly with a crew'}</button>
            <p className="fine" id="hub-crew-note">{crewCode ? `Guest mission ${crewCode} is saved on this device.` : 'Share one orbiter with 2–4 guests. No accounts.'}</p>
          </div>
        </div>
        <p className="fine hub-note">{orbiter.note}</p>
      </li>

      <li className="panel hub-card" aria-labelledby="hub-rover">
        <p className="eyebrow">{rover.kind}</p>
        <h2 id="hub-rover">{rover.name}</h2>
        <p>{rover.summary}</p>
        <a className="button" href={pages.rover}>Drive the rover</a>
        <p className="fine hub-note">{rover.note}</p>
      </li>

      <li className="panel hub-card" aria-labelledby="hub-academy">
        <p className="eyebrow">{academy.kind}</p>
        <h2 id="hub-academy">{academy.name}</h2>
        <p>{academy.summary}</p>
        <a className="button" href={pages.academy}>Open the Academy</a>
        <p className="fine hub-note">{academy.note}</p>
      </li>
    </ul>
  </section>
}
