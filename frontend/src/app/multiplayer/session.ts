/** Guest multiplayer session only — never mixed with solo `luna01:save:v1`. */
export const mpSessionKey = 'luna01:mp:session:v1'

export type MpSession = {
  sessionToken: string
  playerId: string
  roomCode: string
  nickname: string
}

export function loadMpSession(): MpSession | null {
  try {
    const raw = localStorage.getItem(mpSessionKey)
    if (!raw) return null
    const data = JSON.parse(raw) as MpSession
    if (!data.sessionToken || !data.playerId || !data.roomCode) return null
    return data
  } catch {
    return null
  }
}

export function saveMpSession(session: MpSession) {
  localStorage.setItem(mpSessionKey, JSON.stringify(session))
}

export function clearMpSession() {
  localStorage.removeItem(mpSessionKey)
}

export function invitePath(code: string) {
  return `#/join/${code.toUpperCase()}`
}

export function codeFromLocation(hash = window.location.hash): string | null {
  const match = /^#\/join\/([A-Za-z0-9]+)/i.exec(hash)
  return match ? match[1]!.toUpperCase() : null
}
