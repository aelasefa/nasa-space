# Shared engine integration

The frontend imports the domain engine from `src/domain/index.ts`.
`engine.ts` maps `DEFAULT_MODEL_VERSION` and translates universe comparisons into
the frontend view model. Domain calculations and the HTTP API retain their API.
The production bundle contains no test fixture.

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run test:domain`,
`npm run lint`, and `npm run build`. The real-engine UI demo always runs.
Domain tests compile separately to `dist-domain/`; the UI builds to `dist/`.

Use `npm run dev` or `npm run preview` for the UI. Docker runs the backend API
and domain tests. Deploy `dist/` to a static host for the UI.
