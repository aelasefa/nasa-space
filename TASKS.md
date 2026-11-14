# LUNA-01 — TASKS.md

> **Status:** Proposed implementation baseline, not yet approved. Companion to [GAME_RULES.md](GAME_RULES.md). All mission numbers are illustrative educational parameters, not NASA/GMAT-validated data.

## Delivery policy
**36-hour hackathon, 2–3 developers.** Tasks are small enough for independent coding agents. Priority P0 blocks the playable loop; P1 improves demo quality; P2 is expendable. Do not begin orchestration until [GAME_RULES.md](GAME_RULES.md), [DOMAIN_CONTRACTS.md](DOMAIN_CONTRACTS.md) and [ARCHITECTURE.md](ARCHITECTURE.md) are reviewed together.

## Ownership
- **Agent A / Engine:** `src/domain/**`, `src/data/**`, domain tests.
- **Agent B / UI:** `src/features/**`, `src/components/**`, `src/styles/**`, assets.
- **Agent C / Integration:** `src/app/**`, persistence, E2E, deployment, docs. If only 2 people, A owns multiverse domain and B owns app integration; merge at scheduled checkpoints.
- **Shared files:** `src/domain/types.ts` and package config owned by integrator after initial freeze; edits require coordination.

## Tickets
| ID | Priority | Owner | Depends on | Deliverable / acceptance |
|---|---|---|---|---|
| T00 | P0 | C | — | Initialize Vite React TS, Tailwind, Vitest, lint/typecheck/build scripts; clean build |
| T01 | P0 | A+C | T00 | Define exact types and validated catalog; no unknown IDs or implicit defaults |
| T02 | P0 | A | T01 | Pure resource calculator; known fixtures match GAME_RULES formulas |
| T03 | P0 | A | T02 | Feasibility blockers/warnings; equality passes; rejected inputs never score |
| T04 | P0 | A | T03 | Observation/downlink resolution; 30 W bus reserve; deterministic events |
| T05 | P0 | A | T04 | Outcome + MPI + causal findings; score caps; complete event trace |
| T06 | P0 | A | T05 | Exhaustive 128-case matrix + 15 game-rule acceptance checks |
| T07 | P0 | B | T01 | Briefing + builder with all five selectors, metrics, warnings and blockers |
| T08 | P0 | A | T03 | CML 1–4 evaluator, trade study, hash-based invalidation |
| T09 | P0 | B | T07,T08 | Review UI; compare two configs, rationale, warning acknowledgments, authorize |
| T10 | P0 | B | T05 | Flight UI with two sequential decisions and event playback |
| T11 | P0 | B | T05 | Debrief UI: outcome, score breakdown, science, causality, provenance |
| T12 | P0 | A | T05 | Immutable universe branching, one-field change validation, max 8 |
| T13 | P0 | A | T12 | Universe comparison deltas and event differences |
| T14 | P0 | B | T12,T13 | Multiverse UI: tree, edit-one-field, compare, reject reasons |
| T15 | P0 | C | T07,T09,T10,T11,T14 | App state machine and end-to-end wiring; no duplicated formulas |
| T16 | P0 | C | T15 | Validated localStorage save/reset/version behavior |
| T17 | P0 | C | T15 | Browser E2E smoke: build→review→flight→debrief→branch→compare |
| T18 | P0 | C | T17 | Static deployment, production build, fallback local demo |
| T19 | P1 | B | T14 | Polished SVG branch tree and mission-control animations |
| T20 | P1 | A+C | T06,T17 | Balance review, edge-case audit, no fake GMAT provenance |
| T21 | P1 | C | T18 | Judge demo script and 2-minute rehearsal |
| T22 | P2 | B | T18 | Mobile polish and secondary motion effects |

## Milestone checkpoints
| By | Must be true | Cut if behind |
|---|---|---|
| Hour 4 | T00–T02 and shared contracts compile; UI skeleton exists | Decorative styling |
| Hour 8 | T03–T05 working; known scenarios tested | Extra event animations |
| Hour 12 | T06, T08, T12 domain work underway; builder usable | Advanced CML copy |
| Hour 16 | Branch original to one alternate via domain engine, compare correctly | Timeline polish |
| Hour 20 | Complete end-to-end first mission + alternate universe | Additional branch visualizations |
| Hour 26 | Reviews, persistence, replay integrated | Nonessential UI effects |
| Hour 33 | Tests/build pass and deployment available | All P2 |
| Hour 36 | Rehearsed stable demo with backup | Feature additions |

## Critical path
`T00 -> T01 -> T02 -> T03 -> T04 -> T05 -> T12 -> T13 -> T14 -> T15 -> T17 -> T18`

Parallel paths: `T07 -> T09`, `T08 -> T09`, `T05 -> T10/T11`, `T06 -> T20`.

## Acceptance test scenarios
1. Robust ice spectrometer / solar storage / high propulsion / high comms / direct / full observation / science-first => success.
2. Ice spectrometer / solar storage / low propulsion / basic comms / efficient / full / science-first => partial (60-point downlink cap).
3. Ice spectrometer / lightweight solar / low propulsion / basic comms / efficient / full / science-first => partial with science cutoff.
4. Camera-only configuration => CML1 objective blocker.
5. Low propulsion + direct transfer => feasibility blocker.
6. Conserve cannot outperform feasible full observation on collected science.
7. Health-first cannot return more science than science-first.
8. Every valid branch changes exactly one input and leaves parent unchanged.
9. No `not_launched` scored as a flown mission.
10. Changing config invalidates review approval; stale evidence cannot launch.
11. Same inputs/model version produce identical event trace and score.
12. No false NASA/GMAT-validated claims anywhere in UI.

## Agent task handoff format
Each task handoff must include: ticket ID, goal, owned paths, exact interfaces from DOMAIN_CONTRACTS, dependencies, test cases, out-of-scope files, and done criteria. Agent must report changed files, tests run, limitations and any contract deviations. No agent silently edits another agent's owned files.

## Integration checklist
- [ ] Types and component IDs consistent across app, domain, fixtures and UI
- [ ] All domain tests pass
- [ ] Exhaustive 128-case matrix passes
- [ ] Typecheck passes
- [ ] Production build passes
- [ ] End-to-end mission and branching smoke pass
- [ ] CML 3 evidence is genuine, not a click-through
- [ ] Score/outcome separation preserved
- [ ] All numerical metrics labeled illustrative
- [ ] Save reload/reset works
- [ ] Deployment and offline fallback rehearsed

## Escalation rules
If a ticket uncovers conflicting specifications, stop at the interface boundary, open a documented decision, and obtain one owner-approved rule update before continuing. Do not resolve discrepancies by inventing behavior in UI code.
