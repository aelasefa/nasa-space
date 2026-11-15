# LUNA-01 multiplayer

Guest co-op for 2–4 players. No accounts. Solo mode is unchanged.

## Transport

**WebSocket** on the existing Node `http` server (hand-rolled RFC 6455 text frames — no `ws` package), same port as `/health` at path `/mp`.

Why: one process/port for Docker and reverse proxies; typed JSON messages; fits the current zero-framework backend with no new runtime dependencies. Rooms are **in-memory only** — they do **not** survive backend restarts, and this deployment targets a **single** backend instance (no sticky-session cluster).

## Player flow

1. Briefing offers **Fly solo**, **Create or join mission**.
2. Create → nickname → room code + invite link (`#/join/CODE`).
3. Join → nickname + code (or invite link). Guest session token stored locally for reconnect (`luna01:mp:session:v1`).
4. Lobby: crew, roles, connection, ready. Roles: Commander, Payload Engineer, Power Engineer, Flight Director.
5. Commander starts when ≥2 connected players are ready with roles → shared target → builder → reviews → flight.
6. Launch: CML authorized + all connected ready; **Commander only**.
7. Flight decisions: team vote with deadline; ties → **Commander vote**, else **first cast among tied options** (server timestamp order).
8. Shared result/debrief. Multiverse after debrief is **local-only** from the shared root snapshot (does not sync or weaken one-change rules).

## Field ownership

| Field | Primary role | If that role is empty |
|---|---|---|
| `payloadId` | Payload Engineer | Commander |
| `powerId` | Power Engineer | Commander |
| `propulsionId` | Flight Director | Commander |
| `commsId` | Flight Director | Payload Engineer → Commander |
| `trajectoryId` | Commander | Flight Director |
| Trade study / warnings ack | Commander | — |
| Launch | Commander | — |
| Observe / downlink | All vote | — |

## Security

- Opaque `sessionToken` (unguessable). Room code is an invite, not proof of identity.
- Server assigns roles, runs simulation, scores. Clients never submit results/roles/identities as truth.
- Messages validated at runtime. State uses monotonic `revision`. Stale edits rejected.
- Credentials never in invite URLs, public snapshots, or logs.

## Lifecycle

- Capacity 2–4. Duplicate live connection for same session → newer wins (old closed).
- Disconnect: grace **90s** for reconnect; then seat freed. If Commander leaves permanently → oldest remaining connected player becomes Commander.
- Idle rooms (no connected players) cleaned after **10 minutes**. Empty after create never joined: **15 minutes**.
- Vote deadline: **45s** from vote open (server clock).

## Local development

```bash
# terminal 1 — backend (WebSocket on :3000/mp)
cd backend && npm start

# terminal 2 — frontend
cd frontend && npm run dev
```

Optional: `VITE_MP_URL=ws://localhost:3000/mp` for the frontend.

## Acceptance criteria

See message requirements 1–15 and testing list. Solo saves use `luna01:save:v1`; multiplayer session uses `luna01:mp:session:v1` only.
