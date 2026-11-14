# Shared engine integration

The frontend imports the domain engine from `backend/src/domain/index.ts`.
`engine.ts` maps `DEFAULT_MODEL_VERSION` and translates universe comparisons into
the frontend view model. Domain calculations and the HTTP API retain their API.
The production bundle contains no test fixture.

From `frontend/`, run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`
and `npm run build`. The real-engine UI demo always runs. Use `npm run dev` or
`npm run preview` for the UI, and deploy `frontend/dist/` to a static host.

From `backend/`, run `npm ci` and `npm test` for the domain tests, or use
`./run.sh` at the repository root to run the HTTP API and tests in Docker.
