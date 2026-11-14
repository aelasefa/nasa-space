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

// The shared contract specifies comparison contents but leaves field names open.
export interface UniverseComparison {
  changedFields: UniverseChange[]
  resourceDeltas: ResourceReport
  scienceDelta: number
  mpiDelta: number
  outcomeTransition: { from: Outcome; to: Outcome }
  eventChanges: Partial<Record<ResolvedEvent['id'], { from: ResolvedEvent; to: ResolvedEvent }>>
}

export interface MissionEngine {
  modelVersion: string
  computeResources(config: SpacecraftConfig): ResourceReport
  evaluateFeasibility(config: SpacecraftConfig): FeasibilityReport
  hashConfig(config: SpacecraftConfig): string
  evaluateReviews(config: SpacecraftConfig, evidence: ReviewEvidence): ReviewReport
  resolveObservation(config: SpacecraftConfig, action: ObserveAction): { event: ResolvedEvent }
  simulateMission(input: MissionInput): SimulationAttempt
  createRootUniverse(attempt: Extract<SimulationAttempt, { kind: 'completed' }>, id: string, createdAt: string): Universe
  branchUniverse(parent: Universe, change: UniverseChange, collection: UniverseCollection, id: string, createdAt: string):
    | { kind: 'created'; universe: Universe }
    | { kind: 'rejected'; reason: string; attempt?: SimulationAttempt }
  compareUniverses(a: Universe, b: Universe): UniverseComparison
}

/**
 * Observation target (frontend contract, not yet consumed by the engine).
 *
 * The player picks one of NASA's 13 historical (August 2022) Artemis III candidate
 * regions; see src/app/regions.ts. Engine v0.1.0 runs one scenario for every target,
 * so the frontend records the choice (Save.targetId) and does NOT pass it to
 * simulateMission or invent target-dependent effects.
 *
 * Proposed backend extension (see docs/TARGET_REGIONS.md):
 *   MissionInput.targetRegionId?: TargetRegionId
 *   computed per-target scenario data with provenance, e.g. illumination during the
 *   observation window and direct-to-Earth visibility, sourced from LOLA-derived products.
 */
export type TargetRegionId = import('./regions').RegionId
export interface TargetSelection {
  regionId: TargetRegionId
  /** Always 'historical-2022': the 13-region set, not NASA's October 2024 shortlist. */
  dataset: 'historical-2022'
  /** True when the engine actually models this target. False in engine v0.1.0. */
  affectsSimulation: false
}
