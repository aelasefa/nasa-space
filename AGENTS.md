# AGENTS.md: rules for working on Amanar and its LUNA-01 mission

LUNA-01 is an educational game: the player plans and flies a robotic orbiter that looks
for water ice at the Moon's south pole. It is one continuous console, from briefing to
multiverse. The product is called **Amanar**: its mission hub (the entry page) launches
the LUNA-01 mission and two companion experiences, the Lunar Rover and the Training
Academy (see `docs/EXPERIENCES.md`). Use “Amanar” for the product and “LUNA-01” only for
the orbiter mission. Save keys keep their `luna01:` prefix so existing saves still load. Your job is to extend it **as one product**: same look, same voice, same
sources of truth. Do not rebuild, restyle or re-invent what exists.

If anything here conflicts with the code, the code is right. Fix this file in the same
change.

## Before you write anything

1. Read this file fully.
2. Run `git status` and `git log --oneline -5`. Other agents and people work in this repo
   at the same time. Uncommitted changes you didn't make are someone's work in
   progress: build on them, never revert or overwrite them.
3. Read the files you are about to change, plus the shared modules listed under
   "Reuse before you create". Do not write code from memory of what a file "probably" has.
4. Run the checks (see "Verify") *before* you start, so you know what was already failing.

## Hard rules

1. **The engine is the only source of truth.** Outcomes, science points, scores,
   feasibility, review gates and event results come from `game.engine.*`
   (`backend/src/domain`, reached through `frontend/src/app/engine.ts`). The UI displays,
   rescales and explains engine results. It never computes or guesses them.
2. **Do not edit `backend/` or `GAME_RULES.md`** unless the user explicitly asks. The
   engine belongs to another developer. Engine ideas go in
   `docs/ENGINE_V0_2_PROPOSAL.md` as a proposal, not into the UI as fake behavior.
3. **Never invent facts or numbers.** No made-up coordinates, specs, science findings,
   risk scores or mission effects. A value you cannot source is shown as "unknown" or
   "not simulated", never estimated. Part numbers come from the engine catalog
   (`catalog` in `app/engine.ts`) and are labelled illustrative.
4. **Nothing unsimulated is selectable.** If the engine does not model an option or an
   event, the UI must not offer it as a working choice. Say it is fixed or not modeled.
5. **Label what kind of statement it is:** sourced fact (with a link), game model
   assumption, or fiction. Crew dialogue is fiction. A high score is never proof of ice.
   No NASA endorsement or GMAT-validation claims.
