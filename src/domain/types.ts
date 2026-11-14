// Canonical domain types for LUNA-01
// Source of truth: DOMAIN_CONTRACTS.md and GAME_RULES.md

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
  science: number;
  efficiency: number;
  reliability: number;
  engineering: number;
  operations: number;
  rawMPI: number;
  mpi: number;
  cap: 1000 | 749 | 249;
  resourceUse: number;
  rawSciencePerResource: number;
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

export interface EventComparison {
  eventId: 'arrival' | 'E1' | 'E2';
  statusA: string;
  statusB: string;
  statusChanged: boolean;
  metricDeltas: Record<string, number>;
}

export interface UniverseComparison {
  universeIdA: string;
  universeIdB: string;
  changedFields: MutableField[];
  changes: Array<{
    field: MutableField;
    valueA: string;
    valueB: string;
  }>;
  resourceDeltas: {
    costBU: number;
    launchMassKg: number;
    sunlitScienceMarginW: number;
    sunlitDownlinkMarginW: number;
    batteryWh: number;
    deltaVMarginMps: number;
  };
  scienceDelta: {
    collectedSciencePoints: number;
    returnedSciencePoints: number;
    observationFraction: number;
  };
  scoreDelta: {
    mpi: number;
    rawMPI: number;
    science: number;
    efficiency: number;
    reliability: number;
    engineering: number;
    operations: number;
  };
  outcomeTransition: {
    from: Outcome;
    to: Outcome;
    changed: boolean;
  };
  eventComparisons: Record<string, EventComparison>;
}
