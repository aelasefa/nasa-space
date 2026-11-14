// Multiverse branching and universe comparison engine for LUNA-01
// Source of truth: GAME_RULES.md (Section 9) and DOMAIN_CONTRACTS.md

import type {
  Universe,
  UniverseCollection,
  UniverseChange,
  SimulationAttempt,
  UniverseComparison,
  EventComparison,
  MutableField,
  ConfigField,
  DecisionField,
} from './types';
import { simulateMission } from './simulation';
import {
  PAYLOAD_CATALOG,
  POWER_CATALOG,
  PROPULSION_CATALOG,
  COMMS_CATALOG,
  TRAJECTORY_CATALOG,
} from '../data/catalog';

const VALID_MUTABLE_FIELDS: MutableField[] = [
  'payloadId',
  'powerId',
  'propulsionId',
  'commsId',
  'trajectoryId',
  'observeAction',
  'downlinkAction',
];

const VALID_VALUES_BY_FIELD: Record<MutableField, string[]> = {
  payloadId: Object.keys(PAYLOAD_CATALOG),
  powerId: Object.keys(POWER_CATALOG),
  propulsionId: Object.keys(PROPULSION_CATALOG),
  commsId: Object.keys(COMMS_CATALOG),
  trajectoryId: Object.keys(TRAJECTORY_CATALOG),
  observeAction: ['observe_full', 'conserve'],
  downlinkAction: ['science_first', 'health_first'],
};

/**
 * Creates Universe A from a completed initial flight attempt.
 */
export function createRootUniverse(
  attempt: Extract<SimulationAttempt, { kind: 'completed' }>,
  id: string,
  createdAt: string
): Universe {
  return {
    id,
    parentId: null,
    input: {
      config: { ...attempt.input.config },
      decisions: { ...attempt.input.decisions },
      scenarioId: attempt.input.scenarioId,
      modelVersion: attempt.input.modelVersion,
    },
    result: attempt.result,
    change: null,
    createdAt,
  };
}

/**
 * Branches a universe by modifying exactly ONE configuration or decision field.
 * Enforces maximum 8 universes, parent immutability, and rejection of infeasible branches.
 */
export function branchUniverse(
  parent: Universe,
  change: UniverseChange,
  collection: UniverseCollection,
  id: string,
  createdAt: string
):
  | { kind: 'created'; universe: Universe }
  | { kind: 'rejected'; reason: string; attempt?: SimulationAttempt } {
  // 1. Enforce maximum 8 stored universes per collection
  if (collection.universes.length >= 8) {
    return {
      kind: 'rejected',
      reason: 'Maximum universe limit reached (8 universes). Reset collection to explore new branches.',
    };
  }

  // 2. Prevent duplicate universe IDs
  if (collection.universes.some((u) => u.id === id)) {
    return {
      kind: 'rejected',
      reason: `Universe with ID "${id}" already exists in the collection.`,
    };
  }

  // 3. Validate mutable field
  if (!VALID_MUTABLE_FIELDS.includes(change.field)) {
    return {
      kind: 'rejected',
      reason: `Invalid branch field: "${change.field}". Must be one of: ${VALID_MUTABLE_FIELDS.join(', ')}.`,
    };
  }

  // 4. Validate that 'to' differs from 'from'
  if (change.to === change.from) {
    return {
      kind: 'rejected',
      reason: `Branching requires a change: "to" value "${change.to}" is identical to "from" value.`,
    };
  }

  // 5. Verify parent value matches 'change.from'
  let parentCurrentValue: string;
  if (change.field in parent.input.config) {
    parentCurrentValue = parent.input.config[change.field as ConfigField];
  } else {
    parentCurrentValue = parent.input.decisions[change.field as DecisionField];
  }

  if (parentCurrentValue !== change.from) {
    return {
      kind: 'rejected',
      reason: `Branch "from" value "${change.from}" does not match parent universe's current value "${parentCurrentValue}".`,
    };
  }

  // 6. Validate that 'change.to' is a recognized catalog option
  const allowedValues = VALID_VALUES_BY_FIELD[change.field];
  if (!allowedValues.includes(change.to)) {
    return {
      kind: 'rejected',
      reason: `Invalid value "${change.to}" for field "${change.field}". Allowed values: ${allowedValues.join(', ')}.`,
    };
  }

  // 7. Construct new input with immutable copy
  const newConfig = { ...parent.input.config };
  const newDecisions = { ...parent.input.decisions };

  if (change.field in newConfig) {
    (newConfig as Record<string, string>)[change.field] = change.to;
  } else {
    (newDecisions as Record<string, string>)[change.field] = change.to;
  }

  const newInput = {
    config: newConfig,
    decisions: newDecisions,
    scenarioId: parent.input.scenarioId,
    modelVersion: parent.input.modelVersion,
  };

  // 8. Simulate candidate branch through the SAME domain engine
  const attempt = simulateMission(newInput);

  if (attempt.kind === 'rejected') {
    const blockerMsgs = attempt.feasibility.blockers.map((b) => b.message).join('; ');
    return {
      kind: 'rejected',
      reason: `Branch rejected by engineering feasibility: ${blockerMsgs}`,
      attempt,
    };
  }

  // 9. Successfully create new universe
  const newUniverse: Universe = {
    id,
    parentId: parent.id,
    input: newInput,
    result: attempt.result,
    change: { ...change },
    createdAt,
  };

  return {
    kind: 'created',
    universe: newUniverse,
  };
}

