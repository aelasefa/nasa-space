"use strict";
// Component catalog and mission constants for LUNA-01
// Source of truth: GAME_RULES.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRAJECTORY_CATALOG = exports.COMMS_CATALOG = exports.PROPULSION_CATALOG = exports.POWER_CATALOG = exports.PAYLOAD_CATALOG = exports.DATA_PROVENANCE = exports.DEFAULT_MODEL_VERSION = exports.DEFAULT_SCENARIO_ID = exports.BASE_SURVIVAL_ENERGY_WH = exports.E1_OBSERVATION_DURATION_HOURS = exports.BASE_BUS_SHADOW_LOAD_W = exports.BASE_BUS_SUNLIT_LOAD_W = exports.BASE_BUS_MASS_KG = exports.LAUNCH_MASS_CAP_KG = exports.BUDGET_CAP_BU = void 0;
exports.BUDGET_CAP_BU = 120;
exports.LAUNCH_MASS_CAP_KG = 500;
exports.BASE_BUS_MASS_KG = 120;
exports.BASE_BUS_SUNLIT_LOAD_W = 30;
exports.BASE_BUS_SHADOW_LOAD_W = 30;
exports.E1_OBSERVATION_DURATION_HOURS = 2;
exports.BASE_SURVIVAL_ENERGY_WH = exports.BASE_BUS_SHADOW_LOAD_W * exports.E1_OBSERVATION_DURATION_HOURS; // 60 Wh
exports.DEFAULT_SCENARIO_ID = 'lunar_south_pole_ice_v1';
exports.DEFAULT_MODEL_VERSION = '0.1.0';
exports.DATA_PROVENANCE = 'illustrative';
exports.PAYLOAD_CATALOG = {
    mapping_camera: {
        id: 'mapping_camera',
        display: 'Mapping camera',
        costBU: 18,
        massKg: 35,
        activeLoadW: 35,
        isIceSensitive: false,
        capability: 'Contextual mapping only; primary ice objective not met',
    },
    ice_spectrometer: {
        id: 'ice_spectrometer',
        display: 'Ice-sensitive spectrometer',
        costBU: 35,
        massKg: 65,
        activeLoadW: 85,
        isIceSensitive: true,
        capability: 'Primary water-ice investigation',
    },
};
exports.POWER_CATALOG = {
    solar_light: {
        id: 'solar_light',
        display: 'Lightweight solar',
        costBU: 15,
        massKg: 35,
        generationW: 150,
        usableBatteryWh: 80,
    },
    solar_storage: {
        id: 'solar_storage',
        display: 'Solar + storage',
        costBU: 30,
        massKg: 75,
        generationW: 190,
        usableBatteryWh: 400,
    },
};
exports.PROPULSION_CATALOG = {
    prop_low: {
        id: 'prop_low',
        display: 'Low reserve',
        costBU: 18,
        massKg: 60,
        availableDeltaVMps: 750,
    },
    prop_high: {
        id: 'prop_high',
        display: 'High reserve',
        costBU: 30,
        massKg: 105,
        availableDeltaVMps: 1150,
    },
};
exports.COMMS_CATALOG = {
    comms_basic: {
        id: 'comms_basic',
        display: 'Basic antenna',
        costBU: 10,
        massKg: 15,
        downlinkLoadW: 20,
        maxScienceDownlinkPoints: 60,
    },
    comms_high: {
        id: 'comms_high',
        display: 'High-throughput antenna',
        costBU: 20,
        massKg: 30,
        downlinkLoadW: 40,
        maxScienceDownlinkPoints: 100,
    },
};
exports.TRAJECTORY_CATALOG = {
    direct: {
        id: 'direct',
        display: 'Direct transfer',
        requiredDeltaVMps: 1000,
        narrativeTravelTime: '72 h',
        provenance: 'illustrative',
    },
    efficient: {
        id: 'efficient',
        display: 'Efficient transfer',
        requiredDeltaVMps: 700,
        narrativeTravelTime: '120 h',
        provenance: 'illustrative',
    },
};
