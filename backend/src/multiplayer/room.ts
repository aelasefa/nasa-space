import {
  evaluateFeasibility,
  evaluateReviews,
  hashConfig,
  simulateMission,
  PAYLOAD_CATALOG,
  POWER_CATALOG,
  PROPULSION_CATALOG,
  COMMS_CATALOG,
  TRAJECTORY_CATALOG,
  DEFAULT_MODEL_VERSION,
  DEFAULT_SCENARIO_ID,
} from '../domain'
import type {
  ConfigField,
  DownlinkAction,
  ObserveAction,
  SpacecraftConfig,
  WarningId,
} from '../domain/types'
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROTOCOL_VERSION,
  RECONNECT_GRACE_MS,
  VOTE_DEADLINE_MS,
  parseClientMessage,
  sanitizeNickname,
  type ClientMessage,
  type ErrorCode,
  type PublicRoom,
  type RoomPhase,
  type ServerMessage,
  type VoteKind,
} from './contracts'
import { hashToken, newPlayerId, newRoomCode, newRoomId, newSessionToken, normalizeRoomCode } from './ids'
import {
  canAcknowledgeWarnings,
  canAssignRoles,
  canEditField,
  canLaunch,
  canRecordTradeStudy,
  fieldOwner,
  roleLabels,
  type Role,
  ROLES,
} from './permissions'

const STARTER: SpacecraftConfig = {
  payloadId: 'mapping_camera',
  powerId: 'solar_light',
  propulsionId: 'prop_low',
  commsId: 'comms_basic',
  trajectoryId: 'efficient',
}

const CATALOGS: Record<ConfigField, Record<string, unknown>> = {
  payloadId: PAYLOAD_CATALOG,
  powerId: POWER_CATALOG,
  propulsionId: PROPULSION_CATALOG,
  commsId: COMMS_CATALOG,
  trajectoryId: TRAJECTORY_CATALOG,
}

export type SocketSink = {
  send(message: ServerMessage): void
  close(code?: number, reason?: string): void
}

type Player = {
  id: string
  nickname: string
  role: Role | null
  ready: boolean
  sessionHash: string
  /** plaintext token only issued once at create/join/reconnect response — not stored after */
  connected: boolean
  disconnectAt: number | null
  sink: SocketSink | null
  lastActionAt: number
}

type VoteState = {
  kind: VoteKind
  options: string[]
  deadlineAt: number
  votes: Map<string, string> // playerId -> choice
  resolved: boolean
}

export type Room = {
  id: string
  code: string
  phase: RoomPhase
  revision: number
  commanderId: string
  players: Map<string, Player>
  config: SpacecraftConfig
  targetId: string | null
  alternative: SpacecraftConfig | null
  evidence: PublicRoom['evidence']
  observation: ObserveAction | null
  downlink: DownlinkAction | null
  vote: VoteState | null
  result: unknown | null
  createdAt: number
  lastActiveAt: number
}

const TIE_RULE = 'On a tie, the Commander’s vote wins; if the Commander did not vote for a tied option, the earliest vote among tied options wins.'

function seatedRoles(room: Room): Set<Role> {
  const set = new Set<Role>()
  for (const p of room.players.values()) if (p.role) set.add(p.role)
  return set
}

function effectiveOwner(field: ConfigField, seated: Set<Role>): string {
  const primary = fieldOwner[field]
  if (seated.has(primary)) return primary
  if (field === 'commsId' && seated.has('payload')) return 'payload'
  if (field === 'trajectoryId' && seated.has('flight')) return 'flight'
  return 'commander'
}

function bump(room: Room) {
  room.revision += 1
  room.lastActiveAt = Date.now()
}

function clearReady(room: Room) {
  for (const p of room.players.values()) p.ready = false
}

function invalidateEvidence(room: Room) {
  // Keep acknowledged warnings? Spec: meaningful changes invalidate reviews.
  room.evidence = null
}

