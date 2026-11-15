import { createHash, randomBytes } from 'node:crypto'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export function newPlayerId(): string {
  return `p_${randomBytes(8).toString('hex')}`
}

export function newSessionToken(): string {
  return `s_${randomBytes(24).toString('base64url')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Short invite code: 6 chars, case-insensitive. */
export function newRoomCode(): string {
  const buf = randomBytes(6)
  let out = ''
  for (let i = 0; i < 6; i++) out += ROOM_ALPHABET[buf[i]! % ROOM_ALPHABET.length]
  return out
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function newRoomId(): string {
  return `r_${randomBytes(10).toString('hex')}`
}
