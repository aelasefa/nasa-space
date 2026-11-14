"use strict";
// Mission Performance Index (MPI) scoring model for LUNA-01
// Source of truth: GAME_RULES.md (Section 7) and DOMAIN_CONTRACTS.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMPI = computeMPI;
const catalog_1 = require("../data/catalog");
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}
/**
 * Computes the 1,000-point Mission Performance Index (MPI) and category breakdown.
 * Maintains strict separation between physical outcome and score.
 */
function computeMPI(input, resources, events, returnedSciencePoints, outcome, warnings) {
    const payload = catalog_1.PAYLOAD_CATALOG[input.config.payloadId];
    // S — Science return (40%, max 400 normalized to 0-100)
    const science = returnedSciencePoints;
    // E — Resource efficiency (25%, max 250 normalized to 0-100)
    const resourceUse = 0.5 * (resources.costBU / catalog_1.BUDGET_CAP_BU) +
        0.5 * (resources.launchMassKg / catalog_1.LAUNCH_MASS_CAP_KG);
    const scienceFraction = returnedSciencePoints / 100;
    const efficiency = 100 * clamp(scienceFraction / Math.max(resourceUse, 0.45), 0, 1);
    const rawSciencePerResource = resourceUse > 0 ? scienceFraction / resourceUse : 0;
    // R — Reliability (15%, max 150 normalized to 0-100)
    const e1Event = events.find((e) => e.id === 'E1');
    let reliability = 100;
    if (e1Event?.status === 'bus_energy_failure') {
        reliability = 0;
    }
    else if (e1Event?.status === 'science_cutoff') {
        reliability = 60;
    }
    else {
        // nominal or conserved
        reliability = 100;
    }
    // Q — Engineering quality (10%, max 100 normalized to 0-100)
    // Start at 100; subtract 20 for each accepted warning, capped at 0.
    const engineering = Math.max(0, 100 - 20 * warnings.length);
    // O — Operations (10%, max 100 normalized to 0-100)
    // O = 100 for observe_full when full observation is energetically feasible,
    // or conserve when full observation would cause cutoff; otherwise O = 60.
    const fullEnergyNeeded = (catalog_1.BASE_BUS_SHADOW_LOAD_W + payload.activeLoadW) * catalog_1.E1_OBSERVATION_DURATION_HOURS;
    const isFullObservationFeasible = resources.batteryWh >= fullEnergyNeeded;
    let obsRating = 60;
    if (input.decisions.observeAction === 'observe_full') {
        obsRating = isFullObservationFeasible ? 100 : 60;
    }
    else {
        // conserve
        obsRating = isFullObservationFeasible ? 60 : 100;
    }
    // Downlink: science_first earns 100; health_first earns 60
    const downlinkRating = input.decisions.downlinkAction === 'science_first' ? 100 : 60;
    const operations = (obsRating + downlinkRating) / 2;
    // Weighted raw MPI (0-1,000)
    const rawMPI = Math.round(4 * science +
        2.5 * efficiency +
        1.5 * reliability +
        1 * engineering +
        1 * operations);
    // Outcome cap policy:
    // success: max 1000, partial: max 749, failure: max 249
    const cap = outcome === 'success' ? 1000 : outcome === 'partial' ? 749 : 249;
    const mpi = Math.min(rawMPI, cap);
    return {
        science,
        efficiency,
        reliability,
        engineering,
        operations,
        rawMPI,
        mpi,
        cap,
        resourceUse,
        rawSciencePerResource,
    };
}
