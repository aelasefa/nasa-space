"use strict";
// Engineering calculations and feasibility evaluation for LUNA-01
// Source of truth: GAME_RULES.md (Sections 3 & 4) and DOMAIN_CONTRACTS.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeResources = computeResources;
exports.evaluateFeasibility = evaluateFeasibility;
exports.hashConfig = hashConfig;
const catalog_1 = require("../data/catalog");
/**
 * Computes deterministic spacecraft resource totals and margins.
 */
function computeResources(config) {
    const payload = catalog_1.PAYLOAD_CATALOG[config.payloadId];
    const power = catalog_1.POWER_CATALOG[config.powerId];
    const propulsion = catalog_1.PROPULSION_CATALOG[config.propulsionId];
    const comms = catalog_1.COMMS_CATALOG[config.commsId];
    const trajectory = catalog_1.TRAJECTORY_CATALOG[config.trajectoryId];
    if (!payload || !power || !propulsion || !comms || !trajectory) {
        throw new Error('Unknown component or trajectory ID in spacecraft configuration');
    }
    const costBU = payload.costBU + power.costBU + propulsion.costBU + comms.costBU;
    const launchMassKg = catalog_1.BASE_BUS_MASS_KG + payload.massKg + power.massKg + propulsion.massKg + comms.massKg;
    const sunlitScienceLoadW = catalog_1.BASE_BUS_SUNLIT_LOAD_W + payload.activeLoadW;
    const sunlitScienceMarginW = power.generationW - sunlitScienceLoadW;
    const downlinkLoadW = catalog_1.BASE_BUS_SUNLIT_LOAD_W + comms.downlinkLoadW;
    const sunlitDownlinkMarginW = power.generationW - downlinkLoadW;
    const deltaVMarginMps = propulsion.availableDeltaVMps - trajectory.requiredDeltaVMps;
    const batteryWh = power.usableBatteryWh;
    return {
        costBU,
        launchMassKg,
        sunlitScienceLoadW,
        sunlitScienceMarginW,
        downlinkLoadW,
        sunlitDownlinkMarginW,
        deltaVMarginMps,
        batteryWh,
    };
}
/**
 * Evaluates engineering feasibility blockers and warnings.
 * Equality passes for resource constraints.
 */
