// LUNA-01 Domain Engine Barrel Export
// Source of truth: DOMAIN_CONTRACTS.md and GAME_RULES.md

// Canonical Types
export * from './types';

// Engineering Calculations
export {
  computeResources,
  evaluateFeasibility,
  hashConfig,
} from './engineering';

// Mission Simulation
export {
  resolveObservation,
  resolveDownlink,
  evaluateOutcome,
  simulateMission,
} from './simulation';

// Mission Scoring
export {
  computeMPI,
} from './scoring';

// Causal Findings
export {
  buildCausalFindings,
} from './causality';

// CML Engineering Reviews
export {
  evaluateReviews,
  isReviewEvidenceStale,
} from './reviews';

// Multiverse Engine
export {
  createRootUniverse,
  branchUniverse,
  compareUniverses,
} from './multiverse';

// Data Catalog and Constants
export {
  BUDGET_CAP_BU,
  LAUNCH_MASS_CAP_KG,
  BASE_BUS_MASS_KG,
  BASE_BUS_SUNLIT_LOAD_W,
  BASE_BUS_SHADOW_LOAD_W,
  E1_OBSERVATION_DURATION_HOURS,
  BASE_SURVIVAL_ENERGY_WH,
  DEFAULT_SCENARIO_ID,
  DEFAULT_MODEL_VERSION,
  DATA_PROVENANCE,
  PAYLOAD_CATALOG,
  POWER_CATALOG,
  PROPULSION_CATALOG,
  COMMS_CATALOG,
  TRAJECTORY_CATALOG,
} from '../data/catalog';
export type {
  PayloadComponent,
  PowerComponent,
  PropulsionComponent,
  CommsComponent,
  TrajectoryComponent,
} from '../data/catalog';
