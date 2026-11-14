# LUNA-01

Educational lunar south-pole orbiter mission game. All mission numbers are
illustrative, not NASA/GMAT-validated data.

| Folder | What it holds | Commands (run inside the folder) |
|---|---|---|
| `frontend/` | React + Vite UI, UI tests | `npm ci`, `npm run dev`, `npm test`, `npm run build` |
| `backend/` | Simulation engine (`src/domain`, `src/data`), HTTP API (`src/server.ts`), engine tests, Dockerfile | `npm ci`, `npm test`, `npm start` |

The UI imports the engine directly from `backend/src/domain`, so both halves run
the same calculations. `./run.sh` at the root builds and starts the backend API
in Docker (`docker-compose.yml`) and serves it on port 3000.

Product and engineering specs live at the root: `PRODUCT.md`, `ARCHITECTURE.md`,
`DOMAIN_CONTRACTS.md`, `GAME_RULES.md`, `TASKS.md`, `DEMO_SCRIPT.md`.
