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
const reviews_1 = require("../../src/domain/reviews");
const engineering_1 = require("../../src/domain/engineering");
(0, node_test_1.describe)('CML Reviews Subsystem (Ticket T08)', () => {
    const validConfig = {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
    };
    const alternativeConfig = {
        ...validConfig,
        propulsionId: 'prop_low',
        trajectoryId: 'efficient',
    };
    const validEvidence = {
        configHash: (0, engineering_1.hashConfig)(validConfig),
        tradeStudy: {
            configHashA: (0, engineering_1.hashConfig)(validConfig),
            configHashB: (0, engineering_1.hashConfig)(alternativeConfig),
            chosenConfigHash: (0, engineering_1.hashConfig)(validConfig),
            rationale: 'risk',
        },
        acknowledgedWarnings: [],
    };
    (0, node_test_1.it)('authorizes launch when all CML 1-4 requirements pass', () => {
        const report = (0, reviews_1.evaluateReviews)(validConfig, validEvidence);
        assert.equal(report.authorized, true);
        assert.equal(report.gates.CML1.passed, true);
        assert.equal(report.gates.CML2.passed, true);
        assert.equal(report.gates.CML3.passed, true);
        assert.equal(report.gates.CML4.passed, true);
    });
    (0, node_test_1.it)('rejects CML 1 when mapping_camera is selected', () => {
        const cameraConfig = { ...validConfig, payloadId: 'mapping_camera' };
        const evidence = {
            configHash: (0, engineering_1.hashConfig)(cameraConfig),
            tradeStudy: {
                configHashA: (0, engineering_1.hashConfig)(cameraConfig),
                configHashB: (0, engineering_1.hashConfig)(alternativeConfig),
                chosenConfigHash: (0, engineering_1.hashConfig)(cameraConfig),
                rationale: 'cost',
            },
            acknowledgedWarnings: [],
        };
        const report = (0, reviews_1.evaluateReviews)(cameraConfig, evidence);
        assert.equal(report.gates.CML1.passed, false);
        assert.equal(report.authorized, false);
    });
    (0, node_test_1.it)('rejects CML 2 when engineering feasibility has blockers', () => {
        const infeasibleConfig = {
            ...validConfig,
            propulsionId: 'prop_low',
            trajectoryId: 'direct', // delta-v blocker
        };
        const evidence = {
            configHash: (0, engineering_1.hashConfig)(infeasibleConfig),
            acknowledgedWarnings: [],
        };
        const report = (0, reviews_1.evaluateReviews)(infeasibleConfig, evidence);
        assert.equal(report.gates.CML2.passed, false);
        assert.equal(report.authorized, false);
    });
    (0, node_test_1.it)('rejects CML 3 when trade study is missing or compares identical configs', () => {
        const noTradeStudy = {
            configHash: (0, engineering_1.hashConfig)(validConfig),
            acknowledgedWarnings: [],
        };
        assert.equal((0, reviews_1.evaluateReviews)(validConfig, noTradeStudy).gates.CML3.passed, false);
        const identicalTradeStudy = {
            configHash: (0, engineering_1.hashConfig)(validConfig),
            tradeStudy: {
                configHashA: (0, engineering_1.hashConfig)(validConfig),
                configHashB: (0, engineering_1.hashConfig)(validConfig),
                chosenConfigHash: (0, engineering_1.hashConfig)(validConfig),
                rationale: 'science',
            },
            acknowledgedWarnings: [],
        };
        assert.equal((0, reviews_1.evaluateReviews)(validConfig, identicalTradeStudy).gates.CML3.passed, false);
    });
    (0, node_test_1.it)('rejects CML 4 when warnings are unacknowledged', () => {
        // Config with warnings: prop_low + efficient has delta_v_margin warning
        const warningConfig = {
            ...validConfig,
            propulsionId: 'prop_low',
            trajectoryId: 'efficient',
        };
        const unacknowledgedEvidence = {
            configHash: (0, engineering_1.hashConfig)(warningConfig),
            tradeStudy: {
                configHashA: (0, engineering_1.hashConfig)(warningConfig),
                configHashB: (0, engineering_1.hashConfig)(validConfig),
                chosenConfigHash: (0, engineering_1.hashConfig)(warningConfig),
                rationale: 'mass',
            },
            acknowledgedWarnings: [], // empty -> unacknowledged
        };
        const report = (0, reviews_1.evaluateReviews)(warningConfig, unacknowledgedEvidence);
        assert.equal(report.gates.CML4.passed, false);
        assert.equal(report.authorized, false);
        assert.ok(report.gates.CML4.findings.some((f) => f.id.includes('DELTA_V_MARGIN')));
        // Acknowledging the warning allows CML 4 to pass
        const acknowledgedEvidence = {
            ...unacknowledgedEvidence,
            acknowledgedWarnings: ['delta_v_margin'],
        };
        const report2 = (0, reviews_1.evaluateReviews)(warningConfig, acknowledgedEvidence);
        assert.equal(report2.gates.CML4.passed, true);
        assert.equal(report2.authorized, true);
    });
    (0, node_test_1.it)('detects stale evidence when config changes after review', () => {
        assert.equal((0, reviews_1.isReviewEvidenceStale)(validConfig, validEvidence), false);
        const modifiedConfig = { ...validConfig, commsId: 'comms_basic' };
        assert.equal((0, reviews_1.isReviewEvidenceStale)(modifiedConfig, validEvidence), true);
        const staleReport = (0, reviews_1.evaluateReviews)(modifiedConfig, validEvidence);
        assert.equal(staleReport.gates.CML4.passed, false);
        assert.equal(staleReport.authorized, false);
    });
});