/**
 * Compares two universes side-by-side.
 * Computes deltas across resources, science, score, outcome, and events.
 */
export function compareUniverses(a: Universe, b: Universe): UniverseComparison {
  const changedFields: MutableField[] = [];
  const changes: Array<{ field: MutableField; valueA: string; valueB: string }> = [];

  for (const field of VALID_MUTABLE_FIELDS) {
    let valA: string;
    let valB: string;
    if (field in a.input.config) {
      valA = a.input.config[field as ConfigField];
      valB = b.input.config[field as ConfigField];
    } else {
      valA = a.input.decisions[field as DecisionField];
      valB = b.input.decisions[field as DecisionField];
    }

    if (valA !== valB) {
      changedFields.push(field);
      changes.push({ field, valueA: valA, valueB: valB });
    }
  }

  // Resource deltas (B - A)
  const resourceDeltas = {
    costBU: b.result.resources.costBU - a.result.resources.costBU,
    launchMassKg: b.result.resources.launchMassKg - a.result.resources.launchMassKg,
    sunlitScienceMarginW: b.result.resources.sunlitScienceMarginW - a.result.resources.sunlitScienceMarginW,
    sunlitDownlinkMarginW: b.result.resources.sunlitDownlinkMarginW - a.result.resources.sunlitDownlinkMarginW,
    batteryWh: b.result.resources.batteryWh - a.result.resources.batteryWh,
    deltaVMarginMps: b.result.resources.deltaVMarginMps - a.result.resources.deltaVMarginMps,
  };

  // Science deltas (B - A)
  const scienceDelta = {
    collectedSciencePoints: b.result.collectedSciencePoints - a.result.collectedSciencePoints,
    returnedSciencePoints: b.result.returnedSciencePoints - a.result.returnedSciencePoints,
    observationFraction: b.result.observationFraction - a.result.observationFraction,
  };

  // Score deltas (B - A)
  const scoreDelta = {
    mpi: b.result.score.mpi - a.result.score.mpi,
    rawMPI: b.result.score.rawMPI - a.result.score.rawMPI,
    science: b.result.score.science - a.result.score.science,
    efficiency: b.result.score.efficiency - a.result.score.efficiency,
    reliability: b.result.score.reliability - a.result.score.reliability,
    engineering: b.result.score.engineering - a.result.score.engineering,
    operations: b.result.score.operations - a.result.score.operations,
  };

  // Outcome transition
  const outcomeTransition = {
    from: a.result.outcome,
    to: b.result.outcome,
    changed: a.result.outcome !== b.result.outcome,
  };

  // Event comparisons for 'arrival', 'E1', 'E2'
  const eventIds: Array<'arrival' | 'E1' | 'E2'> = ['arrival', 'E1', 'E2'];
  const eventComparisons: Record<string, EventComparison> = {};

  for (const eventId of eventIds) {
    const evA = a.result.events.find((e) => e.id === eventId);
    const evB = b.result.events.find((e) => e.id === eventId);

    const statusA = evA?.status ?? 'missing';
    const statusB = evB?.status ?? 'missing';

    const metricDeltas: Record<string, number> = {};
    if (evA && evB) {
      const allKeys = new Set([...Object.keys(evA.metrics), ...Object.keys(evB.metrics)]);
      for (const k of allKeys) {
        const valA = evA.metrics[k] ?? 0;
        const valB = evB.metrics[k] ?? 0;
        metricDeltas[k] = valB - valA;
      }
    }

    eventComparisons[eventId] = {
      eventId,
      statusA,
      statusB,
      statusChanged: statusA !== statusB,
      metricDeltas,
    };
  }

  return {
    universeIdA: a.id,
    universeIdB: b.id,
    changedFields,
    changes,
    resourceDeltas,
    scienceDelta,
    scoreDelta,
    outcomeTransition,
    eventComparisons,
  };
}
