"use strict";
// Deterministic mission simulation engine for LUNA-01
// Source of truth: GAME_RULES.md (Sections 5 & 6) and DOMAIN_CONTRACTS.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveObservation = resolveObservation;
exports.resolveDownlink = resolveDownlink;
exports.evaluateOutcome = evaluateOutcome;
exports.simulateMission = simulateMission;
const catalog_1 = require("../data/catalog");
const engineering_1 = require("./engineering");
const scoring_1 = require("./scoring");
const causality_1 = require("./causality");
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}
/**
 * Resolves Event E1: Low-illumination observation window (2 hours).
 * Evaluates battery energy, base bus reserve, and observation fraction.
 */
function resolveObservation(config, action) {
    const payload = catalog_1.PAYLOAD_CATALOG[config.payloadId];
    const power = catalog_1.POWER_CATALOG[config.powerId];
    if (!payload || !power) {
        throw new Error('Invalid payload or power ID in configuration');
    }
    const baseEnergyWh = catalog_1.BASE_SURVIVAL_ENERGY_WH; // 60 Wh (30 W * 2 h)
    const batteryWh = power.usableBatteryWh;
    let observationFraction = 0;
    let status = 'nominal';
    let description = '';
    if (batteryWh < baseEnergyWh) {
        status = 'bus_energy_failure';
        observationFraction = 0;
        description = `Spacecraft bus survival energy depleted during shadow pass (${batteryWh} Wh < ${baseEnergyWh} Wh needed); safe-mode triggered with zero science return.`;
    }
    else if (action === 'conserve') {
        status = 'conserved';
        observationFraction = 0.50;
        description = 'Observation suspended during shadow pass to preserve bus reserves; 50% baseline sunlit science completed.';
    }
    else {
        // observe_full
        const payloadEnergyAvailableWh = batteryWh - baseEnergyWh;
        const payloadEnergyRequiredWh = payload.activeLoadW * catalog_1.E1_OBSERVATION_DURATION_HOURS;
        const fractionSupported = clamp(payloadEnergyAvailableWh / payloadEnergyRequiredWh, 0, 1);
        observationFraction = 0.50 + 0.50 * fractionSupported;
        if (observationFraction < 1) {
            status = 'science_cutoff';
            description = `Battery depleted during active shadow pass (${batteryWh} Wh total, ${payloadEnergyAvailableWh} Wh for payload vs ${payloadEnergyRequiredWh} Wh required); safe-mode cutoff at ${Math.round(observationFraction * 100)}% observation.`;
        }
        else {
            status = 'nominal';
            description = `Full 2-hour shadow observation window nominal; 100% science coverage achieved with ${batteryWh} Wh battery storage.`;
        }
    }
    const event = {
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
function resolveDownlink(config, action, observationFraction) {
    const payload = catalog_1.PAYLOAD_CATALOG[config.payloadId];
    const comms = catalog_1.COMMS_CATALOG[config.commsId];
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
    }
    else if (isLimited) {
        description = `Downlink limited by antenna capacity (${scienceDownlinkCapacity} pts max with ${action}); returned ${returnedSciencePoints} of ${collectedSciencePoints} collected points.`;
    }
    else {
        description = `Downlink nominal; full collected science package transmitted (${returnedSciencePoints} points returned).`;
    }
    const event = {
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
function evaluateOutcome(returnedSciencePoints, observationStatus) {
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
function simulateMission(input) {
    // Validate scenario
    if (input.scenarioId !== catalog_1.DEFAULT_SCENARIO_ID) {
        throw new Error(`Unsupported scenario ID: ${input.scenarioId}`);
    }
    // Validate feasibility
    const feasibility = (0, engineering_1.evaluateFeasibility)(input.config);
    if (!feasibility.eligible) {
        return {
            kind: 'rejected',
            input,
            feasibility,
        };
    }
    const trajectory = catalog_1.TRAJECTORY_CATALOG[input.config.trajectoryId];
    const propulsion = catalog_1.PROPULSION_CATALOG[input.config.propulsionId];
    const resources = (0, engineering_1.computeResources)(input.config);
    // Event: Arrival
    const arrivalEvent = {
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
    const events = [arrivalEvent, obs.event, down.event];
    const outcome = evaluateOutcome(down.returnedSciencePoints, obs.status);
    // Compute scoring breakdown
    const score = (0, scoring_1.computeMPI)(input, resources, events, down.returnedSciencePoints, outcome, feasibility.warnings);
    const resultWithoutCauses = {
        outcome,
        resources,
        observationFraction: obs.observationFraction,
        collectedSciencePoints: down.collectedSciencePoints,
        returnedSciencePoints: down.returnedSciencePoints,
        scienceReturn: down.returnedSciencePoints / 100,
        events,
        score,
    };
    const causes = (0, causality_1.buildCausalFindings)(input, resultWithoutCauses);
    const result = {
        ...resultWithoutCauses,
        causes,
    };
    return {
        kind: 'completed',
        input,
        result,
    };
}
