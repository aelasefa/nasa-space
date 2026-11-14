# LUNA-01 — GAME_RULES.md

**Status:** Proposed implementation baseline for team approval  
**Version:** 0.1.0 · 14 November 2026  
**Scope:** One robotic lunar south-pole observation orbiter; 36-hour hackathon; deterministic browser-only educational simulation.

> **Scientific honesty:** All numbers below are deliberately invented **game-balancing parameters**. They are **not** spacecraft specifications, trajectory analyses, NASA estimates, or GMAT results. GMAT integration is optional and must have independently verified provenance. CML stages are educational approximations, not NASA certifications.

## 1. Player objective and gameplay contract

The player must design an orbiter to investigate potential lunar south-pole water ice, demonstrate concept maturity, launch, make two operational decisions, and return useful science data. After the first mission, unlock the **Multiverse Explorer**, allowing a single decision change per branch and an explainable side-by-side comparison.

**Game flow:** briefing → configuration → CML-inspired reviews → launch authorization → arrival → observation decision → downlink decision → debrief → multiverse. First run target: 5–8 minutes. Branching is optional extra playtime.

**Science requirement:** Only the `ice_spectrometer` payload can satisfy the primary water-ice investigation objective. The `mapping_camera` can return contextual mapping data but cannot, by itself, establish the game's primary ice-sensitive observation criterion. This is a gameplay abstraction, not a claim about any real instrument's scientific performance.

## 2. Units, caps, and fixed spacecraft bus

| Quantity | Rule |
|---|---|
| Budget | 120 fictional budget units (BU), no currency implied |
| Launch mass cap | 500 kg |
| Base bus mass | 120 kg, added to selected subsystem masses |
| Base bus sunlit load | 30 W, always included |
| Power generation | W, available in sunlit phases only |
| Battery capacity | Wh, energy stored; **not** power generation |
| Delta-v | m/s; values are scenario-specific abstract capacity/requirement pairs, not GMAT outputs |
| Time | hours for energy intervals; mission time labels are narrative only |
| Science return | 0–100 game science points; not physical measurement accuracy |
| Score | 0–1,000 Mission Performance Index (MPI) |

Every configuration selects exactly one option per subsystem and one trajectory. Missing selections block launch.

## 3. Component catalog (illustrative values)

All costs are BU. The power subsystem's `generationW` and `batteryWh` are separate. A component's `activeLoadW` is its load during science operations; communications load applies during downlink, not simultaneously with science payload load unless a scenario explicitly says so.

### Payload

| ID | Display | Cost | Mass kg | Active load W | Science capability |
|---|---|---:|---:|---:|---|
| `mapping_camera` | Mapping camera | 18 | 35 | 35 | Contextual mapping only; primary ice objective not met |
| `ice_spectrometer` | Ice-sensitive spectrometer | 35 | 65 | 85 | Primary water-ice investigation |

### Power

| ID | Display | Cost | Mass kg | Sunlit generation W | Usable battery Wh |
|---|---|---:|---:|---:|---:|
| `solar_light` | Lightweight solar | 15 | 35 | 150 | 80 |
| `solar_storage` | Solar + storage | 30 | 75 | 190 | 400 |

### Propulsion

| ID | Display | Cost | Mass kg | Available maneuver capacity m/s |
|---|---|---:|---:|---:|
| `prop_low` | Low reserve | 18 | 60 | 750 |
| `prop_high` | High reserve | 30 | 105 | 1150 |

**Model limitation:** Propulsion mass is a fixed packaged subsystem mass, including its abstracted propellant allocation. Do not also add separate propellant mass or imply the values follow the rocket equation.

### Communications

| ID | Display | Cost | Mass kg | Downlink load W | Maximum science downlink points |
|---|---|---:|---:|---:|---:|
| `comms_basic` | Basic antenna | 10 | 15 | 20 | 60 |
| `comms_high` | High-throughput antenna | 20 | 30 | 40 | 100 |

### Trajectories

| ID | Display | Required delta-v m/s | Narrative travel time | Provenance |
|---|---|---:|---|---|
| `direct` | Direct transfer | 1000 | 72 h | illustrative |
| `efficient` | Efficient transfer | 700 | 120 h | illustrative |

**Important:** Travel times and delta-v requirements are abstract scenario values. They must not be presented as a validated relationship for Earth-to-Moon flight. Both trajectories reach the same scripted observation opportunity; travel time does not secretly alter energy or risk in MVP.