6. **Target regions are a historical dataset** (NASA's 13 Artemis III candidate regions,
   August 2022; NASA's 2024 list has nine). They are landing-candidate regions, not ice
   detections. The target has no effect on the simulation. Rules and sources:
   `docs/TARGET_REGIONS.md`.
7. **One design system, one stylesheet.** All styles live in
   `frontend/src/styles/mission.css`. No new CSS files, no CSS-in-JS, no UI or component
   libraries, no new fonts or color palettes, no Tailwind utility soup in JSX.
8. **No new dependencies** without the user's approval. The stack is fixed: React 19,
   Vite, TypeScript, zustand, zod, Three.js with React Three Fiber, GSAP.
9. **Keep it accessible.** Real buttons, inputs and labels. Everything reachable by
   keyboard with a visible focus ring. Text never depends on animation. All motion is
   gated by `motionOK()`; all WebGL by `webglOK()` (both in `src/space/motion.ts`), with
   a text fallback.
10. **Never put `backdrop-filter` over a WebGL canvas.** It dropped the app to 2 fps once.
    The stylesheet's `--glass` variable is set to `none` for this reason; leave it.
11. **Commit and push only when the user asks.** Never push failing checks.

## Architecture (frontend/src)

Data flows one way: **engine → app → features → components**.

| Layer | Folder | What belongs there |
|---|---|---|
| Engine adapter | `app/engine.ts`, `app/contracts.ts` | The only import of `backend/`. View-model types. |
| State | `app/controller.ts`, `app/save.ts` | Zustand store, phase state machine, zod-validated save. All state changes go through `game.*` methods. |
| Readings | `app/design.ts`, `app/flight.ts`, `app/replay.ts`, `app/story.ts` | Pure functions that turn engine results into plain-language text and display values. No React. No new math that decides outcomes. |
| Content | `missions/luna01.ts`, `missions/types.ts`, `app/glossary.ts`, `app/regions.ts`, `app/options.ts` | Mission definition (build steps, part text, crew), glossary, region data with provenance, option labels. |
| Screens | `features/*.tsx` | One file per phase: Briefing, TargetSelect, Builder, Review, Flight, Debrief, Multiverse. |
| Shared UI | `components/*.tsx` | Reusable pieces used by more than one screen. |
| 3D | `space/` (decorative backdrop), `target/` (NASA Moon globe), `craft/` (stylized spacecraft) | Lazy-loaded. Never required for the game to work. |
| Hub | `features/Hub.tsx`, `app/experiences.ts`, `components/Experience.tsx` | The entry screen, routes (`#/hub`, `#/solo`, `#/crew`) and the shared “Back to mission hub” link. |
| Companion pages | `rover/` + `src/rover/`, `academy/` + `src/academy/` | Separate HTML entry points. Imported runtimes live in `runtime/` (plain JS with `.d.ts` types). They never import the engine and keep their own saves. |

Phase order: `briefing → target → builder → reviews → flight → debrief → multiverse`
(`App.tsx` picks the screen from `save.phase`, after the hub route).

The mission is data. Steps, parts, crew and the config-to-3D mapping come from a
`MissionDefinition`. Do not hardcode step counts, lunar parts or LUNA-01 rules into
shared components, the stepper or the spacecraft renderer.

## Reuse before you create

Search for an existing piece first (`grep -rn "export function" frontend/src`). Adding a
second version of something that exists is the main way this UI gets ruined.

| Need | Use |
|---|---|
| Screen title, lede, side note | `ScreenHeader` in `components/Screen.tsx` |
| Bottom action row | `ActionBar` in `components/Screen.tsx` |
| A number with label and unit | `Readout` in `components/Screen.tsx` |
| A selectable part or choice | `OptionCard` in `components/Screen.tsx` (real radio input) |
| Modal panel (guides, achievements, optional tools) | `Dialog` in `components/Dialog.tsx` |
| Crew dialogue | `Transmission` in `components/Radio.tsx`, with a character from `mission.crew` (Reyes, Dr. Chen, Amina). Do not add new characters or a second dialogue style. |
| Jargon explanation | `Term` in `components/Term.tsx` + an entry in `app/glossary.ts` |
| Engine findings, metrics, timeline, causes | `components/MissionData.tsx` |
| Bar charts | `components/DebriefCharts.tsx`, `components/TradeCharts.tsx` (single accent hue, values always shown as text) |
| Recorded vs. received science | `components/EvidenceMap.tsx` |
| Spacecraft picture | `CraftView` in `craft/CraftView.tsx` with `mission.design(config)` |
| Number formatting | `number`, `delta` in `components/MissionData.tsx`; `points` in `app/story.ts` |
| Engine status or ID as text | `statusLabel`, `plain`, `metricLabels` in `app/story.ts`; `label` in `app/options.ts`. Never show raw IDs such as `science_first`. |
| Budget and mass limits, shadow hours | `limits`, `scenario` in `app/engine.ts` |

Extend these when you need a variant. Create a new shared component only when two
screens need something that none of them covers.

## Design system

- **Palette (dark only):** background `#03060c`; text `#e7edf0`; `--muted` for secondary
  text; `--accent` (mint, `#b0e3d9`) for the primary action, current state and data
  marks; `--line` for borders; `--panel` for surfaces. Warm gold (`#f4d78a` /
  `#ffe08a`) is for selection and the science voice. Status only: warning `#f5d498`,
  blocker `#ffc2bc`. Do not add hues.
- **Type:** Instrument Sans / Inter for text; `ui-monospace` for numbers, eyebrows and
  labels.
- **Building blocks:** `.panel` surfaces, `.primary` for the one main action per screen,
  `.quiet` for secondary actions, `.eyebrow`, `.fine` for small print, `.tag` for status.
- **One primary action per screen.** It names what happens next ("Open engineering
  review"), not "Next" or "Submit".
- **Layout:** works from 390px wide with no sideways scrolling; body minimum is 300px.
  On phones the sticky top bar is static and shows only the current step.
- **Motion:** short, purposeful, skippable. Nothing essential waits on a timer.

## Writing in the UI

- Plain words for a visitor with no aerospace background. Sentence case. Short sentences.
- Say what happened before showing a score. Explain a term the first time with `Term`.
- Units always shown (BU, kg, W, Wh, m/s). Whole numbers unless precision matters.
- Use the game's own names consistently: "science points", "recorded" (on the
  orbiter) vs. "received" (on Earth), "shadow pass", "downlink", "baseline".

## Tests are part of the interface

- Tests find elements by role and visible name. Renaming a button or heading is a
  breaking change: update the tests in the same change, and never delete or weaken a
  test to get green.
- Keep extra text out of button labels; use `aria-describedby` for descriptions.
- New behavior needs a test in `frontend/tests/frontend/`. Scenario tests should run
  through the real engine (`engine` from `app/engine.ts`), not a hand-written fake.
- jsdom has no WebGL and no `matchMedia`, so 3D and GSAP paths are skipped there. Verify
  those in a real browser.

## Verify (all must pass before you say "done")

From `frontend/`, with **Node 24** (Node 26 breaks the jsdom tests):

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run lint` must report no errors; the existing warnings are known.

Then check the change in a browser (`npm run dev`), at desktop width and at 390px, with
the keyboard, and with no console errors. Play the whole path once: hub → briefing → target →
build → review → Mission Control → debrief → replay. If you touched the hub, Rover or
Academy, open `rover/` and `academy/` too (`npm run build && npm run preview` for the
production paths).

Report honestly: what works, what is presentation-only, what needs the backend, and
what you did not test. Do not claim something is done because it compiles.

## Do not

- Rewrite a screen, the stylesheet or the state layer "to clean it up".
- Add a second stylesheet, theme, layout system, state store or router.
- Use `frontend/src/App.css` or `frontend/src/index.css` (unused template leftovers).
- Add placeholder or mock data that looks real, or mock engines outside tests.
- Change saved-game fields without keeping old saves loadable (`app/save.ts`).
- Store personal data. The call sign stays in memory only.
- Reformat files you are not changing.

## Where things are documented

| File | What it covers |
|---|---|
| `PRODUCT.md`, `ARCHITECTURE.md`, `DOMAIN_CONTRACTS.md`, `GAME_RULES.md`, `TASKS.md`, `DEMO_SCRIPT.md` | Original specs. `GAME_RULES.md` defines the simulation. |
| `docs/TARGET_REGIONS.md` | Region data, sources, provenance rules, placement validation. |
| `docs/ENGINE_V0_2_PROPOSAL.md` | Proposed catalog and events that await engine work. |
| `HANDOFF.md` | Latest work-in-progress notes. Check its date before trusting details. |
| `frontend/src/app/INTEGRATION.md` | How the UI imports the engine. |
