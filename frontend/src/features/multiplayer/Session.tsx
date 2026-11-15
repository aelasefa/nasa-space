import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { createMultiplayerGame } from '../../app/multiplayer/bridge'
import { MultiplayerClient } from '../../app/multiplayer/client'
import { clearMpSession, codeFromLocation, loadMpSession, saveMpSession } from '../../app/multiplayer/session'
import { canEditField, roleLabels, type Role } from '../../../../backend/src/multiplayer/permissions'
import type { ConfigField } from '../../app/contracts'
import { HubLink } from '../../components/Experience'
import { Guide } from '../../components/Guide'
import { RadioProvider, VoiceToggle } from '../../components/Radio'
import { SpaceBackdrop } from '../../space/SpaceBackdrop'
import { Builder } from '../Builder'
import { Debrief } from '../Debrief'
import { Flight } from '../Flight'
import { Multiverse } from '../Multiverse'
import { Review } from '../Review'
import { TargetSelect } from '../TargetSelect'
import { Lobby } from './Lobby'
import { MultiplayerHome, type MpEntry } from './Home'
import { VotePanel } from './Vote'

const phases = {
  briefing: 'Briefing', target: 'Target', builder: 'Build', reviews: 'Review',
  flight: 'Mission control', debrief: 'Debrief', multiverse: 'Multiverse',
}
const phaseOrder = Object.keys(phases)

function CrewStrip({ client }: { client: MultiplayerClient }) {
  const room = client.room
  if (!room || room.phase === 'lobby') return null
  const you = room.players.find(p => p.id === client.playerId)
  return <aside className="panel crew-strip" aria-label="Crew status">
    <ul className="crew-list">{room.players.map(p => <li key={p.id}>
      <strong>{p.nickname}{p.id === client.playerId ? ' (you)' : ''}</strong>
      <span>{p.role ? roleLabels[p.role] : '—'}</span>
      <span className="tag" data-passed={p.connected || undefined}>{p.connected ? 'On' : 'Off'}</span>
      {(room.phase === 'reviews' || room.phase === 'builder') &&
        <span className="tag" data-passed={p.ready || undefined}>{p.ready ? 'Ready' : 'Not ready'}</span>}
    </li>)}</ul>
    {(room.phase === 'reviews' || room.phase === 'builder') && you &&
      <button type="button" className="quiet" onClick={() => client.send({ type: 'set_ready', ready: !you.ready })}>
        {you.ready ? 'Unready' : 'Ready for launch'}
      </button>}
    {room.fieldOwners && room.phase === 'builder' && <p className="fine">
      Field owners: {Object.entries(room.fieldOwners).map(([f, r]) => `${f.replace(/Id$/, '')}→${r}`).join(' · ')}
    </p>}
  </aside>
}