## 4. Resource calculations

All calculations are pure functions of the configuration and versioned data.

```text
costBU = sum(component.costBU)
launchMassKg = 120 + sum(component.massKg)
sunlitScienceLoadW = 30 + payload.activeLoadW
sunlitScienceMarginW = power.generationW - sunlitScienceLoadW
downlinkLoadW = 30 + comms.downlinkLoadW
sunlitDownlinkMarginW = power.generationW - downlinkLoadW
deltaVMarginMps = propulsion.availableDeltaVMps - trajectory.requiredDeltaVMps
batteryWh = power.usableBatteryWh
```

**Feasibility blockers:** missing selection; `costBU > 120`; `launchMassKg > 500`; `sunlitScienceMarginW < 0`; `sunlitDownlinkMarginW < 0`; `deltaVMarginMps < 0`. Equality passes. Science mismatch is a **CML 1 objective blocker** for the primary mission (the camera may be previewed in the builder but cannot be authorized for this objective). A configuration with any blocker cannot launch and cannot produce a flown mission result.

**Warnings (not blockers):** power margin < 15 W; delta-v margin < 100 m/s; battery unable to sustain full scripted low-illumination science interval. Warnings are disclosed before launch and can be accepted at CML 4. Warnings do not automatically cause failure; they expose causal risk during scripted events.

## 5. Operational scenario and energy model

All valid launches share the **same** scenario: arrival → low-illumination observation window → science downlink. No random events.

### Event E1: low-illumination observation window

- Duration: **2 hours** (illustrative scenario, not a claim about a particular lunar orbit).
- During the window, solar generation = 0 W.
- Spacecraft base load = 30 W.
- The player chooses one action:
  - `observe_full`: run the science payload at its active load for the full two-hour window.
  - `conserve`: suspend payload activity during this window; run only base bus load.
- Battery starts the window at its full **usable** capacity. This assumption is explicit in the UI.
- Energy needed for `observe_full`: `(30 + payload.activeLoadW) * 2` Wh.
- Energy needed for `conserve`: `30 * 2` Wh.
- If available battery energy is below the selected action's requirement, **safe-mode cutoff** occurs when energy is depleted. The craft survives the event in the MVP because emergency shutdown is abstracted as instantaneous; it collects only the science proportion supported by energy remaining after base bus survival energy is reserved.

**Precise deterministic rule:**

```text
baseEnergyWh = 30 * 2 = 60
if batteryWh < baseEnergyWh:
    eventStatus = 'bus_energy_failure'
    observationFraction = 0
else if action == 'conserve':
    eventStatus = 'conserved'
    observationFraction = 0.50
else:
    payloadEnergyAvailableWh = batteryWh - baseEnergyWh
    payloadEnergyRequiredWh = payload.activeLoadW * 2
    observationFraction = 0.50 + 0.50 * clamp(
        payloadEnergyAvailableWh / payloadEnergyRequiredWh, 0, 1)
    eventStatus = observationFraction < 1 ? 'science_cutoff' : 'nominal'
```

**Interpretation:** The first 50% of the planned science campaign is collected in a prior sunlit observation segment (assumed feasible for launchable designs); the low-illumination segment contributes the remaining 50%. Choosing `conserve` skips the second segment. Battery energy spent on the bus is reserved first. This avoids implying an orbiter operates its science payload continuously in shadow.

**MVP energy boundary:** The downlink event occurs later in a sunlit period. Battery is not used to power downlink; sunlit downlink feasibility is already checked. No battery recharge dynamics are modeled. Label this explicitly.

### Event E2: downlink priority

Player chooses:

- `science_first`: allocate full communications science capacity to science data.
- `health_first`: allocate 60% of communications science capacity to science data, preserving additional diagnostics. This 60% is a gameplay trade-off, not a radio model.

```text
collectedSciencePoints = payload.isIceSensitive ? 100 * observationFraction : 0
scienceDownlinkCapacity = comms.maxScienceDownlinkPoints *
  (decision == 'science_first' ? 1 : 0.60)
returnedSciencePoints = min(collectedSciencePoints, scienceDownlinkCapacity)
scienceReturn = returnedSciencePoints / 100
```

