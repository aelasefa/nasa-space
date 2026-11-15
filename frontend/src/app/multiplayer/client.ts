import type { PublicRoom, ServerMessage, ClientMessage } from '../../../../backend/src/multiplayer/contracts'
import { PROTOCOL_VERSION } from '../../../../backend/src/multiplayer/contracts'

export type MpStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

function defaultWsUrl() {
  const env = (import.meta as { env?: { VITE_MP_URL?: string } }).env?.VITE_MP_URL
  if (env) return env
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  const port = (import.meta as { env?: { VITE_MP_PORT?: string } }).env?.VITE_MP_PORT || '3000'
  // Same origin when proxied; otherwise backend port 3000 in local dev.
  if (window.location.port && window.location.port !== '5173' && window.location.port !== '4173') {
    return `${proto}//${window.location.host}/mp`
  }
  return `${proto}//${host}:${port}/mp`
}

export class MultiplayerClient {
  private ws: WebSocket | null = null
  private queue: ClientMessage[] = []
  private reconnectTimer: number | null = null
  private url: string
  status: MpStatus = 'idle'
  room: PublicRoom | null = null
  playerId: string | null = null
  sessionToken: string | null = null
  lastError: string | null = null
  private listeners = new Set<() => void>()

  constructor(url = defaultWsUrl()) {
    this.url = url
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private notify() { for (const fn of this.listeners) fn() }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    this.status = this.sessionToken ? 'reconnecting' : 'connecting'
    this.notify()
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.status = 'connected'
      this.lastError = null
      this.sendNow({ type: 'hello', protocolVersion: PROTOCOL_VERSION })
      if (this.sessionToken) this.sendNow({ type: 'reconnect', sessionToken: this.sessionToken })
      for (const msg of this.queue) this.sendNow(msg)
      this.queue = []
      this.notify()
    }
    ws.onmessage = (event) => {
      try { this.onServer(JSON.parse(String(event.data)) as ServerMessage) }
      catch { this.lastError = 'Bad server message'; this.notify() }
    }
    ws.onclose = () => {
      this.ws = null
      if (this.sessionToken) {
        this.status = 'reconnecting'
        this.notify()
        if (this.reconnectTimer == null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
          }, 1500)
        }
      } else {
        this.status = 'idle'
        this.notify()
      }
    }
    ws.onerror = () => {
      this.lastError = 'Connection failed. Is the backend running on port 3000?'
      this.status = 'error'
      this.notify()
    }
  }

  setSession(token: string | null, playerId: string | null = null) {
    this.sessionToken = token
    this.playerId = playerId
    this.notify()
  }

  disconnect(clearSession = true) {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (clearSession) {
      this.sessionToken = null
      this.playerId = null
      this.room = null
    }
    this.ws?.close()
    this.ws = null
    this.status = 'idle'
    this.notify()
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.sendNow(message)
    else this.queue.push(message)
  }

  private sendNow(message: ClientMessage) {
    this.ws?.send(JSON.stringify(message))
  }

  private onServer(message: ServerMessage) {
    switch (message.type) {
      case 'welcome':
        this.playerId = message.playerId
        this.sessionToken = message.sessionToken
        this.lastError = null
        break
      case 'room':
        this.room = message.room
        this.lastError = null
        break
      case 'error':
        this.lastError = message.message
        break
      case 'kicked':
        this.lastError = message.reason
        this.sessionToken = null
        this.room = null
        break
      case 'pong':
        break
      default: {
        const _exhaustive: never = message
        void _exhaustive
      }
    }
    this.notify()
  }
}
