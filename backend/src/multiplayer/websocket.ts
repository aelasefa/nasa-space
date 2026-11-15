/**
 * Minimal text WebSocket helper (RFC 6455) — no external runtime dependency.
 * Supports text frames only; adequate for LUNA-01 multiplayer JSON messages.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export function acceptKey(secWebSocketKey: string): string {
  return createHash('sha1').update(secWebSocketKey + GUID).digest('base64')
}

export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  const upgrade = (req.headers.upgrade || '').toLowerCase()
  const connection = (req.headers.connection || '').toLowerCase()
  return upgrade === 'websocket' && connection.includes('upgrade') && Boolean(req.headers['sec-websocket-key'])
}

export type TextSocket = {
  send(text: string): void
  close(code?: number, reason?: string): void
  onMessage(handler: (text: string) => void): void
  onClose(handler: () => void): void
}

export function attachWebSocket(req: IncomingMessage, socket: Duplex, head: Buffer): TextSocket {
  const key = req.headers['sec-websocket-key']
  if (typeof key !== 'string') {
    socket.destroy()
    throw new Error('Missing Sec-WebSocket-Key')
  }
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '\r\n',
  ]
  socket.write(headers.join('\r\n'))
  if (head.length) socket.unshift(head)

  let closed = false
  const messageHandlers: Array<(text: string) => void> = []
  const closeHandlers: Array<() => void> = []
  let buffer: Buffer = Buffer.alloc(0)

  const emitClose = () => {
    if (closed) return
    closed = true
    for (const h of closeHandlers) h()
  }

  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]) as Buffer
    while (true) {
      const parsed = readFrame(buffer)
      if (!parsed) break
      buffer = parsed.rest
      if (parsed.opcode === 0x8) { // close
        socket.write(encodeFrame(Buffer.alloc(0), 0x8))
        socket.end()
        emitClose()
        return
      }
      if (parsed.opcode === 0x9) { // ping
        socket.write(encodeFrame(parsed.payload, 0xA))
        continue
      }
      if (parsed.opcode === 0x1) {
        const text = parsed.payload.toString('utf8')
        for (const h of messageHandlers) h(text)
      }
    }
  })
  socket.on('close', emitClose)
  socket.on('error', emitClose)

  return {
    send(text: string) {
      if (closed) return
      socket.write(encodeFrame(Buffer.from(text, 'utf8'), 0x1))
    },
    close(code = 1000, reason = '') {
      if (closed) return
      const reasonBuf = Buffer.from(reason.slice(0, 120), 'utf8')
      const body = Buffer.alloc(2 + reasonBuf.length)
      body.writeUInt16BE(code, 0)
      reasonBuf.copy(body, 2)
      try { socket.write(encodeFrame(body, 0x8)) } catch { /* ignore */ }
      socket.end()
      emitClose()
    },
    onMessage(handler) { messageHandlers.push(handler) },
    onClose(handler) { closeHandlers.push(handler) },
  }
}

function readFrame(buf: Buffer): null | { opcode: number; payload: Buffer; rest: Buffer } {
  if (buf.length < 2) return null
  const b0 = buf[0]!
  const b1 = buf[1]!
  const opcode = b0 & 0x0f
  const masked = (b1 & 0x80) !== 0
  let len = b1 & 0x7f
  let offset = 2
  if (len === 126) {
    if (buf.length < 4) return null
    len = buf.readUInt16BE(2)
    offset = 4
  } else if (len === 127) {
    if (buf.length < 10) return null
    const big = buf.readUInt32BE(2)
    if (big !== 0) return null // reject huge frames
    len = buf.readUInt32BE(6)
    offset = 10
  }
  const maskLen = masked ? 4 : 0
  if (buf.length < offset + maskLen + len) return null
  let payload = buf.subarray(offset + maskLen, offset + maskLen + len)
  if (masked) {
    const mask = buf.subarray(offset, offset + 4)
    payload = Buffer.from(payload)
    for (let i = 0; i < payload.length; i++) payload[i]! ^= mask[i % 4]!
  }
  return { opcode, payload, rest: buf.subarray(offset + maskLen + len) }
}

function encodeFrame(payload: Buffer, opcode: number): Buffer {
  const len = payload.length
  let header: Buffer
  if (len < 126) {
    header = Buffer.alloc(2)
    header[0] = 0x80 | opcode
    header[1] = len
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | opcode
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | opcode
    header[1] = 127
    header.writeUInt32BE(0, 2)
    header.writeUInt32BE(len, 6)
  }
  return Buffer.concat([header, payload])
}

/** Test helper: build a masked client frame */
export function encodeClientText(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = randomBytes(4)
  const len = payload.length
  let header: Buffer
  if (len < 126) {
    header = Buffer.alloc(2)
    header[0] = 0x81
    header[1] = 0x80 | len
  } else {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(len, 2)
  }
  const masked = Buffer.from(payload)
  for (let i = 0; i < masked.length; i++) masked[i]! ^= mask[i % 4]!
  return Buffer.concat([header, mask, masked])
}