No arbitrary score is awarded for telemetry itself. The `health_first` option may improve an operations-quality subscore only if its rationale is explicitly recorded, but must never outweigh losing scientifically necessary data.

## 6. Outcomes

The primary objective is successful **return** of ice-relevant science data.

| Outcome | Deterministic rule |
|---|---|
| `success` | Launch authorized and `returnedSciencePoints >= 80` |
| `partial` | Launch authorized and `0 < returnedSciencePoints < 80` |
| `failure` | Launch authorized and `returnedSciencePoints == 0`, or bus energy failure |
| `not_launched` | A feasibility or review blocker remains; not a flown outcome and not leaderboard eligible |

An orbiter's arrival alone is not a scientific success. Science points are model abstractions; thresholds are game balancing values.

## 7. Scoring (MPI, 0–1,000)

**Do not use score to determine physical events or outcome.** Compute score after the mission result.

Five categories normalized to 0–100:

### S — Science return (40%, max 400)
`S = returnedSciencePoints`.

### E — Resource efficiency (25%, max 250)

```text
resourceUse = 0.5 * (costBU / 120) + 0.5 * (launchMassKg / 500)
scienceFraction = returnedSciencePoints / 100
E = 100 * clamp(scienceFraction / max(resourceUse, 0.45), 0, 1)
```

**Design note:** This ratio can saturate; show raw `scienceFraction / resourceUse` alongside the normalized score and review its distribution during balancing. Do not claim that this score is a Pareto-optimality measure.

### R — Reliability (15%, max 150)
`R = 100` if no bus failure and no science cutoff; `R = 60` for a science cutoff; `R = 0` for bus energy failure. A deliberate conserve choice does not count as a failure.

### Q — Engineering quality (10%, max 100)
Start at 100; subtract 20 for each accepted warning (power, delta-v, low-illumination endurance), capped at 0. Resolved warnings do not count. All mandatory CML gates must pass before launch; passing them gives no bonus beyond the baseline.

### O — Operations (10%, max 100)
`O = 100` for `observe_full` when full observation is energetically feasible, or `conserve` when full observation would cause cutoff; otherwise `O = 60`. For downlink, `science_first` earns full operational alignment with the stated science objective, while `health_first` earns 60 unless a future scenario introduces a documented telemetry emergency. Final `O` is the average of the two action ratings.

```text
rawMPI = round(4*S + 2.5*E + 1.5*R + Q + O)
MPI = min(rawMPI, outcome == 'success' ? 1000 :
                  outcome == 'partial' ? 749 : 249)
```

**No score for `not_launched`.** The outcome caps prevent an inexpensive failure from outranking a legitimate scientific success, but do not guarantee that every success scores higher than every partial success. Display both outcome and MPI prominently.

**Calibration requirement:** Before freezing v1.0, enumerate all 2^4 × 2 trajectories × 2 observation actions × 2 downlink actions = **128 input combinations**, classifying invalid launch configurations separately. Check that full, partial, and failure are all reachable; adjust only documented balancing constants. (Because all launchable batteries exceed 60 Wh, bus-energy failure is currently unreachable by design; do not advertise that ending unless the data changes.)

## 8. CML-inspired review gates

These are **game-level evidence proxies**, not actual NASA reviews.

| Gate | Evidence | Pass rule |
|---|---|---|
| CML 1 — Charter | South-pole ice investigation + matching instrument | `ice_spectrometer` selected |
| CML 2 — Feasibility | Resources and trajectory | No feasibility blockers |
| CML 3 — Trade study | Two distinct saved configurations; side-by-side metrics; selected compromise | Comparison saved with two different configuration hashes and one selected rationale code (`science`, `mass`, `cost`, `risk`) |
| CML 4 — Point design | Final config, warnings reviewed, decision to accept/resolve | No blockers, all current warnings explicitly acknowledged, review tied to current config hash |

Any relevant design change invalidates CML 2–4 evidence and requires recalculation. CML 3's comparison artifact can be retained but must reference the current candidate before it passes again. `not_launched` branches do not bypass the review gate.

## 9. Multiverse rules

