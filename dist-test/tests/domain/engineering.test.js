"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const engineering_1 = require("../../src/domain/engineering");
(0, node_test_1.describe)('Engineering Subsystem (Ticket T02 & T03)', () => {
    const nominalConfig = {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
    };
    (0, node_test_1.it)('computes exact resource totals for nominal configuration', () => {
        const resources = (0, engineering_1.computeResources)(nominalConfig);
        // Cost: 35 (ice) + 30 (storage) + 30 (prop_high) + 20 (comms_high) = 115 BU
        assert.equal(resources.costBU, 115);
        // Mass: 120 (base) + 65 (ice) + 75 (storage) + 105 (prop_high) + 30 (comms_high) = 395 kg
        assert.equal(resources.launchMassKg, 395);
        // Sunlit science load: 30 (base) + 85 (ice) = 115 W
        assert.equal(resources.sunlitScienceLoadW, 115);
        // Sunlit science margin: 190 - 115 = 75 W
        assert.equal(resources.sunlitScienceMarginW, 75);
        // Downlink load: 30 (base) + 40 (comms_high) = 70 W
        assert.equal(resources.downlinkLoadW, 70);
        // Downlink margin: 190 - 70 = 120 W
        assert.equal(resources.sunlitDownlinkMarginW, 120);
        // Delta-V margin: 1150 - 1000 = 150 m/s
        assert.equal(resources.deltaVMarginMps, 150);
        // Battery: 400 Wh
        assert.equal(resources.batteryWh, 400);
    });
    (0, node_test_1.it)('evaluates feasibility and warnings accurately', () => {
        const report = (0, engineering_1.evaluateFeasibility)(nominalConfig);
        assert.equal(report.eligible, true);
        assert.equal(report.blockers.length, 0);
        // For nominal, margins are generous: science margin 75 >= 15, delta-v 150 >= 100, battery 400 >= 230
        assert.equal(report.warnings.length, 0);
    });
    (0, node_test_1.it)('triggers delta_v_margin warning when reserve is < 100 m/s', () => {
        const lowPropEfficient = {
            ...nominalConfig,
            propulsionId: 'prop_low',
            trajectoryId: 'efficient', // 750 - 700 = 50 m/s margin
        };
        const report = (0, engineering_1.evaluateFeasibility)(lowPropEfficient);
        assert.equal(report.eligible, true);
        const dvWarning = report.warnings.find((w) => w.id === 'delta_v_margin');
        assert.ok(dvWarning);
        assert.equal(dvWarning?.actual, 50);
        assert.equal(dvWarning?.threshold, 100);
    });
    (0, node_test_1.it)('triggers battery_endurance warning when battery cannot sustain full shadow science pass', () => {
        const lightSolarConfig = {
            ...nominalConfig,
            powerId: 'solar_light', // 80 Wh battery vs (30 + 85)*2 = 230 Wh required
        };
        const report = (0, engineering_1.evaluateFeasibility)(lightSolarConfig);
        assert.equal(report.eligible, true);
        const batteryWarning = report.warnings.find((w) => w.id === 'battery_endurance');
        assert.ok(batteryWarning);
        assert.equal(batteryWarning?.actual, 80);
        assert.equal(batteryWarning?.threshold, 230);
    });
    (0, node_test_1.it)('blocks launch when delta-v margin is negative (prop_low + direct)', () => {
        const infeasibleConfig = {
            ...nominalConfig,
            propulsionId: 'prop_low',
            trajectoryId: 'direct', // 750 - 1000 = -250 m/s
        };
        const report = (0, engineering_1.evaluateFeasibility)(infeasibleConfig);
        assert.equal(report.eligible, false);
        assert.ok(report.blockers.some((b) => b.id === 'BLOCKER_PROPULSION_DEFICIT'));
    });
    (0, node_test_1.it)('hashConfig is insensitive to object key insertion order and deterministic', () => {
        const config1 = {
            payloadId: 'ice_spectrometer',
            powerId: 'solar_storage',
            propulsionId: 'prop_high',
            commsId: 'comms_high',
            trajectoryId: 'direct',
        };
        // Reorder keys
        const config2 = {
            trajectoryId: 'direct',
            commsId: 'comms_high',
            propulsionId: 'prop_high',
            powerId: 'solar_storage',
            payloadId: 'ice_spectrometer',
        };
        const hash1 = (0, engineering_1.hashConfig)(config1);
        const hash2 = (0, engineering_1.hashConfig)(config2);
        assert.equal(hash1, hash2);
        // Different config produces different hash
        const config3 = { ...config1, commsId: 'comms_basic' };
        assert.notEqual(hash1, (0, engineering_1.hashConfig)(config3));
    });
});
