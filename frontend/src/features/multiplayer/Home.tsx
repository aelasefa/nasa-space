import { useState, type FormEvent } from 'react'
import { ActionBar, ScreenHeader } from '../../components/Screen'

export type MpEntry = { mode: 'create' | 'join'; nickname: string; code?: string }

/** Create or join a guest mission — no accounts. */
export function MultiplayerHome({
  initialCode,
  onSolo,
  onEnter,
  error,
}: {
  initialCode?: string | null
  onSolo: () => void
  onEnter: (entry: MpEntry) => void
  error?: string | null
}) {
  const [mode, setMode] = useState<'pick' | 'create' | 'join'>(initialCode ? 'join' : 'pick')
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState(initialCode ?? '')
  const [invalid, setInvalid] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const name = nickname.trim()
    if (!name || name.length > 16) { setInvalid(true); return }
    if (mode === 'join') {
      const room = code.trim().toUpperCase()
      if (!room) { setInvalid(true); return }
      onEnter({ mode: 'join', nickname: name, code: room })
      return
    }
    if (mode === 'create') onEnter({ mode: 'create', nickname: name })
  }

  if (mode === 'pick') {
    return <section className="panel mp-home">
      <ScreenHeader eyebrow="LUNA‑01 · Crew" title="How do you want to fly?"
        lede="Solo keeps your local draft. Create or join a guest mission to share one orbiter with a crew of 2–4."/>
      <div className="actions">
        <button type="button" className="primary" onClick={onSolo}>Fly solo</button>
        <button type="button" onClick={() => setMode('create')}>Create mission</button>
        <button type="button" onClick={() => setMode('join')}>Join mission</button>
      </div>
    </section>
  }

  return <section className="panel mp-home">
    <ScreenHeader eyebrow="LUNA‑01 · Guest mission"
      title={mode === 'create' ? 'Create a mission' : 'Join a mission'}
      lede={mode === 'create'
        ? 'Pick a nickname. You’ll get a short room code and an invite link to share.'
        : 'Enter the room code from your invite. A guest identity is created on this device.'}/>
    {error && <p className="notice" role="alert">{error}</p>}
    <form className="intro-form" onSubmit={submit} noValidate>
      <label className="intro-callsign">
        <span>Nickname</span>
        <input aria-label="Nickname" placeholder="e.g. Ada" autoComplete="nickname" maxLength={16}
          value={nickname} aria-invalid={invalid || undefined}
          onChange={e => { setNickname(e.target.value); setInvalid(false) }} required/>
      </label>
      {mode === 'join' && <label className="intro-callsign">
        <span>Room code</span>
        <input aria-label="Room code" placeholder="ABC123" autoCapitalize="characters" maxLength={8}
          value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setInvalid(false) }} required/>
      </label>}
      <ActionBar label="Guest mission">
        <button type="button" onClick={() => setMode('pick')}>Back</button>
        <button type="submit" className="primary">{mode === 'create' ? 'Create mission' : 'Join mission'}</button>
      </ActionBar>
    </form>
  </section>
}