function publicRoom(room: Room, viewerId?: string): PublicRoom {
  const seated = seatedRoles(room)
  const fieldOwners = {} as PublicRoom['fieldOwners']
  for (const field of Object.keys(fieldOwner) as ConfigField[]) {
    fieldOwners[field] = effectiveOwner(field, seated)
  }
  const players = [...room.players.values()].map(p => ({
    id: p.id,
    nickname: p.nickname,
    role: p.role,
    connected: p.connected,
    ready: p.ready,
    isCommander: p.id === room.commanderId,
  }))
  const viewer = viewerId ? room.players.get(viewerId) : undefined
  return {
    protocolVersion: PROTOCOL_VERSION,
    roomId: room.id,
    code: room.code,
    phase: room.phase,
    revision: room.revision,
    players,
    config: room.config,
    targetId: room.targetId,
    alternative: room.alternative,
    evidence: room.evidence,
    observation: room.observation,
    vote: room.vote && !room.vote.resolved ? {
      kind: room.vote.kind,
      options: room.vote.options,
      deadlineAt: new Date(room.vote.deadlineAt).toISOString(),
      tallies: Object.fromEntries(room.vote.options.map(opt => [
        opt,
        [...room.vote!.votes.entries()].filter(([, c]) => c === opt).map(([id]) => id),
      ])),
      tieRule: TIE_RULE,
    } : null,
    result: room.result,
    fieldOwners,
    you: viewer ? {
      playerId: viewer.id,
      role: viewer.role,
      canLaunch: viewer.role === 'commander',
    } : undefined,
  }
}

function broadcast(room: Room) {
  for (const p of room.players.values()) {
    if (p.connected && p.sink) p.sink.send({ type: 'room', room: publicRoom(room, p.id) })
  }
}

function sendError(sink: SocketSink, code: ErrorCode, message: string) {
  sink.send({ type: 'error', code, message })
}

function connectedCount(room: Room) {
  let n = 0
  for (const p of room.players.values()) if (p.connected) n++
  return n
}

function allConnectedReady(room: Room) {
  const connected = [...room.players.values()].filter(p => p.connected)
  return connected.length >= MIN_PLAYERS && connected.every(p => p.ready)
}

function reviewsAuthorized(room: Room): boolean {
  if (!room.evidence || !room.alternative || !room.evidence.tradeStudy) return false
  if (room.evidence.configHash !== hashConfig(room.config)) return false
  if (room.evidence.tradeStudy.configHashA !== hashConfig(room.alternative)) return false
  if (room.evidence.tradeStudy.configHashB !== hashConfig(room.config)) return false
  return evaluateReviews(room.config, room.evidence as never).authorized
}

function openVote(room: Room, kind: VoteKind) {
  const options = kind === 'observe' ? ['observe_full', 'conserve'] : ['science_first', 'health_first']
  room.phase = 'voting'
  room.vote = {
    kind,
    options,
    deadlineAt: Date.now() + VOTE_DEADLINE_MS,
    votes: new Map(),
    resolved: false,
  }
  bump(room)
  broadcast(room)
}

function resolveVote(room: Room): string | null {
  const vote = room.vote
  if (!vote || vote.resolved) return null
  const counts = new Map<string, number>()
  for (const opt of vote.options) counts.set(opt, 0)
  const order: string[] = []
  for (const [pid, choice] of vote.votes) {
    counts.set(choice, (counts.get(choice) ?? 0) + 1)
    order.push(choice)
  }
  // Include only connected players at resolution? Spec: team voting — disconnected don't vote.
  let best = vote.options[0]!
  let bestCount = -1
  for (const opt of vote.options) {
    const c = counts.get(opt) ?? 0
    if (c > bestCount) { best = opt; bestCount = c }
  }
  const tied = vote.options.filter(opt => (counts.get(opt) ?? 0) === bestCount)
  if (tied.length > 1) {
    const commander = room.players.get(room.commanderId)
    const cmdChoice = commander ? vote.votes.get(commander.id) : undefined
    if (cmdChoice && tied.includes(cmdChoice)) best = cmdChoice
    else {
      // earliest vote among tied
      for (const choice of order) {
        if (tied.includes(choice)) { best = choice; break }
      }
    }
  }
  vote.resolved = true
  return best
}

