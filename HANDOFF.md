# LUNA-01 handoff: gamified builder (work in progress)

**Continuation status:** The assembly stepper, craft preview, radio, and v0.1 mission
integration described below are now implemented. The “Broken right now” and “Next
steps” sections describe the original handoff snapshot. The expanded catalog and
additional deterministic events are specified in [the v0.2 proposal](docs/ENGINE_V0_2_PROPOSAL.md)
and await engine implementation. The v0.1 backend and its game rules were unchanged.

**Update 2026-11-15 (unified console pass, uncommitted):** the app compiles and all 34
tests pass. Six builder steps (Structure, Science, Power, Propulsion, Comms, Protection;
Solar and Battery merged into Power). The review is now its own screen
(`features/Review.tsx`) with starter-vs-current charts (`components/TradeCharts.tsx`), and
blockers link back to their step. Mission Control plays shadow-pass beats rebuilt from the
E1 metrics (`app/flight.ts`). The debrief (`features/Debrief.tsx`) explains a one-change
replay from both runs (`app/replay.ts`). Shared primitives live in `components/Screen.tsx`.
Still engine-pending: v0.2 events and decision branches, and any target-specific effects.
In this version the region is story-only. Sections below are the 2026-11-14 snapshot.

Written 2026-11-14, mid-task. `main` at `9f6c8ed` is the last good, pushed state.
**The working tree is uncommitted and does not compile right now** (see "Broken right now").
General frontend notes (layout, commands, rules, code map) are in `frontend/HANDOFF.md`;
that file predates Phase 2 and the target-selection step, so trust the code over it.

## The task

Brief: turn the spacecraft configuration form into a guided, gamified assembly stepper
with a stylized 3D spacecraft, a three-person Mission Control radio, and a richer event
library. Priorities in order: stepper → catalog → 3D craft → real simulation integration
→ events → radio/visual events → multiverse/scoring → polish.

**Scope decision (made by the user):** "Frontend now, engine spec."

- Build everything that works on today's engine (v0.1.0, `backend/src/domain`).
- Do NOT edit `backend/` or `GAME_RULES.md`. The engine has 5 real choices (payload,
  power, propulsion, comms, trajectory; 2 options each) and 3 events (arrival, E1, E2).
- Extra components and events go into a written engine v0.2 proposal with typed
  contracts. Nothing unsimulated may be selectable. No invented numbers.

## Design decisions already made

- **Seven steps over five real choices** (`frontend/src/missions/luna01.ts`):
  1. Structure: fixed body, informational (engine constants: 120 kg, 30 W).
  2. Solar: selects `powerId`.
  3. Battery: also `powerId` (the engine sells panels + battery as one package; the
     step says so) and shows shadow-pass energy from `engine.resolveObservation`.
  4. Propulsion and route: `propulsionId` + `trajectoryId`.
  5. Comms: `commsId`.
  6. Science: `payloadId`.
  7. Protection and control: fixed, labelled "not simulated in engine v0.1".
  Then a final "review design" page (not one of the seven).
- **Config-driven:** steps, option text, specs, crew and the config → 3D mapping live in a
  `MissionDefinition` (`frontend/src/missions/types.ts`). The stepper must take the
  mission as data and must not hardcode seven steps or lunar parts.
- **Specs** come only from the engine catalog (`catalog` export in `app/engine.ts`),
  labelled illustrative. Real-world examples are general statements with NASA links;
  every URL in `luna01.ts` was checked to return 200.
- **Trade study friction removed:** new `game.baselineStarter()` sets the starter design
  as the comparison baseline when none exists. The final page should show the
  comparison (`DesignComparison`), a rationale select and "Record decision"
  (`game.trade` already works in the builder phase), then "Open engineering review".
- **Crew:** Flight Director Reyes, Dr. Chen (science lead, replaces "Dr. Noor Haddad"),
  Amina (systems engineer). `ScienceLead` now renders a `Transmission` from Chen.
- **Radio:** captions always visible in place; voice is optional, off by default, uses
  the browser's speech synthesis, toggled by `VoiceToggle`. Dialogue is fiction.

## Done in the working tree (uncommitted)

| File | State |
|---|---|
| `frontend/src/missions/types.ts` | Done. Mission definition types. |
| `frontend/src/missions/luna01.ts` | Done. 7 steps, option what/trade-off text, specs, crew, `design()` mapping, per-step radio lines. |
| `frontend/src/craft/Spacecraft.tsx` | Written, **never rendered or tested**. R3F low-poly craft: slot registry (bus, solar, battery, propulsion, antenna, instrument), pop-in animation on variant change, focus ring, effects `shadow` / `scanning` / `downlink`. |
| `frontend/src/craft/CraftView.tsx` | Done. Lazy wrapper with a text fallback when there is no WebGL. |
| `frontend/src/components/Radio.tsx` | Written, untested. `RadioProvider`, `VoiceToggle`, `Transmission`. |
| `frontend/src/components/ScienceLead.tsx` | Now a wrapper around `Transmission` (Chen). Children must be a string. |
| `frontend/src/app/engine.ts` | Added `catalog` export. |
| `frontend/src/app/controller.ts` | Added `baselineStarter()`. |
| `frontend/src/app/story.ts` | Removed the old `scienceLead` constant. |
| `frontend/src/features/Design.tsx` | Old `Builder` removed; `WeatherPlanner` exported; `Review` kept. |
| `frontend/src/features/ShadowTradeoff.tsx` | Deleted (its content moves into the battery step). |