export function MultiplayerSession({ onHub }: { onHub: () => void }) {
  const client = useMemo(() => new MultiplayerClient(), [])
  const game = useMemo(() => createMultiplayerGame(client), [client])
  const { save, message, playback } = useStore(game.store)
  const [, tick] = useState(0)
  useEffect(() => client.subscribe(() => tick(n => n + 1)), [client])
  // Going back to the hub keeps the guest session on this device; only the socket closes.
  useEffect(() => () => client.disconnect(false), [client])

  const [nickname, setNickname] = useState(() => loadMpSession()?.nickname ?? '')
  const [entered, setEntered] = useState(false)
  const [guide, setGuide] = useState(false)
  const [builderStep, setBuilderStep] = useState(0)
  const [rationale, setRationale] = useState<'' | 'science' | 'mass' | 'cost' | 'risk'>('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const inviteCode = codeFromLocation()
  const openStep = useCallback((step: number) => { setBuilderStep(step) }, [])

  // Auto-reconnect saved guest session
  useEffect(() => {
    const session = loadMpSession()
    if (!session) return
    setNickname(session.nickname)
    client.setSession(session.sessionToken, session.playerId)
    client.connect()
    setEntered(true)
  }, [client])

  function enter(entry: MpEntry) {
    setNickname(entry.nickname)
    clearMpSession()
    client.setSession(null)
    client.connect()
    setEntered(true)
    if (entry.mode === 'create') client.send({ type: 'create_room', nickname: entry.nickname })
    else client.send({ type: 'join_room', code: entry.code!, nickname: entry.nickname })
  }

  function leave() {
    client.send({ type: 'leave' })
    clearMpSession()
    client.disconnect(true)
    setEntered(false)
    setConfirmLeave(false)
    if (window.location.hash.startsWith('#/join/')) history.replaceState(null, '', `${window.location.pathname}#/crew`)
  }

  useEffect(() => {
    if (client.sessionToken && client.playerId && client.room) {
      saveMpSession({
        sessionToken: client.sessionToken,
        playerId: client.playerId,
        roomCode: client.room.code,
        nickname,
      })
    }
  }, [client.sessionToken, client.playerId, client.room, nickname])

  const room = client.room
  const phase = save.phase === 'multiverse' ? 'multiverse'
    : playback ? 'flight'
    : room?.phase === 'voting' || room?.phase === 'flight' ? 'flight'
    : save.phase
  const root = save.collection?.universes[0]

  if (!entered) {
    return <>
      <SpaceBackdrop mode="intro"/>
      <main className="intro" tabIndex={-1}>
        <MultiplayerHome initialCode={inviteCode} onHub={onHub} onEnter={enter} error={client.lastError}/>
      </main>
    </>
  }

  if (!room || room.phase === 'lobby') {
    return <>
      <SpaceBackdrop mode="app"/>
      <main className="shell" tabIndex={-1} style={{ padding: '1.25rem' }}>
        <Lobby client={client} nickname={nickname} onHub={() => { leave(); onHub() }} onLeave={leave}/>
      </main>
    </>
  }

  return <RadioProvider>
    <SpaceBackdrop mode={phase === 'target' ? 'target' : 'app'}/>
    <div className="shell">
      <header className="topbar">
        <div className="topbar-home"><HubLink href="#/hub" onNavigate={onHub}/>
          <div className="wordmark"><span aria-hidden>◒</span> LUNA–01 · Crew {room.code}</div></div>
        <ol className="progress" aria-label="Mission progress">{Object.entries(phases).map(([key, name], index) =>
          <li key={key} aria-current={phase === key ? 'step' : undefined}
            data-done={index < phaseOrder.indexOf(phase) || undefined}>{name}</li>)}</ol>
        <div className="topbar-actions">
          <span className="tag" data-passed={client.status === 'connected' || undefined}>
            {client.status === 'connected' ? 'Live' : client.status === 'reconnecting' ? 'Reconnecting…' : client.status}
          </span>
          <button className="quiet" onClick={() => setGuide(true)} aria-haspopup="dialog">How to play</button>
          <VoiceToggle/>
          <button className="quiet" onClick={() => setConfirmLeave(true)}>Leave</button>
        </div>
      </header>
      {guide && <Guide close={() => setGuide(false)}/>}
      <main tabIndex={-1}>
        {confirmLeave && <section className="panel notice" aria-label="Leave mission">
          <h2>Leave this mission?</h2>
          <p>Your seat frees after the reconnect grace if you don’t come back.</p>
          <div className="actions">
            <button type="button" onClick={() => setConfirmLeave(false)}>Stay</button>
            <button type="button" onClick={leave}>Leave mission</button>
          </div>
        </section>}
        {(message || client.lastError) && <p className="notice" role="status">{message || client.lastError}</p>}
        <CrewStrip client={client}/>
        {room.phase === 'target' && <TargetSelect game={game} save={save} callSign={nickname}/>}
        {room.phase === 'builder' && <Builder game={game} save={save} step={builderStep} onStep={setBuilderStep}
          canEdit={(field: ConfigField) => {
            const role = room.you?.role
            if (!role) return false
            const seated = new Set(room.players.map(p => p.role).filter(Boolean) as Role[])
            return canEditField(field, role, seated)
          }}/>}
        {room.phase === 'reviews' && <Review game={game} save={save} openStep={openStep} rationale={rationale} onRationale={setRationale}/>}
        {(room.phase === 'flight' || room.phase === 'voting') && <>
          {room.vote && <VotePanel client={client} room={room}/>}
          <Flight game={game} save={save} callSign={nickname} universe={playback && root ? root : undefined}/>
        </>}
        {room.phase === 'debrief' && save.phase === 'multiverse' && save.collection &&
          <Multiverse game={game} collection={save.collection}/>}
        {room.phase === 'debrief' && save.phase !== 'multiverse' && root && save.collection &&
          <Debrief game={game} universe={root} collection={save.collection} targetId={save.targetId} callSign={nickname}/>}
      </main>
      <footer>Educational model · Shared guest mission · Rooms are in-memory on one backend instance.</footer>
    </div>
  </RadioProvider>
}
