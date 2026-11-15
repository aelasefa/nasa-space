import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RoomRegistry } from '../../src/multiplayer/room'
import type { ServerMessage } from '../../src/multiplayer/contracts'
import { normalizeRoomCode, hashToken } from '../../src/multiplayer/ids'
import { canEditField } from '../../src/multiplayer/permissions'

type Inbox = ServerMessage[]
function mockSink(inbox: Inbox) {
  return {
    send(message: ServerMessage) { inbox.push(message) },
    close() {},
  }
}

function lastRoom(inbox: Inbox) {
  for (let i = inbox.length - 1; i >= 0; i--) {
    const m = inbox[i]!
    if (m.type === 'room') return m.room
  }
  return null
}

function connect(reg: RoomRegistry, ip = '1.1.1.1') {
  const inbox: Inbox = []
  const sink = mockSink(inbox)
  const session = reg.attach(sink, ip)
  session.handle({ type: 'hello', protocolVersion: 1 })
  return { inbox, sink, session }
}

describe('multiplayer rooms', () => {
  it('creates a room with a normalized code and commander', () => {
    const reg = new RoomRegistry()
    const a = connect(reg)
    a.session.handle({ type: 'create_room', nickname: 'Ada' })
    const welcome = a.inbox.find(m => m.type === 'welcome')
    assert.ok(welcome && welcome.type === 'welcome')
    const room = lastRoom(a.inbox)!
    assert.equal(room.players.length, 1)
    assert.equal(room.players[0]!.isCommander, true)
    assert.equal(room.players[0]!.role, 'commander')
    assert.equal(room.code, normalizeRoomCode(room.code))
    assert.equal(room.code.length, 6)
  })

  it('joins by case-insensitive code and enforces capacity 4', () => {
    const reg = new RoomRegistry()
    const host = connect(reg, '10.0.0.1')
    host.session.handle({ type: 'create_room', nickname: 'Host' })
    const code = lastRoom(host.inbox)!.code

    for (let i = 0; i < 3; i++) {
      const c = connect(reg, `10.0.0.${i + 2}`)
      c.session.handle({ type: 'join_room', code: code.toLowerCase(), nickname: `P${i}` })
      assert.ok(c.inbox.some(m => m.type === 'welcome'))
    }
    const full = connect(reg, '10.0.0.9')
    full.session.handle({ type: 'join_room', code, nickname: 'Extra' })
    assert.ok(full.inbox.some(m => m.type === 'error' && m.code === 'room_full'))
  })

  it('rejects invalid codes and bad nicknames', () => {
    const reg = new RoomRegistry()
    const c = connect(reg)
    c.session.handle({ type: 'join_room', code: 'NOPE12', nickname: 'Ada' })
    assert.ok(c.inbox.some(m => m.type === 'error' && m.code === 'invalid_code'))
    const h = connect(reg)
    h.session.handle({ type: 'create_room', nickname: '' })
    assert.ok(h.inbox.some(m => m.type === 'error' && m.code === 'bad_nickname'))
  })

  it('rejects session impersonation: wrong token cannot control a seat', () => {
    const reg = new RoomRegistry()
    const a = connect(reg)
    a.session.handle({ type: 'create_room', nickname: 'Ada' })
    const thief = connect(reg, '2.2.2.2')
    thief.session.handle({ type: 'reconnect', sessionToken: 's_not_a_real_token' })
    assert.ok(thief.inbox.some(m => m.type === 'error' && m.code === 'unauthorized'))
  })

  it('reconnect restores the same player into the room', () => {
    const reg = new RoomRegistry()
    const a = connect(reg)
    a.session.handle({ type: 'create_room', nickname: 'Ada' })
    const token = (a.inbox.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>).sessionToken
    a.session.disconnect()
    const b = connect(reg)
    b.session.handle({ type: 'reconnect', sessionToken: token })
    assert.ok(b.inbox.some(m => m.type === 'welcome'))
    assert.equal(lastRoom(b.inbox)!.players[0]!.nickname, 'Ada')
  })

  it('maps field ownership so two seated roles cover every subsystem', () => {
    const seated = new Set(['commander', 'power'] as const)
    assert.equal(canEditField('powerId', 'power', seated as never), true)
    assert.equal(canEditField('payloadId', 'commander', seated as never), true) // payload empty → commander
    assert.equal(canEditField('propulsionId', 'commander', seated as never), true)
    assert.equal(canEditField('commsId', 'commander', seated as never), true)
    assert.equal(canEditField('trajectoryId', 'commander', seated as never), true)
    assert.equal(canEditField('powerId', 'commander', seated as never), false) // primary seated
  })

  it('propagates design edits to all clients and bumps revision', () => {
    const reg = new RoomRegistry()
    const host = connect(reg, '1.1.1.1')
    host.session.handle({ type: 'create_room', nickname: 'Host' })
    const code = lastRoom(host.inbox)!.code
    const guest = connect(reg, '1.1.1.2')
    guest.session.handle({ type: 'join_room', code, nickname: 'Guest' })
    // guest claims power
    guest.inbox.length = 0
    host.inbox.length = 0
    guest.session.handle({ type: 'claim_role', role: 'power' })
    const rev = lastRoom(guest.inbox)!.revision
    guest.session.handle({ type: 'confirm_target' }) // may fail without target — set target first
    // set target then builder
    host.session.handle({ type: 'set_target', targetId: 'malapert_massif' })
    host.session.handle({ type: 'confirm_target' })
    const before = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'select_field', field: 'powerId', value: 'solar_storage', baseRevision: lastRoom(guest.inbox)!.revision })
    const hostRoom = lastRoom(host.inbox)!
    const guestRoom = lastRoom(guest.inbox)!
    assert.equal(hostRoom.config.powerId, 'solar_storage')
    assert.equal(guestRoom.config.powerId, 'solar_storage')
    assert.ok(hostRoom.revision > before)
  })

  it('forbids unauthorized field edits', () => {
    const reg = new RoomRegistry()
    const host = connect(reg, '1.1.1.1')
    host.session.handle({ type: 'create_room', nickname: 'Host' })
    const code = lastRoom(host.inbox)!.code
    const guest = connect(reg, '1.1.1.2')
    guest.session.handle({ type: 'join_room', code, nickname: 'Guest' })
    guest.session.handle({ type: 'claim_role', role: 'power' })
    host.session.handle({ type: 'set_target', targetId: 'malapert_massif' })
    host.session.handle({ type: 'confirm_target' })
    const rev = lastRoom(guest.inbox)!.revision
    guest.inbox.length = 0
    guest.session.handle({ type: 'select_field', field: 'payloadId', value: 'ice_spectrometer', baseRevision: rev })
    assert.ok(guest.inbox.some(m => m.type === 'error' && m.code === 'forbidden'))
  })
})