function finishSimulation(room: Room) {
  if (!room.observation || !room.downlink) return
  const attempt = simulateMission({
    config: room.config,
    decisions: { observeAction: room.observation, downlinkAction: room.downlink },
    scenarioId: DEFAULT_SCENARIO_ID,
    modelVersion: DEFAULT_MODEL_VERSION,
  })
  room.result = attempt
  room.phase = 'debrief'
  room.vote = null
  clearReady(room)
  bump(room)
  broadcast(room)
}

export class RoomRegistry {
  private rooms = new Map<string, Room>()
  private byCode = new Map<string, string>()
  private sessions = new Map<string, { roomId: string; playerId: string }>() // tokenHash ->
  private createHits = new Map<string, number[]>() // ip -> timestamps
  private now = () => Date.now()

  /** Test seam */
  setClock(fn: () => number) { this.now = fn }

  getRoom(id: string) { return this.rooms.get(id) }

  cleanup() {
    const t = this.now()
    for (const room of [...this.rooms.values()]) {
      // expire reconnect seats
      for (const p of [...room.players.values()]) {
        if (!p.connected && p.disconnectAt && t - p.disconnectAt > RECONNECT_GRACE_MS) {
          this.removePlayer(room, p.id)
        }
      }
      const empty = room.players.size === 0
      const idle = t - room.lastActiveAt > (empty ? 0 : 10 * 60_000)
      const unjoined = room.players.size <= 1 && connectedCount(room) === 0 && t - room.createdAt > 15 * 60_000
      if (empty || (connectedCount(room) === 0 && t - room.lastActiveAt > 10 * 60_000) || unjoined) {
        this.destroyRoom(room.id)
      }
      // resolve expired votes
      if (room.vote && !room.vote.resolved && t >= room.vote.deadlineAt) {
        this.closeVote(room)
      }
    }
  }

  private destroyRoom(id: string) {
    const room = this.rooms.get(id)
    if (!room) return
    for (const p of room.players.values()) {
      for (const [hash, ref] of this.sessions) {
        if (ref.playerId === p.id) this.sessions.delete(hash)
      }
      p.sink?.send({ type: 'kicked', reason: 'Room closed' })
      p.sink?.close(1000, 'room closed')
    }
    this.byCode.delete(room.code)
    this.rooms.delete(id)
  }

  private removePlayer(room: Room, playerId: string) {
    const p = room.players.get(playerId)
    if (!p) return
    room.players.delete(playerId)
    for (const [hash, ref] of this.sessions) {
      if (ref.playerId === playerId) this.sessions.delete(hash)
    }
    if (room.commanderId === playerId) {
      const next = [...room.players.values()].find(x => x.connected) ?? [...room.players.values()][0]
      if (next) {
        room.commanderId = next.id
        if (!next.role) next.role = 'commander'
      }
    }
    clearReady(room)
    bump(room)
    if (room.players.size === 0) this.destroyRoom(room.id)
    else broadcast(room)
  }

  private rateLimit(ip: string, key: 'create' | 'join'): boolean {
    const map = this.createHits
    const stamp = `${key}:${ip}`
    const list = (map.get(stamp) ?? []).filter(t => this.now() - t < 60_000)
    if (list.length >= 10) { map.set(stamp, list); return false }
    list.push(this.now())
    map.set(stamp, list)
    return true
  }

  attach(sink: SocketSink, ip = 'local') {
    let playerId: string | null = null
    let roomId: string | null = null
    let authed = false

    const handle = (raw: unknown) => {
      this.cleanup()
      const parsed = parseClientMessage(raw)
      if ('error' in parsed) {
        sendError(sink, 'bad_message', parsed.error)
        return
      }
      const msg = parsed as ClientMessage
      try {
        this.dispatch(msg, sink, ip, {
          get playerId() { return playerId },
          set playerId(v) { playerId = v },
          get roomId() { return roomId },
          set roomId(v) { roomId = v },
          get authed() { return authed },
          set authed(v) { authed = v },
        })
      } catch (err) {
        sendError(sink, 'bad_message', err instanceof Error ? err.message : 'error')
      }
    }

    const disconnect = () => {
      if (!roomId || !playerId) return
      const room = this.rooms.get(roomId)
      const p = room?.players.get(playerId)
      if (!room || !p) return
      p.connected = false
      p.disconnectAt = this.now()
      p.sink = null
      p.ready = false
      bump(room)
      broadcast(room)
    }

    return { handle, disconnect }
  }

