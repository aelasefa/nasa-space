# LUNA-01 — DEMO_SCRIPT.md

> **Status:** Proposed implementation baseline, not yet approved. Companion to [GAME_RULES.md](GAME_RULES.md). All mission numbers are illustrative educational parameters, not NASA/GMAT-validated data.

## Two-minute judge demo (target)

**0:00–0:15 — Hook.** “You designed it. You approved it. Now you have to live with the consequences. But what if you could explore the decisions you *didn't* make?”

**0:15–0:35 — Build.** Select ice spectrometer, solar + storage, high propulsion, high-throughput comms, direct trajectory. Point to cost/mass/power/delta-v margins. All values are illustrative game parameters.

**0:35–0:55 — Review.** Show CML-inspired evidence gates: objective fit, feasibility, two-design trade study and acknowledged warnings. Clarify that these are educational proxies, not NASA approvals.

**0:55–1:15 — Launch.** Choose full observations, then science-first downlink. Show event trace and science returned.

**1:15–1:35 — Debrief.** Highlight success, MPI breakdown, and the causal chain. Explain that score ranks performance but does not decide physical mission outcome.

**1:35–2:00 — Multiverse reveal.** Branch from the completed universe, change high-throughput comms to basic comms, rerun. Show that the new timeline is downlink-limited and has a lower science return, while consuming fewer resources. The engine and environmental scenario are unchanged. “One decision. Two futures. An explainable trade-off.”

## Backup routes
- If live build interactions take too long, preload a valid locally saved session and demonstrate debrief + branching. Disclose it as a saved demo, not a live mission.
- If deployment fails, run `npm run preview` locally from the tested production build.
- If animation fails, render the event trace and comparison as accessible text; simulation remains authoritative.

## Judge questions
**Is this NASA/GMAT accurate?** No. It is a deterministic educational abstraction with explicitly illustrative values; no GMAT validation is claimed.

**What's innovative?** Counterfactual exploration using the same deterministic mission engine, with one-change branching and causal comparison, rather than a static success/failure score.

**Why no AI?** Reproducibility and explainability are more important than plausible-sounding generated outcomes for this MVP.

**Can you optimize designs?** Players can compare science return, resources and MPI; a full Pareto optimization tool is deferred.

**What would you add next?** Verified precomputed trajectory data, multiple scenarios, more realistic energy/thermal models, uncertainty and a broader design frontier.

## Demo readiness
- [ ] Fresh-start journey tested
- [ ] Saved demo session tested
- [ ] Branch to basic comms produces expected lower downlink
- [ ] Alternative branch to lightweight solar produces a disclosed cutoff risk
- [ ] Offline fallback available
- [ ] No NASA endorsement or GMAT-validation claim
