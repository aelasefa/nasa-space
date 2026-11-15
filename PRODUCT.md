# LUNA-01 — PRODUCT.md

> **Status:** Proposed implementation baseline, not yet approved. Companion to [GAME_RULES.md](GAME_RULES.md). All mission numbers are illustrative educational parameters, not NASA/GMAT-validated data.

## Vision
LUNA-01 is a 5–8 minute browser-based lunar mission-design game. Players build an ice-investigation orbiter, justify engineering trade-offs through simplified CML 1–4 reviews, launch, make two operational decisions, inspect an explainable debrief, and unlock a **Multiverse Explorer** that reruns the same model after changing exactly one decision.

**Tagline:** You designed it. You approved it. Now you have to live with the consequences—and explore what could have happened instead.

## Audience and success criteria
- Primary: hackathon judges experiencing a complete mission without prior space-engineering knowledge.
- Secondary: students and space enthusiasts exploring engineering trade-offs.
- Time to first debrief: target <= 8 minutes with no account, download, or API key.
- First multiverse branch: target <= 60 seconds after debrief.
- Every numerical result is labeled illustrative and every failure has a specific causal explanation.
- Runs offline after assets load; static-hostable and keyboard usable.

## MVP player journey
1. **Briefing:** investigate potential south-pole water ice; budget 120 BU and mass cap 500 kg.
2. **Builder:** choose payload, power, propulsion, communications, trajectory; live feasibility, cost/mass/power/battery/delta-v metrics.
3. **CML 1–4:** validate instrument fit, feasibility, compare two distinct configurations and record a rationale, acknowledge warnings.
4. **Mission control:** launch; make `observe_full` or `conserve` choice, then `science_first` or `health_first` choice; show resolved events.
5. **Debrief:** outcome, returned science, MPI 0–1000, category breakdown, resource productivity and causal chain.
6. **Multiverse:** unlock after first completed flown mission; branch one input, rerun and compare; max 8 saved universes.

## Scope boundaries
**Must:** full loop, deterministic simulation, four CML proxies, one-change branches, side-by-side comparisons, event causality, tests, static deployment.

**Should:** polished mission-control aesthetic, timeline tree, local save/load, small animated orbital illustration, mobile-friendly read-only comparisons.

**Won't in 36 hours:** real orbit propagation, live GMAT, NASA certification, multiplayer, accounts, cloud leaderboard, AI-generated outcomes, complex 3D flight, additional mission scenarios.

## UX principles
- Show consequences before surprises: warn about low energy, downlink limits and delta-v margins before launch.
- No invisible randomness. Same inputs + same model version = same result.
- Never imply an educational simulation is a real flight prediction.
- Mission outcomes and scores are distinct. A low-science mission cannot win by being cheap.
- One branch changes one decision, so cause/effect remains interpretable.

## Screens and acceptance
| Screen | Key interaction | Exit condition |
|---|---|---|
| Briefing | Start mission | Scenario acknowledged |
| Builder | Choose five fields; save alternative | All fields selected |
| Reviews | Complete CML 1–4 | Launch authorized, current config hash |
| Flight | Select observation and downlink actions | Both events resolved |
| Debrief | Inspect result and causal findings | Mission saved as Universe A |
| Multiverse | Select parent, change one field, simulate | New universe saved or rejected with reason |

## Demo narrative
Choose ice spectrometer + robust power + high propulsion + high comms + direct trajectory. Complete reviews, launch, choose full observation and science-first. Show a success. Branch to basic comms: science return becomes downlink-limited. Compare science, budget and causality. Optionally branch to lightweight solar and demonstrate science cutoff. These are expected model behaviors, not real mission predictions.

## Product risks
- **Too much review friction:** offer clear guided prompts, but never fake CML 3 evidence.
- **Misleading scientific claims:** persistent 'illustrative model' label and provenance in debrief.
- **Score gaming:** enumerate all 128 configuration/action combinations; calibrate before freeze.
- **Time pressure:** multiverse vertical slice is protected; cut animations first.

## Release acceptance
A new user can complete the loop; all branches reuse the exact same simulation; invalid configurations cannot launch; CML approvals invalidate on config change; the demo works on a static deployment and without internet after initial load.

## Multiplayer

Optional guest co-op (2–4 players, no accounts). Solo play is unchanged. See `docs/MULTIPLAYER.md`.