  private dispatch(
    msg: ClientMessage,
    sink: SocketSink,
    ip: string,
    ctx: { playerId: string | null; roomId: string | null; authed: boolean },
  ) {
    switch (msg.type) {
      case 'ping':
        sink.send({ type: 'pong', serverTime: new Date(this.now()).toISOString() })
        return
      case 'hello':
        if (msg.protocolVersion !== PROTOCOL_VERSION) {
          sendError(sink, 'bad_protocol', `Expected protocol ${PROTOCOL_VERSION}`)
          return
        }
        ctx.authed = true
        return
      case 'create_room':
        this.createRoom(msg, sink, ip, ctx)
        return
      case 'join_room':
        this.joinRoom(msg, sink, ip, ctx)
        return
      case 'reconnect':
        this.reconnect(msg.sessionToken, sink, ctx)
        return
      default:
        break
    }
    if (!ctx.authed) { sendError(sink, 'unauthorized', 'Send hello first'); return }
    if (!ctx.roomId || !ctx.playerId) { sendError(sink, 'not_in_room', 'Join or create a room first'); return }
    const room = this.rooms.get(ctx.roomId)
    const player = room?.players.get(ctx.playerId)
    if (!room || !player) { sendError(sink, 'expired_room', 'Room no longer exists'); return }
    player.sink = sink
    player.connected = true
    player.disconnectAt = null
    player.lastActionAt = this.now()

    switch (msg.type) {
      case 'set_role': this.setRole(room, player, msg.playerId, msg.role, sink); break
      case 'claim_role': this.claimRole(room, player, msg.role, sink); break
      case 'set_ready': this.setReady(room, player, msg.ready); break
      case 'start_mission': this.startMission(room, player, sink); break
      case 'set_target': this.setTarget(room, player, msg.targetId, sink); break
      case 'confirm_target': this.confirmTarget(room, player, sink); break
      case 'select_field': this.selectField(room, player, msg.field, msg.value, msg.baseRevision, sink); break
      case 'save_alternative': this.saveAlternative(room, player, sink); break
      case 'record_trade': this.recordTrade(room, player, msg.rationale, msg.baseRevision, sink); break
      case 'ack_warning': this.ackWarning(room, player, msg.warningId, msg.acknowledged, msg.baseRevision, sink); break
      case 'advance_reviews': this.advanceReviews(room, player, sink); break
      case 'launch': this.launch(room, player, msg.baseRevision, sink); break
      case 'cast_vote': this.castVote(room, player, msg.kind, msg.choice, msg.baseRevision, sink); break
      case 'leave':
        this.removePlayer(room, player.id)
        ctx.roomId = null
        ctx.playerId = null
        break
      default:
        sendError(sink, 'bad_message', 'Unhandled message')
    }
  }

  private issueSession(room: Room, player: Player): string {
    const token = newSessionToken()
    this.sessions.set(hashToken(token), { roomId: room.id, playerId: player.id })
    player.sessionHash = hashToken(token)
    return token
  }

  private createRoom(
    msg: Extract<ClientMessage, { type: 'create_room' }>,
    sink: SocketSink,
    ip: string,
    ctx: { playerId: string | null; roomId: string | null; authed: boolean },
  ) {
    if (!ctx.authed) { sendError(sink, 'unauthorized', 'Send hello first'); return }
    if (!this.rateLimit(ip, 'create')) { sendError(sink, 'rate_limited', 'Too many rooms created'); return }
    const nickname = sanitizeNickname(msg.nickname)
    if (!nickname) { sendError(sink, 'bad_nickname', 'Nickname must be 1–16 characters'); return }
    let code = newRoomCode()
    while (this.byCode.has(code)) code = newRoomCode()
    const id = newRoomId()
    const playerId = newPlayerId()
    const player: Player = {
      id: playerId, nickname, role: 'commander', ready: false, sessionHash: '',
      connected: true, disconnectAt: null, sink, lastActionAt: this.now(),
    }
    const room: Room = {
      id, code, phase: 'lobby', revision: 1, commanderId: playerId,
      players: new Map([[playerId, player]]),
      config: { ...STARTER }, targetId: null, alternative: { ...STARTER }, evidence: null,
      observation: null, downlink: null, vote: null, result: null,
      createdAt: this.now(), lastActiveAt: this.now(),
    }
    this.rooms.set(id, room)
    this.byCode.set(code, id)
    const token = this.issueSession(room, player)
    ctx.roomId = id
    ctx.playerId = playerId
    sink.send({ type: 'welcome', playerId, sessionToken: token })
    sink.send({ type: 'room', room: publicRoom(room, playerId) })
  }

