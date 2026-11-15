import { useState } from 'react'
import type { Save } from '../app/save'

const weatherScenarios = {
  quiet: {
    label: 'Quiet solar conditions',
    outlook: 'Use this scenario to check whether the payload supports the mission’s science goal.',
    field: 'payloadId', choice: 'ice_spectrometer',
    ready: 'The spectrometer can look for signs of water ice.',
    gap: 'The mapping camera gives you terrain context. Choose the ice-sensitive spectrometer to investigate water ice.',
  },
  shadow: {
    label: 'Observation in shadow',
    outlook: 'During the observation window in shadow, the solar array stops generating power and the spacecraft draws on its battery.',
    field: 'powerId', choice: 'solar_storage',
    ready: 'Solar + storage gives your spacecraft more energy for the observation window.',
    gap: 'Lightweight solar has less stored energy. Consider solar + storage if the observation needs to run longer.',
  },
  solar: {
    label: 'Elevated solar activity',
    outlook: 'A solar disturbance can disrupt communications. Consider what you would prioritize if the link were only available briefly.',
    field: 'commsId', choice: 'comms_high',
    ready: 'The high-throughput antenna can return more science while the link is available.',
    gap: 'The basic antenna returns less data. Consider prioritizing the most valuable science packets.',
  },
} as const

export function WeatherPlanner({ config }: { config: Save['config'] }) {
  const [scenario, setScenario] = useState<keyof typeof weatherScenarios>('quiet')
  const weather = weatherScenarios[scenario]
  const prepared = config[weather.field] === weather.choice
  return <section className="panel builder-weather">
    <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/> Environment / Scenario desk</p>
    <h2>Space weather</h2>
    <label className="control">
      Scenario
      <select value={scenario} onChange={event => {
        const selection = event.target.value
        if (selection === 'quiet' || selection === 'shadow' || selection === 'solar') setScenario(selection)
      }}>
        {Object.entries(weatherScenarios).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </select>
    </label>
    <div role="status">
      <p>{weather.outlook}</p>
      <p className="builder-weather-note"><strong>Your design</strong> {prepared ? weather.ready : weather.gap}</p>
    </div>
    <small>Scenarios are illustrative and do not change the flight simulation.</small>
  </section>
}