## Broken right now

- `App.tsx` imports `Builder` from `./features/Design`, which no longer exports it.
- `Design.tsx` still imports `./ShadowTradeoff` (deleted) plus now-unused imports.
- Tests that drive the old builder will fail until rewritten (see below).

To get back to a working app without finishing: `git stash -u` (or `git checkout . &&
git clean -fd frontend/src/craft frontend/src/missions frontend/src/components/Radio.tsx`).

## Next steps

1. **Write `frontend/src/features/Builder.tsx`** (the stepper) and import it in `App.tsx`.
   - Props `{ game, save, mission = luna01 }`. Keep `<h1>Spacecraft builder</h1>` and the
     target name with its "Change" button (`game.retarget`).
   - Progress indicator: `<ol>` of step buttons with `aria-current="step"`, plus the final
     review page. Start on the review page when `save.evidence?.tradeStudy` exists
     (returning from the review), else step 1.
   - Left: `CraftView` with `design={mission.design(save.config)}` and
     `focus={step.focus}`, plus a HUD from `engine.computeResources` and `limits`
     (budget, mass, battery, fuel margin).
   - Right: step card with "What is it?" / "Why do I need it?", option cards as real
     radio inputs named by the option label (tests use `getByRole('radio', { name })`),
     specs from `mission.specs`, trade-off text, engine findings whose `sourceField` is
     in the step's fields, a "Learn why" `<details>` (principle, sourced examples,
     model assumptions), the step's radio line, Back / Continue.
   - Battery step: per option, energy available / needed / survey coverage, as the
     deleted `ShadowTradeoff` did (see `git show HEAD:frontend/src/features/ShadowTradeoff.tsx`).
   - Call `game.baselineStarter()` in an effect when the engine exists and there is no
     baseline. Without an engine (`game.engine` undefined) the builder must still render
     using `estimateResources`, with "Open engineering review" disabled (a test checks this).
   - Final page: chosen parts with "Change" links, feasibility tag and `Findings`,
     trade study, "Open engineering review", and a `<details>` with `MissionRehearsal`
     and `WeatherPlanner`.
2. **Clean up `Design.tsx` imports.** Wrap the app in `RadioProvider` and add
   `VoiceToggle` to the top bar. Use `Transmission` with Reyes for the target-screen
   radio and for decision requests in `Flight.tsx`, and Amina for battery messages.
3. **Mission Control visuals:** use `CraftView` in `Flight.tsx` with effects driven by
   real state only: `shadow` while in the pass, `scanning` when the engine's E1 status is
   not `conserved` / `bus_energy_failure`, `downlink` at the downlink stage.
4. **CSS** for `.craft`, `.craft-fallback`, the stepper and option cards in
   `styles/mission.css` (phones: craft above the card, no sideways scroll).
5. **Rewrite tests** for the new builder: `game.test.tsx`, `learning.test.tsx`,
   `shared-engine.test.tsx`, `briefing.test.tsx`, `target.test.tsx`. Old labels that
   are gone: "Save current design as baseline", "Use the ice spectrometer",
   "Install solar + storage", "Why is the current design better?", the tradeoff region.
   Add tests for step navigation, selections surviving Back/Continue and reload,
   compatibility findings, and that fixed steps offer no choices.
6. **Write `docs/ENGINE_V0_2_PROPOSAL.md`** for the backend owner: candidate catalog
   (about three options per subsystem, multi-instrument payloads, protection/control),
   each with required provenance and compatibility rules and **no invented values**;
   event library (eclipse deficit, array deployment anomaly, wheel saturation, thermal
   warning, trajectory correction, calibration drift, hydrogen signature, conflicting
   measurements, extra observation, weak downlink, storage warning, missed window,
   memory error) with id, phase, trigger, state, choices, deterministic transitions,
   consequences, causal trace and radio lines; lifecycle eligible → triggered →
   resolved → recorded; determinism and a per-mission event cap. Add matching types to
   `frontend/src/app/contracts.ts` without wiring fake behavior.
7. **Verify:** typecheck, lint, tests, build; play the full flow in a GPU browser at
   desktop and 390px; check keyboard path and frame rate with two WebGL canvases
   (background scene + craft).
8. **Report honestly** what is functional, presentation-only, and backend-pending.

## How to run and verify (this machine)

- Node is not on PATH. Use
  `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` (v24).
  Node 26 breaks the jsdom tests.
- From `frontend/`: `node node_modules/typescript/bin/tsc --noEmit`,
  `node node_modules/vitest/vitest.mjs run`, `node node_modules/oxlint/bin/oxlint`,
  `node node_modules/vite/bin/vite.js build`.
- Dev server (from repo root): `node frontend/node_modules/vite/bin/vite.js frontend --port 5174 --strictPort`.
- Headless browser checks used Playwright from the codex runtime with
  `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/luna-playwright` and
  `--use-angle=metal --enable-gpu` (software rendering gives misleading frame rates).

## Rules that still apply

- UI never computes outcomes; everything comes from `game.engine.*`.
- Label sourced facts, model assumptions and fiction. No NASA endorsement claims.
- Target regions: `docs/TARGET_REGIONS.md`. Target choice has no simulation effect.
- No `backdrop-filter` over WebGL canvases (it cost the builder ~118 fps once).
- Commit on request only; the user has been committing straight to `main`.