  private joinRoom(
    msg: Extract<ClientMessage, { type: 'join_room' }>,
    sink: SocketSink,
    ip: string,
    ctx: { playerId: string | null; roomId: string | null; authed: boolean },
  ) {
    if (!ctx.authed) { sendError(sink, 'unauthorized', 'Send hello first'); return }
    if (!this.rateLimit(ip, 'join')) { sendError(sink, 'rate_limited', 'Too many join attempts'); return }
    const nickname = sanitizeNickname(msg.nickname)
    if (!nickname) { sendError(sink, 'bad_nickname', 'Nickname must be 1–16 characters'); return }
    const code = normalizeRoomCode(msg.code)
    const roomId = this.byCode.get(code)
    const room = roomId ? this.rooms.get(roomId) : undefined
    if (!room || room.phase === 'closed') { sendError(sink, 'invalid_code', 'No mission uses that code'); return }
    if (room.players.size >= MAX_PLAYERS) { sendError(sink, 'room_full', 'This mission already has 4 players'); return }
    if (room.phase !== 'lobby' && room.phase !== 'target' && room.phase !== 'builder') {
      // allow join only before flight for simplicity — reconnect covers mid-mission
      sendError(sink, 'expired_room', 'This mission has already launched')
      return
    }
    const playerId = newPlayerId()
    const player: Player = {
      id: playerId, nickname, role: null, ready: false, sessionHash: '',
      connected: true, disconnectAt: null, sink, lastActionAt: this.now(),
    }
    room.players.set(playerId, player)
    clearReady(room)
    bump(room)
    const token = this.issueSession(room, player)
    ctx.roomId = room.id
    ctx.playerId = playerId
    sink.send({ type: 'welcome', playerId, sessionToken: token })
    broadcast(room)
  }

  private reconnect(
    sessionToken: string,
    sink: SocketSink,
    ctx: { playerId: string | null; roomId: string | null; authed: boolean },
  ) {
    const ref = this.sessions.get(hashToken(sessionToken))
    if (!ref) { sendError(sink, 'unauthorized', 'Session expired or unknown'); return }
    const room = this.rooms.get(ref.roomId)
    const player = room?.players.get(ref.playerId)
    if (!room || !player) { sendError(sink, 'expired_room', 'Mission room is gone'); return }
    // Replace duplicate connection
    if (player.sink && player.sink !== sink) {
      player.sink.send({ type: 'kicked', reason: 'Connected from another tab' })
      player.sink.close(4000, 'replaced')
    }
    player.sink = sink
    player.connected = true
    player.disconnectAt = null
    ctx.authed = true
    ctx.roomId = room.id
    ctx.playerId = player.id
    const token = this.issueSession(room, player) // rotate
    sink.send({ type: 'welcome', playerId: player.id, sessionToken: token })
    bump(room)
    broadcast(room)
  }

  private requireRole(player: Player, sink: SocketSink): Role | null {
    if (!player.role) { sendError(sink, 'forbidden', 'Claim a role first'); return null }
    return player.role
  }

