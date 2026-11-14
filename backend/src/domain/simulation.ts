// Deterministic mission simulation engine for LUNA-01
// Source of truth: GAME_RULES.md (Sections 5 & 6) and DOMAIN_CONTRACTS.md

import type {
  SpacecraftConfig,
  ObserveAction,
  DownlinkAction,
  Outcome,
  ResolvedEvent,
  MissionInput,
  SimulationAttempt,
  MissionResult,
} from './types';
import {
  BASE_BUS_SHADOW_LOAD_W,
  E1_OBSERVATION_DURATION_HOURS,
  BASE_SURVIVAL_ENERGY_WH,
  PAYLOAD_CATALOG,
  POWER_CATALOG,
  PROPULSION_CATALOG,
  COMMS_CATALOG,
  TRAJECTORY_CATALOG,
  DEFAULT_SCENARIO_ID,
} from '../data/catalog';
import { computeResources, evaluateFeasibility } from './engineering';
import { computeMPI } from './scoring';
import { buildCausalFindings } from './causality';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Resolves Event E1: Low-illumination observation window (2 hours).
 * Evaluates battery energy, base bus reserve, and observation fraction.
 */
export function resolveObservation(
  config: SpacecraftConfig,
  action: ObserveAction
): {
  observationFraction: number;
  status: 'nominal' | 'conserved' | 'science_cutoff' | 'bus_energy_failure';
  event: ResolvedEvent;
} {
  const payload = PAYLOAD_CATALOG[config.payloadId];
  const power = POWER_CATALOG[config.powerId];

  if (!payload || !power) {
    throw new Error('Invalid payload or power ID in configuration');
  }

  const baseEnergyWh = BASE_SURVIVAL_ENERGY_WH; // 60 Wh (30 W * 2 h)
  const batteryWh = power.usableBatteryWh;

  let observationFraction = 0;
  let status: 'nominal' | 'conserved' | 'science_cutoff' | 'bus_energy_failure' = 'nominal';
  let description = '';

  if (batteryWh < baseEnergyWh) {
    status = 'bus_energy_failure';
    observationFraction = 0;
    description = `Spacecraft bus survival energy depleted during shadow pass (${batteryWh} Wh < ${baseEnergyWh} Wh needed); safe-mode triggered with zero science return.`;
  } else if (action === 'conserve') {
    status = 'conserved';
    observationFraction = 0.50;
    description = 'Observation suspended during shadow pass to preserve bus reserves; 50% baseline sunlit science completed.';
  } else {
    // observe_full
    const payloadEnergyAvailableWh = batteryWh - baseEnergyWh;
    const payloadEnergyRequiredWh = payload.activeLoadW * E1_OBSERVATION_DURATION_HOURS;
    const fractionSupported = clamp(payloadEnergyAvailableWh / payloadEnergyRequiredWh, 0, 1);
    observationFraction = 0.50 + 0.50 * fractionSupported;

    if (observationFraction < 1) {
      status = 'science_cutoff';
      description = `Battery depleted during active shadow pass (${batteryWh} Wh total, ${payloadEnergyAvailableWh} Wh for payload vs ${payloadEnergyRequiredWh} Wh required); safe-mode cutoff at ${Math.round(observationFraction * 100)}% observation.`;
    } else {
      status = 'nominal';
      description = `Full 2-hour shadow observation window nominal; 100% science coverage achieved with ${batteryWh} Wh battery storage.`;
    }
  }

  const event: ResolvedEvent = {
    id: 'E1',
    status,
    description,
    metrics: {
      observationFraction,
      batteryWh,
      baseEnergyWh,
      payloadActiveLoadW: payload.activeLoadW,
    },
  };

  return {
    observationFraction,
    status,
    event,
  };
}

/**
 * Resolves Event E2: Downlink priority and data return.
 * Player chooses science_first (100% capacity) or health_first (60% capacity).
 */
