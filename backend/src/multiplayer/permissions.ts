import type { ConfigField } from '../domain/types'

export const ROLES = ['commander', 'payload', 'power', 'flight'] as const
export type Role = (typeof ROLES)[number]

export const roleLabels: Record<Role, string> = {
  commander: 'Commander',
  payload: 'Payload Engineer',
  power: 'Power Engineer',
  flight: 'Flight Director',
}

/** Primary owner of each editable config field. */
export const fieldOwner: Record<ConfigField, Role> = {
  payloadId: 'payload',
  powerId: 'power',
  propulsionId: 'flight',
  commsId: 'flight',
  trajectoryId: 'commander',
}

/**
 * Who may edit a field given the set of roles currently seated.
 * Empty-role fields fall back so a crew of two can still operate every subsystem.
 */
export function canEditField(field: ConfigField, actorRole: Role, seated: ReadonlySet<Role>): boolean {
  const primary = fieldOwner[field]
  if (actorRole === primary) return true
  if (seated.has(primary)) return false
  // Fallbacks when primary seat is empty
  if (field === 'commsId') {
    if (seated.has('payload')) return actorRole === 'payload'
    return actorRole === 'commander'
  }
  if (field === 'trajectoryId') {
    if (seated.has('flight')) return actorRole === 'flight'
    return actorRole === 'commander'
  }
  // payload, power, propulsion → Commander when primary empty
  return actorRole === 'commander'
}

export function canRecordTradeStudy(actorRole: Role): boolean {
  return actorRole === 'commander'
}

export function canAcknowledgeWarnings(actorRole: Role): boolean {
  return actorRole === 'commander'
}

export function canLaunch(actorRole: Role): boolean {
  return actorRole === 'commander'
}

export function canAssignRoles(actorRole: Role): boolean {
  return actorRole === 'commander'
}
