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
const scoring_1 = require("../../src/domain/scoring");
(0, node_test_1.describe)('Mission Scoring Subsystem (Ticket T05)', () => {
    const nominalInput = {
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
    const nominalResources = {
        costBU: 115,
        launchMassKg: 395,
        sunlitScienceLoadW: 115,
        sunlitScienceMarginW: 75,
        downlinkLoadW: 70,
        sunlitDownlinkMarginW: 120,
        deltaVMarginMps: 150,
        batteryWh: 400,
    };
    const nominalEvents = [
        { id: 'arrival', status: 'nominal', description: 'Arrival', metrics: {} },
        { id: 'E1', status: 'nominal', description: 'E1', metrics: {} },
        { id: 'E2', status: 'nominal', description: 'E2', metrics: {} },
    ];
    (0, node_test_1.it)('computes 5 category subscores correctly for nominal mission', () => {
        const score = (0, scoring_1.computeMPI)(nominalInput, nominalResources, nominalEvents, 100, 'success', []);
        // Science: 100
        assert.equal(score.science, 100);
        // Efficiency:
        // resourceUse = 0.5 * (115/120) + 0.5 * (395/500) = 0.5 * 0.958333 + 0.5 * 0.79 = 0.479166 + 0.395 = 0.874166
        // scienceFraction = 1.0. E = 100 * clamp(1.0 / 0.874166, 0, 1) = 100.
        assert.equal(score.efficiency, 100);
        // Reliability: nominal -> 100
        assert.equal(score.reliability, 100);
        // Engineering: 0 warnings -> 100
        assert.equal(score.engineering, 100);
        // Operations: full observation feasible & observe_full (100), science_first (100) -> 100
        assert.equal(score.operations, 100);
        // rawMPI: 4 * 100 + 2.5 * 100 + 1.5 * 100 + 100 + 100 = 400 + 250 + 150 + 100 + 100 = 1000
        assert.equal(score.rawMPI, 1000);
        assert.equal(score.mpi, 1000);
        assert.equal(score.cap, 1000);
    });
    (0, node_test_1.it)('enforces score caps based on outcome', () => {
        // Partial outcome cap = 749
        const partialScore = (0, scoring_1.computeMPI)(nominalInput, nominalResources, nominalEvents, 70, 'partial', []);
        assert.equal(partialScore.cap, 749);
        assert.ok(partialScore.mpi <= 749);
        // Failure outcome cap = 249
        const failureScore = (0, scoring_1.computeMPI)(nominalInput, nominalResources, nominalEvents, 0, 'failure', []);
        assert.equal(failureScore.cap, 249);
        assert.ok(failureScore.mpi <= 249);
    });
    (0, node_test_1.it)('penalizes engineering score by 20 per accepted warning', () => {
        const dummyWarnings = [
            { id: 'power_margin', severity: 'warning', sourceField: 'powerId', message: 'W1' },
            { id: 'delta_v_margin', severity: 'warning', sourceField: 'propulsionId', message: 'W2' },
        ];
        const score = (0, scoring_1.computeMPI)(nominalInput, nominalResources, nominalEvents, 100, 'success', dummyWarnings);
        // 100 - 20 * 2 = 60
        assert.equal(score.engineering, 60);
    });
    (0, node_test_1.it)('handles zero-science return without division by zero', () => {
        const score = (0, scoring_1.computeMPI)(nominalInput, nominalResources, nominalEvents, 0, 'failure', []);
        assert.equal(score.science, 0);
        assert.equal(score.efficiency, 0);
        assert.equal(score.rawSciencePerResource, 0);
        assert.ok(Number.isFinite(score.mpi));
    });
});
