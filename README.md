# LUNA-01

Educational lunar south-pole orbiter mission game. All mission numbers are
illustrative, not NASA/GMAT-validated data.

| Folder | What it holds | Commands (run inside the folder) |
|---|---|---|
| `frontend/` | React + Vite UI, UI tests | `npm ci`, `npm run dev`, `npm test`, `npm run build` |
| `backend/` | Simulation engine (`src/domain`, `src/data`), HTTP API (`src/server.ts`), engine tests, Dockerfile | `npm ci`, `npm test`, `npm start` |

The UI imports the engine directly from `backend/src/domain`, so both halves run
the same calculations.

Run these commands from the repository root (Docker Compose v2 is required):

```bash
./run.sh up    # Build and start the frontend and backend; wait for health checks
./run.sh test  # Run backend/domain tests and frontend tests, typecheck, and lint
./run.sh logs  # Follow both services' logs
./run.sh down  # Stop both services without deleting volumes
```

Open the frontend at http://localhost:8080. The backend API is available at
http://localhost:3000, and `/api/` on the frontend proxies to the backend.
The UI also imports the shared domain engine directly for mission calculations.
Set `FRONTEND_PORT` (in your environment or a root `.env`) to change the UI port.

`frontend/Dockerfile` uses the repository root as its build context because the
UI needs `backend/src/`. Its production image serves static files with Nginx as
a non-root user. The optional `frontend-tests` Compose service runs only with
the `test` profile. Docker build contexts exclude local dependencies, generated
output, Git metadata, and environment files.

Product and engineering specs live at the root: `PRODUCT.md`, `ARCHITECTURE.md`,
`DOMAIN_CONTRACTS.md`, `GAME_RULES.md`, `TASKS.md`, `DEMO_SCRIPT.md`.
