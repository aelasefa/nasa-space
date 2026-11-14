# LUNA-01 — DOMAIN_CONTRACTS.md

> **Status:** Proposed implementation baseline, not yet approved. Companion to [GAME_RULES.md](GAME_RULES.md). All mission numbers are illustrative educational parameters, not NASA/GMAT-validated data.

## Source of truth
All numeric constants, IDs, formulas, outcome rules and review requirements are defined in [GAME_RULES.md](GAME_RULES.md). These contracts specify interfaces, invariants and failure behavior. Domain functions must be pure and must not import React, Zustand, browser storage or UI libraries.

## Canonical types

```ts
export type PayloadId = 'mapping_camera' | 'ice_spectrometer';
export type PowerId = 'solar_light' | 'solar_storage';
export type PropulsionId = 'prop_low' | 'prop_high';
export type CommsId = 'comms_basic' | 'comms_high';
export type TrajectoryId = 'direct' | 'efficient';
export type ObserveAction = 'observe_full' | 'conserve';
export type DownlinkAction = 'science_first' | 'health_first';
export type ConfigField = keyof SpacecraftConfig;
export type DecisionField = keyof OperationalDecisions;
export type MutableField = ConfigField | DecisionField;
export type Outcome = 'success' | 'partial' | 'failure';
export type ReviewGate = 'CML1' | 'CML2' | 'CML3' | 'CML4';
export type WarningId = 'power_margin' | 'delta_v_margin' | 'battery_endurance';

export interface SpacecraftConfig {
  payloadId: PayloadId;
  powerId: PowerId;
  propulsionId: PropulsionId;
  commsId: CommsId;
  trajectoryId: TrajectoryId;
}
export interface OperationalDecisions {
  observeAction: ObserveAction;
  downlinkAction: DownlinkAction;
}
export interface MissionInput {
  config: SpacecraftConfig;
  decisions: OperationalDecisions;
  scenarioId: 'lunar_south_pole_ice_v1';
  modelVersion: string;
}
export interface ResourceReport {
  costBU: number;
  launchMassKg: number;
  sunlitScienceLoadW: number;
  sunlitScienceMarginW: number;
  downlinkLoadW: number;
  sunlitDownlinkMarginW: number;
  deltaVMarginMps: number;
  batteryWh: number;
}
export interface Finding {
  id: string;
  severity: 'blocker' | 'warning' | 'info';
  sourceField: MutableField | 'scenario';
  message: string;
  actual?: number;
  threshold?: number;
  unit?: 'BU' | 'kg' | 'W' | 'Wh' | 'm/s';
}
export interface FeasibilityReport {
  eligible: boolean;
  blockers: Finding[];
  warnings: Finding[];
}
export interface ResolvedEvent {
  id: 'arrival' | 'E1' | 'E2';
  status: string;
  description: string;
  metrics: Record<string, number>;
}
export interface CausalFinding {
  id: string;
  sourceField: MutableField | 'scenario';
  constraintId: string;
  eventId: string;
  effect: string;
  severity: 'info' | 'warning' | 'failure';
  modelSource: 'illustrative' | 'gmat-precomputed';
}
export interface ScoreBreakdown {
  science: number; efficiency: number; reliability: number;
  engineering: number; operations: number;
  rawMPI: number; mpi: number; cap: 1000 | 749 | 249;
  resourceUse: number; rawSciencePerResource: number;
}
export interface MissionResult {
  outcome: Outcome;
  resources: ResourceReport;
  observationFraction: number;
  collectedSciencePoints: number;
  returnedSciencePoints: number;
  scienceReturn: number; // fraction 0..1
  events: ResolvedEvent[];
  causes: CausalFinding[];
  score: ScoreBreakdown;
}
export interface TradeStudyEvidence {
  configHashA: string;
  configHashB: string;
  chosenConfigHash: string;
  rationale: 'science' | 'mass' | 'cost' | 'risk';
}
export interface ReviewEvidence {
  configHash: string;
  tradeStudy?: TradeStudyEvidence;
  acknowledgedWarnings: WarningId[];
}
export interface ReviewReport {
  configHash: string;
  gates: Record<ReviewGate, { passed: boolean; findings: Finding[] }>;
  authorized: boolean;
}
export interface UniverseChange {
  field: MutableField;
  from: string;
  to: string;
}
export interface Universe {
  id: string;
  parentId: string | null;
  input: MissionInput;
  result: MissionResult;
  change: UniverseChange | null;
  createdAt: string;
}
export interface UniverseCollection {
  schemaVersion: 1;
  rootId: string;
  universes: Universe[]; // max 8
}
export type SimulationAttempt =
  | { kind: 'rejected'; input: MissionInput; feasibility: FeasibilityReport; review?: ReviewReport }
  | { kind: 'completed'; input: MissionInput; result: MissionResult };
```