export function resolveDownlink(
  config: SpacecraftConfig,
  action: DownlinkAction,
  observationFraction: number
): {
  collectedSciencePoints: number;
  returnedSciencePoints: number;
  event: ResolvedEvent;
} {
  const payload = PAYLOAD_CATALOG[config.payloadId];
  const comms = COMMS_CATALOG[config.commsId];

  if (!payload || !comms) {
    throw new Error('Invalid payload or comms ID in configuration');
  }

  // Only ice-sensitive payload produces valid primary science points
  const collectedSciencePoints = payload.isIceSensitive ? 100 * observationFraction : 0;
  const capacityMultiplier = action === 'science_first' ? 1.0 : 0.60;
  const scienceDownlinkCapacity = comms.maxScienceDownlinkPoints * capacityMultiplier;
  const returnedSciencePoints = Math.min(collectedSciencePoints, scienceDownlinkCapacity);

  const isLimited = returnedSciencePoints < collectedSciencePoints;
  const status = isLimited ? 'downlink_limited' : 'nominal';

  let description = '';
  if (!payload.isIceSensitive) {
    description = 'Downlink completed; contextual optical imagery returned but zero water-ice spectral points detected.';
  } else if (isLimited) {
    description = `Downlink limited by antenna capacity (${scienceDownlinkCapacity} pts max with ${action}); returned ${returnedSciencePoints} of ${collectedSciencePoints} collected points.`;
  } else {
    description = `Downlink nominal; full collected science package transmitted (${returnedSciencePoints} points returned).`;
  }

  const event: ResolvedEvent = {
    id: 'E2',
    status,
    description,
    metrics: {
      collectedSciencePoints,
      returnedSciencePoints,
      scienceDownlinkCapacity,
    },
  };

  return {
    collectedSciencePoints,
    returnedSciencePoints,
    event,
  };
}

/**
 * Evaluates mission outcome category from returned science points and observation status.
 */
export function evaluateOutcome(
  returnedSciencePoints: number,
  observationStatus: string
): Outcome {
  if (observationStatus === 'bus_energy_failure' || returnedSciencePoints === 0) {
    return 'failure';
  }
  if (returnedSciencePoints >= 80) {
    return 'success';
  }
  return 'partial';
}

/**
 * Top-level pure deterministic mission simulation.
 * Validates inputs and feasibility; produces full ordered event trace and results.
 */
export function simulateMission(input: MissionInput): SimulationAttempt {
  // Validate scenario
  if (input.scenarioId !== DEFAULT_SCENARIO_ID) {
    throw new Error(`Unsupported scenario ID: ${input.scenarioId}`);
  }

  // Validate feasibility
  const feasibility = evaluateFeasibility(input.config);
  if (!feasibility.eligible) {
    return {
      kind: 'rejected',
      input,
      feasibility,
    };
  }

  const trajectory = TRAJECTORY_CATALOG[input.config.trajectoryId];
  const propulsion = PROPULSION_CATALOG[input.config.propulsionId];
  const resources = computeResources(input.config);

  // Event: Arrival
  const arrivalEvent: ResolvedEvent = {
    id: 'arrival',
    status: 'nominal',
    description: `Lunar south-pole orbit arrival nominal via ${trajectory.display} (${trajectory.narrativeTravelTime}). Delta-v margin: ${resources.deltaVMarginMps} m/s.`,
    metrics: {
      deltaVMarginMps: resources.deltaVMarginMps,
      availableDeltaVMps: propulsion.availableDeltaVMps,
      requiredDeltaVMps: trajectory.requiredDeltaVMps,
    },
  };

  // Event: E1 Low-illumination observation
  const obs = resolveObservation(input.config, input.decisions.observeAction);

  // Event: E2 Downlink
  const down = resolveDownlink(input.config, input.decisions.downlinkAction, obs.observationFraction);

  const events: ResolvedEvent[] = [arrivalEvent, obs.event, down.event];
  const outcome = evaluateOutcome(down.returnedSciencePoints, obs.status);

  // Compute scoring breakdown
  const score = computeMPI(
    input,
    resources,
    events,
    down.returnedSciencePoints,
    outcome,
    feasibility.warnings
  );

  const resultWithoutCauses: Omit<MissionResult, 'causes'> = {
    outcome,
    resources,
    observationFraction: obs.observationFraction,
    collectedSciencePoints: down.collectedSciencePoints,
    returnedSciencePoints: down.returnedSciencePoints,
    scienceReturn: down.returnedSciencePoints / 100,
    events,
    score,
  };

  const causes = buildCausalFindings(input, resultWithoutCauses);

  const result: MissionResult = {
    ...resultWithoutCauses,
    causes,
  };

  return {
    kind: 'completed',
    input,
    result,
  };
}