- Multiverse unlocks **after one completed flown mission**.
- The first mission is Universe A, parent `null`.
- Maximum **8 stored universes**, including A. No silent deletion; show limit and offer explicit reset.
- A branch is created from any completed universe, with exactly **one input field** changed: `payloadId`, `powerId`, `propulsionId`, `commsId`, `trajectoryId`, `observeAction`, or `downlinkAction`.
- Same `scenarioId`, `modelVersion`, and environmental conditions as parent.
- Recalculate resources, feasibility, events, science, outcome, MPI, and causal findings through **the same** domain engine.
- Branching a component that introduces a blocker yields a **rejected candidate**, not a fabricated flight. Such a candidate may be displayed as a feasibility comparison but is not saved as a completed universe or scored.
- If an operational choice is no longer applicable, report it explicitly; do not silently substitute an action.
- Preserve immutable input/output snapshots. Store `parentId`, changed field, old/new values, `scenarioId`, `modelVersion`, result, and stable event IDs.
- The comparison UI must show delta in BU, kg, sunlit power margin, battery Wh, delta-v margin, science points, MPI, outcome, and event differences. Highlight both gains and trade-offs.
- Identical inputs under the same model version always produce identical results.

## 10. Causal findings and provenance

Each major finding should include:

```ts
type CausalFinding = {
  id: string;
  sourceField: string;         // e.g. 'powerId'
  constraintId: string;        // e.g. 'low_illumination_energy'
  eventId: string;             // e.g. 'E1'
  effect: string;              // human-readable outcome
  severity: 'info' | 'warning' | 'failure';
  modelSource: 'illustrative' | 'gmat-precomputed';
};
```

Minimum explanations: low battery → science cutoff → reduced collection; conserving → reduced collection but energy protected; basic communications → downlink cap → reduced return; high delta-v requirement + low propulsion → launch blocked; non-ice payload → charter blocked.

GMAT-derived fields, if introduced, require `gmatVersion`, `scriptName`, assumptions, verification status, and source artifact reference. No GMAT validation is claimed in this version.

## 11. Acceptance tests

1. All 128 combinations produce deterministic classifications and finite values; invalid launch candidates never receive flown results.
2. The ice spectrometer + solar storage + high propulsion + high comms + direct transfer + `observe_full` + `science_first` achieves **success**.
3. Ice spectrometer + solar storage + low propulsion + basic comms + efficient transfer + `observe_full` + `science_first` achieves **partial** due to downlink cap.
4. Ice spectrometer + lightweight solar + low propulsion + basic comms + efficient transfer + `observe_full` produces **partial** with science cutoff, not automatic spacecraft destruction.
5. A camera-only design cannot pass CML 1 for the ice investigation mission.
6. Low propulsion + direct transfer fails feasibility (750 < 1000 m/s).
7. Battery endurance accounts for 30 W bus load during the entire 2-hour interval.
8. `conserve` cannot return more collected science than feasible `observe_full` under identical configuration.
9. `health_first` cannot return more science than `science_first` for identical configuration.
10. CML 3 requires two genuinely different configurations and a rationale; a button click alone is insufficient.
11. Changing configuration invalidates stale CML review approvals.
12. Branching changes exactly one input field, preserves parent snapshot, and recomputes from the same engine.
13. Comparing universes reports the correct changed field and causal event differences.
14. No `gmat-precomputed` label appears without verified dataset provenance.
15. No score is assigned to `not_launched`; score stays within the outcome cap.

## 12. Known limitations / explicitly deferred

- No actual orbital propagation, delta-v derivation, launch vehicle sizing, or rocket-equation propellant modeling.
- No eclipse geometry, dynamic solar charging, thermal effects, radiation, or probabilistic reliability model.
- No real water-ice spectral retrieval or scientific uncertainty model.
- No dynamic trajectory optimization, live GMAT process, multiplayer, backend, or leaderboard service.
- CML evidence is simplified to short game interactions.
- Mission events are intentionally authored and deterministic, not predictions of real spacecraft behavior.

## 13. Implementation order

1. Encode this catalog and scenario in typed data, with version tags.
2. Implement pure `computeResources` and `evaluateFeasibility`.
3. Implement `resolveObservation`, `resolveDownlink`, `evaluateOutcome`, `computeMPI`, `buildCausalFindings`.
4. Implement CML gate evaluator and config-hash invalidation.
5. Implement immutable `branchUniverse` using the same simulation pipeline.
6. Run exhaustive test matrix; balance and document any changes before UI integration.

**Approval criterion:** The team agrees on the simplified model, acknowledges that values are illustrative, and can explain the same sample mission result without consulting UI code.