function evaluateFeasibility(config) {
    const payload = catalog_1.PAYLOAD_CATALOG[config.payloadId];
    const power = catalog_1.POWER_CATALOG[config.powerId];
    const propulsion = catalog_1.PROPULSION_CATALOG[config.propulsionId];
    const comms = catalog_1.COMMS_CATALOG[config.commsId];
    const trajectory = catalog_1.TRAJECTORY_CATALOG[config.trajectoryId];
    const blockers = [];
    const warnings = [];
    // Missing or invalid selections
    if (!payload) {
        blockers.push({
            id: 'BLOCKER_MISSING_PAYLOAD',
            severity: 'blocker',
            sourceField: 'payloadId',
            message: 'Missing or unrecognized payload subsystem selection.',
        });
    }
    if (!power) {
        blockers.push({
            id: 'BLOCKER_MISSING_POWER',
            severity: 'blocker',
            sourceField: 'powerId',
            message: 'Missing or unrecognized power subsystem selection.',
        });
    }
    if (!propulsion) {
        blockers.push({
            id: 'BLOCKER_MISSING_PROPULSION',
            severity: 'blocker',
            sourceField: 'propulsionId',
            message: 'Missing or unrecognized propulsion subsystem selection.',
        });
    }
    if (!comms) {
        blockers.push({
            id: 'BLOCKER_MISSING_COMMS',
            severity: 'blocker',
            sourceField: 'commsId',
            message: 'Missing or unrecognized communications subsystem selection.',
        });
    }
    if (!trajectory) {
        blockers.push({
            id: 'BLOCKER_MISSING_TRAJECTORY',
            severity: 'blocker',
            sourceField: 'trajectoryId',
            message: 'Missing or unrecognized trajectory selection.',
        });
    }
    if (blockers.length > 0) {
        return { eligible: false, blockers, warnings };
    }
    const resources = computeResources(config);
    // 1. Budget blocker: costBU > 120
    if (resources.costBU > catalog_1.BUDGET_CAP_BU) {
        blockers.push({
            id: 'BLOCKER_BUDGET_EXCEEDED',
            severity: 'blocker',
            sourceField: 'payloadId',
            message: `Total subsystem cost (${resources.costBU} BU) exceeds budget limit (${catalog_1.BUDGET_CAP_BU} BU).`,
            actual: resources.costBU,
            threshold: catalog_1.BUDGET_CAP_BU,
            unit: 'BU',
        });
    }
    // 2. Mass blocker: launchMassKg > 500
    if (resources.launchMassKg > catalog_1.LAUNCH_MASS_CAP_KG) {
        blockers.push({
            id: 'BLOCKER_MASS_EXCEEDED',
            severity: 'blocker',
            sourceField: 'payloadId',
            message: `Launch mass (${resources.launchMassKg} kg) exceeds maximum launch vehicle limit (${catalog_1.LAUNCH_MASS_CAP_KG} kg).`,
            actual: resources.launchMassKg,
            threshold: catalog_1.LAUNCH_MASS_CAP_KG,
            unit: 'kg',
        });
    }
    // 3. Sunlit science power deficit: margin < 0
    if (resources.sunlitScienceMarginW < 0) {
        blockers.push({
            id: 'BLOCKER_SCIENCE_POWER_DEFICIT',
            severity: 'blocker',
            sourceField: 'powerId',
            message: `Sunlit generation (${power.generationW} W) is insufficient for base + payload science load (${resources.sunlitScienceLoadW} W).`,
            actual: resources.sunlitScienceMarginW,
            threshold: 0,
            unit: 'W',
        });
    }
    // 4. Sunlit downlink power deficit: margin < 0
    if (resources.sunlitDownlinkMarginW < 0) {
        blockers.push({
            id: 'BLOCKER_DOWNLINK_POWER_DEFICIT',
            severity: 'blocker',
            sourceField: 'powerId',
            message: `Sunlit generation (${power.generationW} W) is insufficient for base + communications downlink load (${resources.downlinkLoadW} W).`,
            actual: resources.sunlitDownlinkMarginW,
            threshold: 0,
            unit: 'W',
        });
    }
    // 5. Delta-V deficit: margin < 0
    if (resources.deltaVMarginMps < 0) {
        blockers.push({
            id: 'BLOCKER_PROPULSION_DEFICIT',
            severity: 'blocker',
            sourceField: 'propulsionId',
            message: `Propulsion maneuver capacity (${propulsion.availableDeltaVMps} m/s) is insufficient for ${trajectory.display} requirement (${trajectory.requiredDeltaVMps} m/s).`,
            actual: resources.deltaVMarginMps,
            threshold: 0,
            unit: 'm/s',
        });
    }
    // Warnings (not blockers)
    // Warning 1: power margin < 15 W (WarningId: 'power_margin')
    const minPowerMargin = Math.min(resources.sunlitScienceMarginW, resources.sunlitDownlinkMarginW);
    if (minPowerMargin < 15 && resources.sunlitScienceMarginW >= 0 && resources.sunlitDownlinkMarginW >= 0) {
        warnings.push({
            id: 'power_margin',
            severity: 'warning',
            sourceField: 'powerId',
            message: `Tight sunlit power margin (< 15 W): minimum margin is ${minPowerMargin} W.`,
            actual: minPowerMargin,
            threshold: 15,
            unit: 'W',
        });
    }
    // Warning 2: delta-v margin < 100 m/s (WarningId: 'delta_v_margin')
    if (resources.deltaVMarginMps < 100 && resources.deltaVMarginMps >= 0) {
        warnings.push({
            id: 'delta_v_margin',
            severity: 'warning',
            sourceField: 'propulsionId',
            message: `Tight delta-v reserve (< 100 m/s): available reserve margin is ${resources.deltaVMarginMps} m/s.`,
            actual: resources.deltaVMarginMps,
            threshold: 100,
            unit: 'm/s',
        });
    }
    // Warning 3: battery endurance unable to sustain full 2-hour shadow science interval (WarningId: 'battery_endurance')
    const fullShadowEnergyRequiredWh = (catalog_1.BASE_BUS_SHADOW_LOAD_W + payload.activeLoadW) * catalog_1.E1_OBSERVATION_DURATION_HOURS;
    if (resources.batteryWh < fullShadowEnergyRequiredWh) {
        warnings.push({
            id: 'battery_endurance',
            severity: 'warning',
            sourceField: 'powerId',
            message: `Battery storage (${resources.batteryWh} Wh) cannot sustain full 2-hour shadow observation (${fullShadowEnergyRequiredWh} Wh needed). Safe-mode cutoff will occur during observe_full.`,
            actual: resources.batteryWh,
            threshold: fullShadowEnergyRequiredWh,
            unit: 'Wh',
        });
    }
    return {
        eligible: blockers.length === 0,
        blockers,
        warnings,
    };
}
/**
 * Computes a stable configuration hash insensitive to object key order.
 */
function hashConfig(config) {
    const canonical = [
        `comms:${config.commsId}`,
        `payload:${config.payloadId}`,
        `power:${config.powerId}`,
        `propulsion:${config.propulsionId}`,
        `trajectory:${config.trajectoryId}`,
    ].sort().join('|');
    let h1 = 0x811c9dc5;
    let h2 = 0x84222325;
    for (let i = 0; i < canonical.length; i++) {
        const ch = canonical.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x01000193);
        h2 = Math.imul(h2 ^ (ch >>> 1), 0x01000193);
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `cfg_${hex1}${hex2}`;
}
