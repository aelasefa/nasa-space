# Shared engine handoff

The frontend discovers the optional engine at `frontend/src/domain/index.ts`. Once the
shared checkout is available, place these frontend-owned files alongside the
engine and expose the functions listed in `engine.ts` on its public entry point.
Export the authoritative model version as `modelVersion`, or map the engine's
existing version export in the frontend adapter. The production bundle contains
no test fixture and launch is locked while the shared engine is unavailable.

The specifications leave the comparison property names open. The frontend
expects the `UniverseComparison` shape in `contracts.ts`. If the domain agent
chooses a different shape, translate it in `engine.ts` using the engine's returned
values. Deltas represent the second universe minus the first. Event changes are
keyed by `arrival`, `E1` or `E2` and carry both resolved event snapshots.

From `frontend/`, run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`. The real-engine
demo test activates when the required public exports are visible. Run `npm run
preview` to repeat the judge flow in a browser. Deploy the contents of `dist/`
to a static host after the real-engine demo passes.