describe('multiplayer launch and voting', () => {
  function readyCrew(reg: RoomRegistry) {
    const host = connect(reg, '8.8.8.1')
    host.session.handle({ type: 'create_room', nickname: 'Cmdr' })
    const code = lastRoom(host.inbox)!.code
    const guest = connect(reg, '8.8.8.2')
    guest.session.handle({ type: 'join_room', code, nickname: 'Power' })
    guest.session.handle({ type: 'claim_role', role: 'power' })
    host.session.handle({ type: 'set_target', targetId: 'malapert_massif' })
    host.session.handle({ type: 'confirm_target' })
    // Commander sets ice spectrometer + storage so reviews can pass
    let rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'payloadId', value: 'ice_spectrometer', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'select_field', field: 'powerId', value: 'solar_storage', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'propulsionId', value: 'prop_high', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'commsId', value: 'comms_high', baseRevision: rev })
    // baseline starter vs current
    host.session.handle({ type: 'save_alternative' })
    // Wait - save_alternative saves CURRENT as alternative. Need distinct: save starter first.
    // Reset approach: create sets starter; save_alternative at start; then edit.
    return { host, guest, code }
  }

  it('blocks launch until reviews + readiness; commander launches; votes resolve to shared result', () => {
    const reg = new RoomRegistry()
    const host = connect(reg, '9.9.9.1')
    host.session.handle({ type: 'create_room', nickname: 'Cmdr' })
    const code = lastRoom(host.inbox)!.code
    const guest = connect(reg, '9.9.9.2')
    guest.session.handle({ type: 'join_room', code, nickname: 'Pow' })
    guest.session.handle({ type: 'claim_role', role: 'power' })
    host.session.handle({ type: 'set_target', targetId: 'malapert_massif' })
    host.session.handle({ type: 'confirm_target' })
    let rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'payloadId', value: 'ice_spectrometer', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'select_field', field: 'powerId', value: 'solar_storage', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'propulsionId', value: 'prop_high', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'select_field', field: 'commsId', value: 'comms_high', baseRevision: rev })
    // Re-save alternative? alternative was starter; good. Re-record trade after edits cleared evidence.
    // Need alternative still starter - but save_alternative at start stored starter. Edits don't change alternative. Good.
    // But invalidateEvidence cleared evidence; alternative still starter.
    rev = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'record_trade', rationale: 'science', baseRevision: rev })
    rev = lastRoom(host.inbox)!.revision
    // Acknowledge any warnings
    const warnings = ['battery_endurance', 'delta_v_margin', 'power_margin'] as const
    for (const w of warnings) {
      rev = lastRoom(host.inbox)!.revision
      host.session.handle({ type: 'ack_warning', warningId: w, acknowledged: true, baseRevision: rev })
    }
    host.session.handle({ type: 'advance_reviews' })
    rev = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'set_ready', ready: true })
    host.session.handle({ type: 'set_ready', ready: true })
    // Guest cannot launch
    guest.inbox.length = 0
    guest.session.handle({ type: 'launch', baseRevision: lastRoom(host.inbox)!.revision })
    assert.ok(guest.inbox.some(m => m.type === 'error' && m.code === 'forbidden'))
    // Commander launches
    let r = lastRoom(host.inbox)!.revision
    host.session.handle({ type: 'launch', baseRevision: r })
    let after = lastRoom(host.inbox)!
    assert.equal(after.phase, 'voting', `phase=${after.phase} errors=${JSON.stringify(host.inbox.filter(m => m.type==='error'))}`)
    assert.equal(after.vote!.kind, 'observe')
    r = after.revision
    host.session.handle({ type: 'cast_vote', kind: 'observe', choice: 'observe_full', baseRevision: r })
    r = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'cast_vote', kind: 'observe', choice: 'observe_full', baseRevision: r })
    after = lastRoom(host.inbox)!
    assert.equal(after.vote!.kind, 'downlink')
    r = after.revision
    host.session.handle({ type: 'cast_vote', kind: 'downlink', choice: 'science_first', baseRevision: r })
    r = lastRoom(host.inbox)!.revision
    guest.session.handle({ type: 'cast_vote', kind: 'downlink', choice: 'science_first', baseRevision: r })
    const done = lastRoom(host.inbox)!
    const doneGuest = lastRoom(guest.inbox)!
    assert.equal(done.phase, 'debrief')
    assert.equal(doneGuest.phase, 'debrief')
    assert.ok(done.result)
    assert.deepEqual(done.result, doneGuest.result)
  })

  it('starts mission only when crew of two is ready with roles', () => {
    const reg = new RoomRegistry()
    const host = connect(reg, '9.9.9.1')
    host.session.handle({ type: 'create_room', nickname: 'Cmdr' })
    const code = lastRoom(host.inbox)!.code
    const guest = connect(reg, '9.9.9.2')
    guest.session.handle({ type: 'join_room', code, nickname: 'Pay' })
    guest.session.handle({ type: 'claim_role', role: 'payload' })
    host.inbox.length = 0
    host.session.handle({ type: 'start_mission' })
    assert.ok(host.inbox.some(m => m.type === 'error'))
    host.session.handle({ type: 'set_ready', ready: true })
    guest.session.handle({ type: 'set_ready', ready: true })
    host.inbox.length = 0
    host.session.handle({ type: 'start_mission' })
    assert.equal(lastRoom(host.inbox)!.phase, 'target')
  })
})