  private setRole(room: Room, actor: Player, targetId: string, role: Role | null, sink: SocketSink) {
    if (room.phase !== 'lobby') { sendError(sink, 'phase', 'Roles are locked after the mission starts'); return }
    if (!canAssignRoles(actor.role ?? 'payload') && actor.id !== room.commanderId) {
      sendError(sink, 'forbidden', 'Only the Commander assigns roles'); return
    }
    const target = room.players.get(targetId)
    if (!target) { sendError(sink, 'bad_message', 'Unknown player'); return }
    if (role) {
      for (const p of room.players.values()) if (p.id !== targetId && p.role === role) p.role = null
    }
    target.role = role
    if (target.id === room.commanderId && role && role !== 'commander') {
      // Commander seat stays commander role preferably
      target.role = 'commander'
    }
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private claimRole(room: Room, actor: Player, role: Role, sink: SocketSink) {
    if (room.phase !== 'lobby') { sendError(sink, 'phase', 'Roles are locked after the mission starts'); return }
    for (const p of room.players.values()) if (p.id !== actor.id && p.role === role) {
      sendError(sink, 'forbidden', `${roleLabels[role]} is taken`); return
    }
    actor.role = role
    if (actor.id === room.commanderId) actor.role = 'commander'
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private setReady(room: Room, actor: Player, ready: boolean) {
    if (!actor.role && ready) return
    actor.ready = ready
    bump(room)
    broadcast(room)
  }

  private startMission(room: Room, actor: Player, sink: SocketSink) {
    if (room.phase !== 'lobby') { sendError(sink, 'phase', 'Mission already started'); return }
    if (actor.id !== room.commanderId) { sendError(sink, 'forbidden', 'Only the Commander can start'); return }
    if (connectedCount(room) < MIN_PLAYERS) { sendError(sink, 'forbidden', 'Need at least two connected players'); return }
    if (!allConnectedReady(room)) { sendError(sink, 'forbidden', 'Every connected player must be ready'); return }
    const missingRole = [...room.players.values()].some(p => p.connected && !p.role)
    if (missingRole) { sendError(sink, 'forbidden', 'Every connected player needs a role'); return }
    room.phase = 'target'
    clearReady(room)
    bump(room)
    broadcast(room)
  }

    private setTarget(room: Room, actor: Player, targetId: string, sink: SocketSink) {
    if (room.phase !== 'lobby' && room.phase !== 'target') { sendError(sink, 'phase', 'Target already set'); return }
    if (room.phase === 'lobby') room.phase = 'target'
    room.targetId = targetId
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private confirmTarget(room: Room, actor: Player, sink: SocketSink) {
    if (!room.targetId) { sendError(sink, 'bad_message', 'Pick a target first'); return }
    if (room.phase !== 'lobby' && room.phase !== 'target') { sendError(sink, 'phase', 'Already past target'); return }
    room.phase = 'builder'
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private selectField(
    room: Room, actor: Player, field: ConfigField, value: string, baseRevision: number, sink: SocketSink,
  ) {
    if (room.phase !== 'builder' && room.phase !== 'reviews') {
      sendError(sink, 'phase', 'Design is locked'); return
    }
    if (baseRevision !== room.revision) { sendError(sink, 'stale_revision', 'State changed; refresh and retry'); return }
    const role = this.requireRole(actor, sink)
    if (!role) return
    if (!canEditField(field, role, seatedRoles(room))) {
      sendError(sink, 'forbidden', `Your role cannot change ${field}`); return
    }
    if (!(value in CATALOGS[field])) { sendError(sink, 'bad_message', 'Unknown part'); return }
    ;(room.config as unknown as Record<string, string>)[field] = value
    invalidateEvidence(room)
    if (room.phase === 'reviews') room.phase = 'builder'
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private saveAlternative(room: Room, actor: Player, sink: SocketSink) {
    if (room.phase === 'flight' || room.phase === 'voting' || room.phase === 'debrief' || room.phase === 'closed') {
      sendError(sink, 'phase', 'Design is locked'); return
    }
    room.alternative = { ...room.config }
    bump(room)
    broadcast(room)
  }

  private recordTrade(
    room: Room, actor: Player, rationale: 'science' | 'mass' | 'cost' | 'risk', baseRevision: number, sink: SocketSink,
  ) {
    if (baseRevision !== room.revision) { sendError(sink, 'stale_revision', 'State changed'); return }
    const role = this.requireRole(actor, sink)
    if (!role || !canRecordTradeStudy(role)) { sendError(sink, 'forbidden', 'Only the Commander records the trade study'); return }
    if (!room.alternative) room.alternative = { ...STARTER }
    if (hashConfig(room.alternative) === hashConfig(room.config)) {
      sendError(sink, 'bad_message', 'Trade study needs two distinct designs'); return
    }
    const hashB = hashConfig(room.config)
    room.evidence = {
      configHash: hashB,
      acknowledgedWarnings: room.evidence?.acknowledgedWarnings ?? [],
      tradeStudy: {
        configHashA: hashConfig(room.alternative),
        configHashB: hashB,
        chosenConfigHash: hashB,
        rationale,
      },
    }
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private ackWarning(
    room: Room, actor: Player, warningId: WarningId, acknowledged: boolean, baseRevision: number, sink: SocketSink,
  ) {
    if (baseRevision !== room.revision) { sendError(sink, 'stale_revision', 'State changed'); return }
    const role = this.requireRole(actor, sink)
    if (!role || !canAcknowledgeWarnings(role)) { sendError(sink, 'forbidden', 'Only the Commander accepts warnings'); return }
    if (!room.evidence) {
      room.evidence = { configHash: hashConfig(room.config), acknowledgedWarnings: [], tradeStudy: null }
    }
    const set = new Set(room.evidence.acknowledgedWarnings)
    if (acknowledged) set.add(warningId)
    else set.delete(warningId)
    room.evidence = { ...room.evidence, configHash: hashConfig(room.config), acknowledgedWarnings: [...set] as WarningId[] }
    clearReady(room)
    bump(room)
    broadcast(room)
  }

  private advanceReviews(room: Room, actor: Player, sink: SocketSink) {
    if (room.phase !== 'builder') { sendError(sink, 'phase', 'Open reviews from the builder'); return }
    if (!room.evidence) room.evidence = { configHash: hashConfig(room.config), acknowledgedWarnings: [], tradeStudy: null }
    else room.evidence = { ...room.evidence, configHash: hashConfig(room.config) }
    room.phase = 'reviews'
    bump(room)
    broadcast(room)
  }

  private launch(room: Room, actor: Player, baseRevision: number, sink: SocketSink) {
    if (baseRevision !== room.revision) { sendError(sink, 'stale_revision', 'State changed'); return }
    if (room.phase !== 'reviews') { sendError(sink, 'phase', 'Launch from engineering review'); return }
    const role = this.requireRole(actor, sink)
    if (!role || !canLaunch(role) || actor.id !== room.commanderId) {
      sendError(sink, 'forbidden', 'Only the Commander can authorize launch'); return
    }
    if (!reviewsAuthorized(room)) { sendError(sink, 'forbidden', 'Reviews are not authorized yet'); return }
    if (!allConnectedReady(room)) { sendError(sink, 'forbidden', 'Every connected player must be ready'); return }
    if (connectedCount(room) < MIN_PLAYERS) { sendError(sink, 'forbidden', 'Need at least two connected players'); return }
    room.phase = 'flight'
    room.observation = null
    room.downlink = null
    room.result = null
    clearReady(room)
    bump(room)
    broadcast(room)
    openVote(room, 'observe')
  }

  private castVote(
    room: Room, actor: Player, kind: VoteKind, choice: string, baseRevision: number, sink: SocketSink,
  ) {
    if (baseRevision !== room.revision) { sendError(sink, 'stale_revision', 'State changed'); return }
    if (room.phase !== 'voting' || !room.vote || room.vote.kind !== kind || room.vote.resolved) {
      sendError(sink, 'phase', 'No open vote of that kind'); return
    }
    if (this.now() > room.vote.deadlineAt) {
      this.closeVote(room)
      return
    }
    if (!room.vote.options.includes(choice)) { sendError(sink, 'bad_message', 'Invalid choice'); return }
    room.vote.votes.set(actor.id, choice)
    bump(room)
    broadcast(room)
    // Early resolve when all connected have voted
    const connected = [...room.players.values()].filter(p => p.connected)
    if (connected.every(p => room.vote!.votes.has(p.id))) this.closeVote(room)
  }

  private closeVote(room: Room) {
    if (!room.vote || room.vote.resolved) return
    const winner = resolveVote(room)
    if (!winner) return
    if (room.vote.kind === 'observe') {
      room.observation = winner as ObserveAction
      room.vote = null
      bump(room)
      broadcast(room)
      openVote(room, 'downlink')
    } else {
      room.downlink = winner as DownlinkAction
      room.vote = null
      finishSimulation(room)
    }
  }
}

export { publicRoom, roleLabels, STARTER, TIE_RULE }
