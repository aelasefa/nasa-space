import type { MutableField, SpacecraftConfig, OperationalDecisions } from './contracts'

type Inputs = SpacecraftConfig & OperationalDecisions
export const options = {
  payloadId: [['mapping_camera', 'Mapping camera'], ['ice_spectrometer', 'Ice-sensitive spectrometer']],
  powerId: [['solar_light', 'Lightweight solar'], ['solar_storage', 'Solar + storage']],
  propulsionId: [['prop_low', 'Low reserve'], ['prop_high', 'High reserve']],
  commsId: [['comms_basic', 'Basic antenna'], ['comms_high', 'High-throughput antenna']],
  trajectoryId: [['direct', 'Direct transfer'], ['efficient', 'Efficient transfer']],
  observeAction: [['observe_full', 'Full observation'], ['conserve', 'Conserve battery']],
  downlinkAction: [['science_first', 'Science first'], ['health_first', 'Health first']],
} as const satisfies { [K in MutableField]: readonly (readonly [Inputs[K], string])[] }
export const fields = {
  payloadId: 'Scientific payload', powerId: 'Power system', propulsionId: 'Propulsion',
  commsId: 'Communications', trajectoryId: 'Trajectory', observeAction: 'Observation', downlinkAction: 'Downlink',
} satisfies Record<MutableField, string>
export const configFields = ['payloadId', 'powerId', 'propulsionId', 'commsId', 'trajectoryId'] as const
export const decisionFields = [...configFields, 'observeAction', 'downlinkAction'] as const
export const initialConfig: SpacecraftConfig = {
  payloadId: 'mapping_camera', powerId: 'solar_light', propulsionId: 'prop_low', commsId: 'comms_basic', trajectoryId: 'efficient',
}
export const rationaleLabels = { science: 'Scientific return', mass: 'Launch mass', cost: 'Budget', risk: 'Engineering risk' }
export function label(field: MutableField, value: string) {
  return options[field].find(([id]) => id === value)?.[1] ?? value
}
