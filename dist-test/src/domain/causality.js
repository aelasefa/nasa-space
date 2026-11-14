"use strict";
// Deterministic causal explanations for LUNA-01
// Source of truth: GAME_RULES.md (Section 10) and DOMAIN_CONTRACTS.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCausalFindings = buildCausalFindings;
/**
 * Builds structured, deterministic root-cause findings explaining
 * how engineering decisions and operational choices propagated through
 * mission events to scientific outcomes.
 */
function buildCausalFindings(input, resultWithoutCauses) {
    const causes = [];
    // 1. Orbital Arrival Finding
    causes.push({
        id: 'CF_ORBITAL_INSERTION',
        sourceField: 'trajectoryId',
        constraintId: 'trajectory_arrival',
        eventId: 'arrival',
        effect: `Spacecraft completed lunar south-pole orbital insertion via ${input.config.trajectoryId} transfer with ${resultWithoutCauses.resources.deltaVMarginMps} m/s delta-v margin.`,
        severity: 'info',
        modelSource: 'illustrative',
    });
    // 2. Low-illumination Observation Window (E1)
    const e1Event = resultWithoutCauses.events.find((e) => e.id === 'E1');
    if (e1Event?.status === 'bus_energy_failure') {
        causes.push({
            id: 'CF_BUS_ENERGY_FAILURE',
            sourceField: 'powerId',
            constraintId: 'bus_survival_energy',
            eventId: 'E1',
            effect: `Battery capacity (${resultWithoutCauses.resources.batteryWh} Wh) was insufficient for base spacecraft bus survival load (60 Wh) during the 2-hour shadow pass.`,
            severity: 'failure',
            modelSource: 'illustrative',
        });
    }
    else if (e1Event?.status === 'science_cutoff') {
        const collectedPct = Math.round(resultWithoutCauses.observationFraction * 100);
        causes.push({
            id: 'CF_SCIENCE_CUTOFF',
            sourceField: 'powerId',
            constraintId: 'low_illumination_energy',
            eventId: 'E1',
            effect: `Lightweight battery depleted during 2-hour shadow pass, triggering emergency safe-mode shutdown and cutting observation collection to ${collectedPct}%.`,
            severity: 'warning',
            modelSource: 'illustrative',
        });
    }
    else if (e1Event?.status === 'conserved') {
        causes.push({
            id: 'CF_CONSERVED',
            sourceField: 'observeAction',
            constraintId: 'low_illumination_conservation',
            eventId: 'E1',
            effect: `Operational conserve mode suspended active sensing during 2-hour shadow pass, preserving bus energy and completing 50% sunlit observation.`,
            severity: 'info',
            modelSource: 'illustrative',
        });
    }
    else {
        // nominal
        causes.push({
            id: 'CF_OBSERVATION_NOMINAL',
            sourceField: 'powerId',
            constraintId: 'low_illumination_energy',
            eventId: 'E1',
            effect: `Battery storage sustained full active sensor operations through the complete 2-hour low-illumination observation window.`,
            severity: 'info',
            modelSource: 'illustrative',
        });
    }
    // 3. Payload Instrument Compatibility (E2)
    if (input.config.payloadId === 'mapping_camera') {
        causes.push({
            id: 'CF_NON_ICE_PAYLOAD',
            sourceField: 'payloadId',
            constraintId: 'ice_detection_capability',
            eventId: 'E2',
            effect: `Mapping camera lacks ice-absorption spectroscopy capability; returned 0 water-ice science points.`,
            severity: 'failure',
            modelSource: 'illustrative',
        });
    }
    // 4. Downlink & Telemetry Constraints (E2)
    if (resultWithoutCauses.returnedSciencePoints < resultWithoutCauses.collectedSciencePoints) {
        causes.push({
            id: 'CF_DOWNLINK_BOTTLENECK',
            sourceField: 'commsId',
            constraintId: 'downlink_capacity_cap',
            eventId: 'E2',
            effect: `Downlink throughput capped science data return (${resultWithoutCauses.returnedSciencePoints} returned vs ${resultWithoutCauses.collectedSciencePoints} collected).`,
            severity: 'warning',
            modelSource: 'illustrative',
        });
    }
    if (input.decisions.downlinkAction === 'health_first') {
        causes.push({
            id: 'CF_HEALTH_FIRST_BANDWIDTH',
            sourceField: 'downlinkAction',
            constraintId: 'telemetry_bandwidth_split',
            eventId: 'E2',
            effect: `Health-first priority allocated 40% of communications bandwidth to engineering telemetry, reducing science downlink capacity.`,
            severity: 'info',
            modelSource: 'illustrative',
        });
    }
    // 5. Outcome Assessment
    if (resultWithoutCauses.outcome === 'success') {
        causes.push({
            id: 'CF_PRIMARY_OBJECTIVE_ACHIEVED',
            sourceField: 'payloadId',
            constraintId: 'science_target_achievement',
            eventId: 'E2',
            effect: `Mission returned ${resultWithoutCauses.returnedSciencePoints} science points, meeting the >= 80 point threshold for primary scientific mission success.`,
            severity: 'info',
            modelSource: 'illustrative',
        });
    }
    return causes;
}
