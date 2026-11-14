# LUNA-01 frontend: handoff notes

Context for the next person or model continuing frontend work. State as of commit
`6c27610` on `main` (2026-11-14).

## What this is

An educational game: plan a robotic orbiter that looks for water ice at the
Moon's south pole. Flow: **intro → builder → review → flight → debrief →
multiverse** (replay with one decision changed). All numbers are illustrative
game values. Specs are at the repo root: `PRODUCT.md`, `ARCHITECTURE.md`,
`DOMAIN_CONTRACTS.md`, `GAME_RULES.md`, `TASKS.md`, `DEMO_SCRIPT.md`.

## Repo layout

```
nasa-space/
├── frontend/   React 19 + Vite 8 + TS 7 UI (this folder)
├── backend/    simulation engine (src/domain, src/data), HTTP API (src/server.ts), Docker
└── *.md        shared specs
```

The UI imports the real engine directly from `backend/src/domain`
(`src/app/engine.ts`). The backend HTTP API is not used by the UI.

## Run it

Use **Node 24**. Node 26's built-in `localStorage` breaks the jsdom tests. On the
original machine Node is not on PATH; a working binary is at
`~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

From `frontend/`:

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest, 15 tests
npm run typecheck
npm run lint       # oxlint; 2 known warnings, no errors
npm run build
```

## Hard rules (from the specs)

- **Never re-implement game rules in the UI.** All outcomes, scores, feasibility
  and reviews come from the engine (`game.engine.*`). The UI only displays and
  rescales results. Exception already in the code: `src/app/planning.ts` and
  `MissionRehearsal` are labelled "illustrative preflight estimates"; don't
  expand them.
- Don't edit `backend/` (engine-owned) without coordinating.
- No NASA endorsement or GMAT-validated claims anywhere in the UI.
- Keep it accessible: keyboard-reachable controls, reduced-motion support, text
  that doesn't depend on animation.

## Code map (`frontend/src`)

| Path | What it does |
|---|---|
| `main.tsx`, `App.tsx` | Bootstraps the game. App picks the screen by `save.phase`, renders the top bar, How to play guide, GSAP phase entrances and the 3D backdrop |
| `app/controller.ts` | Zustand store and state machine (`start`, `select`, `saveAlternative`, `reviews`, `trade`, `acknowledge`, `launch`, `observe`, `downlink`, `multiverse`, `branch`, `reset`). Saves to localStorage |
| `app/engine.ts` | Adapter to `backend/src/domain`. Also exports `limits` (budget/mass caps) |
| `app/contracts.ts` | Frontend view-model types (`MissionEngine`, `MissionResult`, …) |
| `app/save.ts` | Zod-validated save/load, model-version checks |
| `app/options.ts` | Option IDs and labels for the 5 parts and 2 flight decisions |
| `app/glossary.ts` | Plain-language definitions for every jargon term |
| `features/Briefing.tsx` | Intro: "Hi, [name]" input (1–16 chars, trimmed), then a Star Wars-style crawl (GSAP ScrollTrigger) |
| `features/Design.tsx` | `Builder` (part pickers, limits, space weather, trade study) and `Review` (CML gates, warnings, trade study) |
| `features/MissionPlanning.tsx` | Builder side panels: margins, baseline comparison, rehearsal |
| `features/Flight.tsx` | `Flight` (two decisions with explanations), `Playback`, `Debrief` |
| `features/Multiverse.tsx` | Branch tree, change-one-field form, side-by-side comparison |
| `components/DebriefCharts.tsx` | Score, science and spend bar charts |
| `components/Coach.tsx` | Next-step checklist used on the builder and review |
| `components/Term.tsx` | Inline "?" jargon explainer |
| `components/Guide.tsx` | How to play dialog with the glossary |
| `components/MissionData.tsx`, `Orbit.tsx` | Shared metric list, findings, timeline; SVG orbit schematic |
| `space/scene.ts`, `SpaceBackdrop.tsx`, `motion.ts` | Three.js backdrop (procedural Moon, orbiter, Earth, starfield, warp jump), lazy-loaded; `motionOK()` gates all motion |
| `styles/mission.css` | All styles (Tailwind is imported but barely used) |

Tests live in `frontend/tests/frontend/`: `briefing`, `game` (fixture engine),
`shared-engine` (real-engine judge demo), `learning` (guidance and charts),
`planning`.

## Test gotchas

- Tests find elements by accessible name, e.g. buttons `Start mission`,
  `Save trade study candidate`, `Open engineering review`, `Record trade study`,
  `Authorize launch`, `Full observation`, `Science first`, `Open debrief`,
  `Explore alternate universes`, `Simulate alternate universe`. Don't change
  those labels or put extra text inside those buttons; use `aria-describedby`.
- Under jsdom (no `matchMedia`, no WebGL), all GSAP and Three.js code paths are
  skipped. Keep new motion behind `motionOK()`.
- The "Start mission" warp calls `start()` synchronously when there's no scene,
  so tests move through phases instantly.

## Performance notes

- Panels must **not** use `backdrop-filter`. Live blur over the WebGL canvas
  dropped the builder to about 2 fps; it now runs at ~120 fps.
- The scene updates star positions only during the warp jump, and renders the
  app-mode backdrop at 30 fps.

## Known issues / good next steps

1. **Mobile top bar** wraps to three lines and takes up a lot of space. Collapse
   the step list on narrow screens.
2. **Multiverse screen** has no charts yet. Reuse the `Bars` pattern from
   `DebriefCharts.tsx` for A-vs-B deltas (keep the table; a test reads the
   `Science returned` row and `-40`).
3. **Mission rehearsal** (`planning.ts`) still duplicates rule numbers. It could
   call `engine.simulateMission` on a hypothetical input instead.
4. **Lint warnings**: `MissionData.tsx` exports non-components;
   `SpaceBackdrop.tsx` reads a ref during render.
5. **Bundle size**: main chunk about 470 KB (Vite warns). Could split
   React/zod/gsap or lazy-load later screens.
6. **Saved demo session** for judges (`DEMO_SCRIPT.md` backup route) does not
   exist yet.
7. **Docker image** was never built after the backend moved to `backend/`;
   Docker wasn't installed on the dev machine.
