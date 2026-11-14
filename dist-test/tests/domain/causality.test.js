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
(0, node_test_1.describe)('Causal Findings Subsystem (Ticket T05)', () => {
    (0, node_test_1.it)('generates structured causal findings for nominal success', () => {
        const input = {
            config: {
                payloadId: 'ice_spectrometer',
                powerId: 'solar_storage',
                propulsionId: 'prop_high',
                commsId: 'comms_high',
                trajectoryId: 'direct',
            },
            decisions: {
                observeAction: 'observe_full',
                downlinkAction: 'science_first',
            },
            scenarioId: 'lunar_south_pole_ice_v1',
            modelVersion: '0.1.0',
        };
        const attempt = (0, simulation_1.simulateMission)(input);
        assert.equal(attempt.kind, 'completed');
        if (attempt.kind !== 'completed')
            return;
        const { causes } = attempt.result;
        assert.ok(causes.some((c) => c.id === 'CF_ORBITAL_INSERTION'));
        assert.ok(causes.some((c) => c.id === 'CF_OBSERVATION_NOMINAL'));
        assert.ok(causes.some((c) => c.id === 'CF_PRIMARY_OBJECTIVE_ACHIEVED'));
        for (const cause of causes) {
            assert.ok(cause.id);
            assert.ok(cause.sourceField);
            assert.ok(cause.constraintId);
            assert.ok(cause.eventId);
            assert.ok(cause.effect);
            assert.ok(['info', 'warning', 'failure'].includes(cause.severity));
            assert.equal(cause.modelSource, 'illustrative');
        }
    });
    (0, node_test_1.it)('generates science cutoff and downlink bottleneck causal findings', () => {
        // 1. Cutoff test: solar_light causes science cutoff
        const cutoffInput = {
            config: {
                payloadId: 'ice_spectrometer',
                powerId: 'solar_light',
                propulsionId: 'prop_high',
                commsId: 'comms_high',
                trajectoryId: 'direct',
            },
            decisions: {
                observeAction: 'observe_full',
                downlinkAction: 'science_first',
            },
            scenarioId: 'lunar_south_pole_ice_v1',
            modelVersion: '0.1.0',
        };
        const cutoffAttempt = (0, simulation_1.simulateMission)(cutoffInput);
        assert.equal(cutoffAttempt.kind, 'completed');
        if (cutoffAttempt.kind !== 'completed')
            return;
        const cutoffCause = cutoffAttempt.result.causes.find((c) => c.id === 'CF_SCIENCE_CUTOFF');
        assert.ok(cutoffCause);
        assert.equal(cutoffCause?.sourceField, 'powerId');
        assert.equal(cutoffCause?.severity, 'warning');
        assert.equal(cutoffCause?.eventId, 'E1');
        // 2. Downlink bottleneck test: solar_storage (100 pts) + comms_basic (60 pts cap)
        const bottleneckInput = {
            config: {
                payloadId: 'ice_spectrometer',
                powerId: 'solar_storage',
                propulsionId: 'prop_high',
                commsId: 'comms_basic',
                trajectoryId: 'direct',
            },
            decisions: {
                observeAction: 'observe_full',
                downlinkAction: 'science_first',
            },
            scenarioId: 'lunar_south_pole_ice_v1',
            modelVersion: '0.1.0',
        };
        const bottleneckAttempt = (0, simulation_1.simulateMission)(bottleneckInput);
        assert.equal(bottleneckAttempt.kind, 'completed');
        if (bottleneckAttempt.kind !== 'completed')
            return;
        const downlinkCause = bottleneckAttempt.result.causes.find((c) => c.id === 'CF_DOWNLINK_BOTTLENECK');
        assert.ok(downlinkCause);
        assert.equal(downlinkCause?.sourceField, 'commsId');
        assert.equal(downlinkCause?.severity, 'warning');
        assert.equal(downlinkCause?.eventId, 'E2');
    });
    (0, node_test_1.it)('generates non-ice payload failure finding when camera is selected', () => {
        const input = {
            config: {
                payloadId: 'mapping_camera',
                powerId: 'solar_storage',
                propulsionId: 'prop_high',
                commsId: 'comms_high',
                trajectoryId: 'direct',
            },
            decisions: {
                observeAction: 'observe_full',
                downlinkAction: 'science_first',
            },
            scenarioId: 'lunar_south_pole_ice_v1',
            modelVersion: '0.1.0',
        };
        const attempt = (0, simulation_1.simulateMission)(input);
        assert.equal(attempt.kind, 'completed');
        if (attempt.kind !== 'completed')
            return;
        const cameraCause = attempt.result.causes.find((c) => c.id === 'CF_NON_ICE_PAYLOAD');
        assert.ok(cameraCause);
        assert.equal(cameraCause?.sourceField, 'payloadId');
        assert.equal(cameraCause?.severity, 'failure');
    });
});
