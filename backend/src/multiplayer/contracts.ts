/**
 * Shared multiplayer wire contracts. Validated at runtime on the server.
 * Frontend mirrors these types; do not trust client payloads beyond this schema.
 */

import type { ConfigField, DownlinkAction, ObserveAction, SpacecraftConfig, WarningId } from '../domain/types'
import { ROLES, type Role } from './permissions'

export const PROTOCOL_VERSION = 1 as const
export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 2
export const MAX_NICKNAME = 16
export const VOTE_DEADLINE_MS = 45_000
export const RECONNECT_GRACE_MS = 90_000
export const IDLE_ROOM_MS = 10 * 60_000
export const UNJOINED_ROOM_MS = 15 * 60_000

export type RoomPhase =
  | 'lobby'
  | 'target'
  | 'builder'
  | 'reviews'
  | 'flight'
  | 'voting'
  | 'debrief'
  | 'closed'

export type VoteKind = 'observe' | 'downlink'

export interface PublicPlayer {
  id: string
  nickname: string
  role: Role | null
  connected: boolean
  ready: boolean
  isCommander: boolean
}

export interface PublicRoom {
  protocolVersion: typeof PROTOCOL_VERSION
  roomId: string
  code: string
  phase: RoomPhase
  revision: number
  players: PublicPlayer[]
  config: SpacecraftConfig
  targetId: string | null
  alternative: SpacecraftConfig | null
  evidence: {
    configHash: string
    acknowledgedWarnings: WarningId[]
    tradeStudy: null | {
      configHashA: string
      configHashB: string
      chosenConfigHash: string
      rationale: 'science' | 'mass' | 'cost' | 'risk'
    }
  } | null
  observation: ObserveAction | null
  vote: null | {
    kind: VoteKind
    options: string[]
    deadlineAt: string
    tallies: Record<string, string[]> // option -> playerIds
    tieRule: string
  }
  result: unknown | null
  fieldOwners: Record<ConfigField, Role | 'commander-fallback' | string>
  you?: { playerId: string; role: Role | null; canLaunch: boolean }
}

/** Client → server */
export type ClientMessage =
  | { type: 'hello'; protocolVersion: number; sessionToken?: string }
  | { type: 'create_room'; nickname: string }
  | { type: 'join_room'; code: string; nickname: string }
  | { type: 'reconnect'; sessionToken: string }
  | { type: 'set_role'; playerId: string; role: Role | null }
  | { type: 'claim_role'; role: Role }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_mission' }
  | { type: 'set_target'; targetId: string }
  | { type: 'confirm_target' }
  | { type: 'select_field'; field: ConfigField; value: string; baseRevision: number }
  | { type: 'save_alternative' }
  | { type: 'record_trade'; rationale: 'science' | 'mass' | 'cost' | 'risk'; baseRevision: number }
  | { type: 'ack_warning'; warningId: WarningId; acknowledged: boolean; baseRevision: number }
  | { type: 'advance_reviews' }
  | { type: 'launch'; baseRevision: number }
  | { type: 'cast_vote'; kind: VoteKind; choice: ObserveAction | DownlinkAction; baseRevision: number }
  | { type: 'leave' }
  | { type: 'ping' }

/** Server → client */
export type ServerMessage =
  | { type: 'welcome'; playerId: string; sessionToken: string }
  | { type: 'room'; room: PublicRoom }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'pong'; serverTime: string }
  | { type: 'kicked'; reason: string }

export type ErrorCode =
  | 'bad_protocol'
  | 'bad_nickname'
  | 'invalid_code'
  | 'room_full'
  | 'expired_room'
  | 'unauthorized'
  | 'forbidden'
  | 'stale_revision'
  | 'bad_message'
  | 'not_in_room'
  | 'rate_limited'
  | 'phase'

const CONFIG_FIELDS: ConfigField[] = ['payloadId', 'powerId', 'propulsionId', 'commsId', 'trajectoryId']

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isConfigField(value: unknown): value is ConfigField {
  return typeof value === 'string' && (CONFIG_FIELDS as readonly string[]).includes(value)
}

export function parseClientMessage(raw: unknown): ClientMessage | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Message must be an object' }
  const msg = raw as Record<string, unknown>
  const type = msg.type
  if (typeof type !== 'string') return { error: 'Missing type' }
  switch (type) {
    case 'hello':
      return {
        type,
        protocolVersion: Number(msg.protocolVersion),
        sessionToken: typeof msg.sessionToken === 'string' ? msg.sessionToken : undefined,
      }
    case 'create_room':
      if (typeof msg.nickname !== 'string') return { error: 'nickname required' }
      return { type, nickname: msg.nickname }
    case 'join_room':
      if (typeof msg.code !== 'string' || typeof msg.nickname !== 'string') return { error: 'code and nickname required' }
      return { type, code: msg.code, nickname: msg.nickname }
    case 'reconnect':
      if (typeof msg.sessionToken !== 'string') return { error: 'sessionToken required' }
      return { type, sessionToken: msg.sessionToken }
    case 'set_role':
      if (typeof msg.playerId !== 'string') return { error: 'playerId required' }
      if (msg.role !== null && !isRole(msg.role)) return { error: 'invalid role' }
      return { type, playerId: msg.playerId, role: msg.role as Role | null }
    case 'claim_role':
      if (!isRole(msg.role)) return { error: 'invalid role' }
      return { type, role: msg.role }
    case 'set_ready':
      return { type, ready: Boolean(msg.ready) }
    case 'start_mission':
      return { type }
    case 'set_target':
      if (typeof msg.targetId !== 'string') return { error: 'targetId required' }
      return { type, targetId: msg.targetId }
    case 'confirm_target':
      return { type }
    case 'select_field':
      if (!isConfigField(msg.field) || typeof msg.value !== 'string' || typeof msg.baseRevision !== 'number') {
        return { error: 'field, value, baseRevision required' }
      }
      return { type, field: msg.field, value: msg.value, baseRevision: msg.baseRevision }
    case 'save_alternative':
      return { type }
    case 'record_trade': {
      const r = msg.rationale
      if (r !== 'science' && r !== 'mass' && r !== 'cost' && r !== 'risk') return { error: 'invalid rationale' }
      if (typeof msg.baseRevision !== 'number') return { error: 'baseRevision required' }
      return { type, rationale: r, baseRevision: msg.baseRevision }
    }
    case 'ack_warning':
      if (typeof msg.warningId !== 'string' || typeof msg.baseRevision !== 'number') return { error: 'warningId and baseRevision required' }
      return { type, warningId: msg.warningId as WarningId, acknowledged: Boolean(msg.acknowledged), baseRevision: msg.baseRevision }
    case 'advance_reviews':
      return { type }
    case 'launch':
      if (typeof msg.baseRevision !== 'number') return { error: 'baseRevision required' }
      return { type, baseRevision: msg.baseRevision }
    case 'cast_vote': {
      if (msg.kind !== 'observe' && msg.kind !== 'downlink') return { error: 'invalid vote kind' }
      if (typeof msg.choice !== 'string' || typeof msg.baseRevision !== 'number') return { error: 'choice and baseRevision required' }
      return { type, kind: msg.kind, choice: msg.choice as ObserveAction | DownlinkAction, baseRevision: msg.baseRevision }
    }
    case 'leave':
      return { type }
    case 'ping':
      return { type }
    default:
      return { error: `Unknown type: ${type}` }
  }
}

export function sanitizeNickname(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name || name.length > MAX_NICKNAME) return null
  if (/[<>\u0000-\u001f]/.test(name)) return null
  return name
}