## Public domain functions

```ts
computeResources(config: SpacecraftConfig): ResourceReport

evaluateFeasibility(config: SpacecraftConfig): FeasibilityReport

hashConfig(config: SpacecraftConfig): string // stable canonical key order

evaluateReviews(config: SpacecraftConfig, evidence: ReviewEvidence): ReviewReport

resolveObservation(config: SpacecraftConfig, action: ObserveAction): {
  observationFraction: number;
  status: 'nominal' | 'conserved' | 'science_cutoff' | 'bus_energy_failure';
  event: ResolvedEvent;
}

resolveDownlink(config: SpacecraftConfig, action: DownlinkAction,
  observationFraction: number): {
  collectedSciencePoints: number;
  returnedSciencePoints: number;
  event: ResolvedEvent;
}

evaluateOutcome(returnedSciencePoints: number,
  observationStatus: string): Outcome

computeMPI(input: MissionInput, resources: ResourceReport,
  events: ResolvedEvent[], returnedSciencePoints: number,
  outcome: Outcome, warnings: Finding[]): ScoreBreakdown

buildCausalFindings(input: MissionInput, resultWithoutCauses: Omit<MissionResult, 'causes'>): CausalFinding[]

simulateMission(input: MissionInput): SimulationAttempt

createRootUniverse(attempt: Extract<SimulationAttempt, {kind:'completed'}>,
  id: string, createdAt: string): Universe

branchUniverse(parent: Universe, change: UniverseChange,
  collection: UniverseCollection, id: string, createdAt: string):
  | { kind: 'created'; universe: Universe }
  | { kind: 'rejected'; reason: string; attempt?: SimulationAttempt }

compareUniverses(a: Universe, b: Universe): UniverseComparison
```

`UniverseComparison` must include `changedFields`, resource deltas (BU, kg, W, Wh, m/s), science delta, MPI delta, outcome transition, and per-event changes keyed by stable event ID. The implementation should define this interface before UI work starts.

## Launch authorization boundary
`simulateMission` validates catalog IDs, model/scenario versions and **engineering feasibility**. Initial playthrough launch authorization additionally requires `evaluateReviews(...).authorized` in the application controller. Branching is a post-authorization counterfactual: a valid single-field change may be simulated without repeating CML interactions, but it must still pass engineering feasibility and be labeled **counterfactual / not separately CML-approved**. A rejected branch receives no score or saved completed universe. This resolves the difference between player launch approval and rapid what-if exploration.

## Determinism and immutability
- No `Math.random()`, current time, network requests or browser APIs inside the domain.
- Caller supplies IDs/timestamps; engine does not create them.
- Same validated `MissionInput` + same data/model version -> deeply equal simulation result.
- Never mutate config, decisions, parent universe, data catalog or collection.
- Use stable event IDs and stable finding IDs; preserve ordering.
- Clamp fractions to [0,1], validate finite numbers, and use a single rounding policy: retain full precision internally; round only MPI and UI display.
- Use Zod at import/persistence boundaries, not in core calculations.

## Explicit unresolved decisions / blockers to freeze
1. `GAME_RULES.md` says `not_launched` is not a flown outcome; contracts therefore represent it as `SimulationAttempt.kind='rejected'`, not `Outcome`.
2. Review requirements apply to original launches; branches are labeled counterfactual and require engineering feasibility only.
3. `GAME_RULES.md` assigns an observation fraction of 0.50 for `conserve`, representing the earlier sunlit science segment. Preserve this exact rule even if it appears counterintuitive.
4. `GAME_RULES.md`'s score category formulas and caps take precedence over any alternate scoring ideas from earlier brainstorming.
5. An invalid catalog ID, unknown model version, malformed input or duplicate universe ID should return a typed validation error (or throw a dedicated `DomainValidationError`), never silently default.

## Contract tests
- Compile-time exhaustive `switch` checks for all IDs/actions.
- No score on rejected attempts.
- Changing one field cannot mutate parent.
- Repeated simulation yields byte-for-byte equivalent JSON when serialized canonically.
- Stable configuration hashes are insensitive to object insertion order.
- Rejected branch never increments universe count.
- Maximum eight completed universes including root.
