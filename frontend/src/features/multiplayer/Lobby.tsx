import { useEffect, useState } from 'react'
import type { MultiplayerClient } from '../../app/multiplayer/client'
import { clearMpSession, invitePath, saveMpSession } from '../../app/multiplayer/session'
import { roleLabels, ROLES, type Role } from '../../../../backend/src/multiplayer/permissions'
import { ActionBar, OptionCard, ScreenHeader } from '../../components/Screen'

export function Lobby({
  client,
  nickname,
  onHub,
  onLeave,
}: {
  client: MultiplayerClient
  nickname: string
  onHub: () => void
  onLeave: () => void
}) {
  const [, tick] = useState(0)
  useEffect(() => client.subscribe(() => tick(n => n + 1)), [client])
  const room = client.room
  const you = room?.players.find(p => p.id === client.playerId)

  useEffect(() => {
    if (client.sessionToken && client.playerId && room) {
      saveMpSession({
        sessionToken: client.sessionToken,
        playerId: client.playerId,
        roomCode: room.code,
        nickname,
      })
    }
  }, [client.sessionToken, client.playerId, room, nickname])

  if (!room) {
    return <section className="panel">
      <ScreenHeader eyebrow="LUNA‑01 · Multiplayer" title="Connecting…"
        lede={client.lastError ?? (client.status === 'reconnecting'
          ? 'Reconnecting with your guest session…'
          : 'Opening a guest session with Mission Control.')}/>
      <ActionBar label="Connection">
        <button type="button" onClick={onLeave}>Cancel</button>
        <button type="button" className="quiet" onClick={onHub}>Back to mission hub</button>
      </ActionBar>
    </section>
  }

  const invite = `${window.location.origin}${window.location.pathname}${invitePath(room.code)}`
  const seated = new Set(room.players.map(p => p.role).filter(Boolean) as Role[])
  const connected = room.players.filter(p => p.connected)
  const canStart = you?.isCommander
    && connected.length >= 2
    && connected.every(p => p.ready)
    && Boolean(you.role)

  return <section className="lobby">
    <ScreenHeader eyebrow="LUNA‑01 · Crew lobby" title="Assemble the crew"
      lede="Share the code or invite link. Everyone picks a role, then the Commander starts when the team is ready."
      aside={<p className="tag">Code <strong>{room.code}</strong></p>}/>

    {client.lastError && <p className="notice" role="alert">{client.lastError}</p>}
    {client.status === 'reconnecting' && <p className="notice" role="status">Connection dropped — reconnecting…</p>}

    <div className="grid-two">
      <section className="panel" aria-labelledby="invite-title">
        <h2 id="invite-title">Invite</h2>
        <p className="fine">Room codes are invitations, not passwords. Guest identity stays on this device.</p>
        <p><label className="control">Invite link
          <input readOnly value={invite} onFocus={e => e.currentTarget.select()} aria-label="Invite link"/>
        </label></p>
        <button type="button" className="quiet" onClick={() => void navigator.clipboard?.writeText(invite)}>
          Copy invite link
        </button>
      </section>

      <section className="panel" aria-labelledby="crew-title">
        <div className="spread"><h2 id="crew-title">Crew</h2><span className="tag">{room.players.length} / 4</span></div>
        <ul className="crew-list">{room.players.map(p => <li key={p.id}>
          <strong>{p.nickname}{p.id === client.playerId ? ' (you)' : ''}</strong>
          <span>{p.role ? roleLabels[p.role] : 'No role'}{p.isCommander ? ' · Commander' : ''}</span>
          <span className="tag" data-passed={p.connected || undefined}>{p.connected ? 'Connected' : 'Reconnecting…'}</span>
          <span className="tag" data-passed={p.ready || undefined}>{p.ready ? 'Ready' : 'Not ready'}</span>
        </li>)}</ul>
      </section>
    </div>

    <section className="panel" aria-labelledby="roles-title">
      <h2 id="roles-title">Your role</h2>
      <p className="fine">Empty seats fall back to the Commander so a crew of two can still operate every subsystem.</p>
      <fieldset className="option-group option-row">
        <legend className="sr-only">Claim a role</legend>
        {ROLES.map(role => {
          const taken = seated.has(role) && you?.role !== role
          return <OptionCard key={role} name="mp-role" id={role} title={roleLabels[role]}
            checked={you?.role === role} disabled={taken}
            onChange={() => client.send({ type: 'claim_role', role })}
            tag={taken ? 'Taken' : you?.role === role ? 'Yours' : undefined}>
            {role === 'commander' && <p>Launch authority, trade study, warning acceptance, trajectory.</p>}
            {role === 'payload' && <p>Scientific instrument.</p>}
            {role === 'power' && <p>Solar panels and battery.</p>}
            {role === 'flight' && <p>Propulsion, route assist, communications.</p>}
          </OptionCard>
        })}
      </fieldset>
    </section>

    <ActionBar label="Lobby" status={
      connected.length < 2 ? 'Waiting for at least one more player.'
        : !you?.role ? 'Claim a role, then ready up.'
        : you.ready ? (you.isCommander ? 'Start when everyone is ready.' : 'Waiting for the Commander.')
        : 'Ready up when your role is set.'
    }>
      <button type="button" onClick={() => { client.send({ type: 'leave' }); clearMpSession(); onLeave() }}>
        Leave mission
      </button>
      <button type="button" className="quiet" disabled={!you?.role}
        onClick={() => client.send({ type: 'set_ready', ready: !you?.ready })}>
        {you?.ready ? 'Unready' : 'Ready'}
      </button>
      {you?.isCommander && <button type="button" className="primary" disabled={!canStart}
        onClick={() => client.send({ type: 'start_mission' })}>
        Start mission
      </button>}
    </ActionBar>
  </section>
}
