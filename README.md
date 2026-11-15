# Amanar

Educational lunar south-pole exploration game. Its main mission, LUNA-01, is an
orbiter mission game. All mission numbers are
illustrative, not NASA/GMAT-validated data.

The entry page, the Amanar mission hub, launches three experiences: the LUNA-01 Orbiter (solo or
with a crew), the Lunar Rover (`/rover/`) and the Training Academy (`/academy/`).
Details and sources: `docs/EXPERIENCES.md`.

| Folder | What it holds | Commands (run inside the folder) |
|---|---|---|
| `frontend/` | React + Vite UI, UI tests | `npm ci`, `npm run dev`, `npm test`, `npm run build` |
| `backend/` | Simulation engine (`src/domain`, `src/data`), HTTP API (`src/server.ts`), engine tests, Dockerfile | `npm ci`, `npm test`, `npm start` |

The UI imports the engine directly from `backend/src/domain`, so both halves run
the same calculations. `./run.sh` at the root builds and starts the backend API
in Docker (`docker-compose.yml`) and serves it on port 3000.

Product and engineering specs live at the root: `PRODUCT.md`, `ARCHITECTURE.md`,
`DOMAIN_CONTRACTS.md`, `GAME_RULES.md`, `TASKS.md`, `DEMO_SCRIPT.md`.


## Multiplayer (guest co-op)

No accounts. Choose “Fly with a crew” on the hub to create or join a mission. The backend serves
WebSocket rooms at `ws://localhost:3000/mp` (in-memory, single instance — rooms do
not survive restarts). Details: `docs/MULTIPLAYER.md`.

```bash
# terminal 1
cd backend && npm start
# terminal 2
cd frontend && npm run dev
```
