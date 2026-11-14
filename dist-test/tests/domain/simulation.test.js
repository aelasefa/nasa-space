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
const simulation_1 = require("../../src/domain/simulation");
(0, node_test_1.describe)('Mission Simulation Subsystem (Ticket T04)', () => {
    const nominalConfig = {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
    };
    (0, node_test_1.it)('resolves nominal observe_full when battery is sufficient', () => {
        const obs = (0, simulation_1.resolveObservation)(nominalConfig, 'observe_full');
        assert.equal(obs.status, 'nominal');
        assert.equal(obs.observationFraction, 1.0);
        assert.equal(obs.event.id, 'E1');
    });
    (0, node_test_1.it)('resolves conserved observation with 0.50 fraction', () => {
        const obs = (0, simulation_1.resolveObservation)(nominalConfig, 'conserve');
        assert.equal(obs.status, 'conserved');
        assert.equal(obs.observationFraction, 0.50);
    });
    (0, node_test_1.it)('resolves science_cutoff when battery is depleted mid-window', () => {
        const lightSolarConfig = {
            ...nominalConfig,
            powerId: 'solar_light', // 80 Wh total, 60 Wh base, 20 Wh for payload
        };
        const obs = (0, simulation_1.resolveObservation)(lightSolarConfig, 'observe_full');
        assert.equal(obs.status, 'science_cutoff');
        // 0.50 + 0.50 * (20 / 170) ≈ 0.5588235
        assert.ok(obs.observationFraction > 0.50 && obs.observationFraction < 1.0);
    });
    (0, node_test_1.it)('resolves downlink for ice spectrometer and full capacity', () => {
        const down = (0, simulation_1.resolveDownlink)(nominalConfig, 'science_first', 1.0);
        assert.equal(down.collectedSciencePoints, 100);
        assert.equal(down.returnedSciencePoints, 100);
        assert.equal(down.event.status, 'nominal');
    });
    (0, node_test_1.it)('resolves downlink for basic comms capping data at 60 points', () => {
        const basicCommsConfig = {
            ...nominalConfig,
            commsId: 'comms_basic',
        };
        const down = (0, simulation_1.resolveDownlink)(basicCommsConfig, 'science_first', 1.0);
        assert.equal(down.collectedSciencePoints, 100);
        assert.equal(down.returnedSciencePoints, 60);
        assert.equal(down.event.status, 'downlink_limited');
    });
    (0, node_test_1.it)('resolves downlink for health_first applying 60% capacity factor', () => {
        const down = (0, simulation_1.resolveDownlink)(nominalConfig, 'health_first', 1.0);
        assert.equal(down.collectedSciencePoints, 100);
        assert.equal(down.returnedSciencePoints, 60); // 100 * 0.60
    });
    (0, node_test_1.it)('resolves downlink for mapping camera returning 0 ice science points', () => {
        const cameraConfig = {
            ...nominalConfig,
            payloadId: 'mapping_camera',
        };
        const down = (0, simulation_1.resolveDownlink)(cameraConfig, 'science_first', 1.0);
        assert.equal(down.collectedSciencePoints, 0);
        assert.equal(down.returnedSciencePoints, 0);
    });
    (0, node_test_1.it)('evaluates outcome categories accurately', () => {
        assert.equal((0, simulation_1.evaluateOutcome)(100, 'nominal'), 'success');
        assert.equal((0, simulation_1.evaluateOutcome)(80, 'nominal'), 'success');
        assert.equal((0, simulation_1.evaluateOutcome)(79.9, 'nominal'), 'partial');
        assert.equal((0, simulation_1.evaluateOutcome)(50, 'conserved'), 'partial');
        assert.equal((0, simulation_1.evaluateOutcome)(0, 'nominal'), 'failure');
        assert.equal((0, simulation_1.evaluateOutcome)(85, 'bus_energy_failure'), 'failure');
    });
    (0, node_test_1.it)('produces an ordered event trace: arrival -> E1 -> E2', () => {
        const attempt = (0, simulation_1.simulateMission)({
            config: nominalConfig,
            decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
            scenarioId: 'lunar_south_pole_ice_v1',
            modelVersion: '0.1.0',
        });
        assert.equal(attempt.kind, 'completed');
        if (attempt.kind !== 'completed')
            return;
        const eventIds = attempt.result.events.map((e) => e.id);
        assert.deepEqual(eventIds, ['arrival', 'E1', 'E2']);
    });
});
