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
const domain_1 = require("../../src/domain");
(0, node_test_1.describe)('Exhaustive 128-Combination Simulation Matrix (Ticket T06)', () => {
    const payloads = ['mapping_camera', 'ice_spectrometer'];
    const powers = ['solar_light', 'solar_storage'];
    const propulsions = ['prop_low', 'prop_high'];
    const commsList = ['comms_basic', 'comms_high'];
    const trajectories = ['direct', 'efficient'];
    const observeActions = ['observe_full', 'conserve'];
    const downlinkActions = ['science_first', 'health_first'];
    (0, node_test_1.it)('runs all 128 combinations: validates feasibility, outcome distribution, finite scores, and determinism', () => {
        let totalCombinations = 0;
        let rejectedCount = 0;
        let completedCount = 0;
        let successCount = 0;
        let partialCount = 0;
        let failureCount = 0;
        const firstRunResults = [];
        for (const payloadId of payloads) {
            for (const powerId of powers) {
                for (const propulsionId of propulsions) {
                    for (const commsId of commsList) {
                        for (const trajectoryId of trajectories) {
                            for (const observeAction of observeActions) {
                                for (const downlinkAction of downlinkActions) {
                                    totalCombinations++;
                                    const input = {
                                        config: {
                                            payloadId,
                                            powerId,
                                            propulsionId,
                                            commsId,
                                            trajectoryId,
                                        },
                                        decisions: {
                                            observeAction,
                                            downlinkAction,
                                        },
                                        scenarioId: 'lunar_south_pole_ice_v1',
                                        modelVersion: '0.1.0',
                                    };
                                    const attempt = (0, domain_1.simulateMission)(input);
                                    firstRunResults.push(JSON.stringify(attempt));
                                    if (attempt.kind === 'rejected') {
                                        rejectedCount++;
                                        // Prop low + direct has -250 m/s deltaVMargin
                                        assert.equal(propulsionId, 'prop_low');
                                        assert.equal(trajectoryId, 'direct');
                                        assert.equal(attempt.feasibility.eligible, false);
                                        assert.ok(attempt.feasibility.blockers.some((b) => b.id === 'BLOCKER_PROPULSION_DEFICIT'));
                                    }
                                    else {
                                        completedCount++;
                                        const { result } = attempt;
                                        // Ensure all numerical metrics are finite
                                        assert.ok(Number.isFinite(result.resources.costBU));
                                        assert.ok(Number.isFinite(result.resources.launchMassKg));
                                        assert.ok(Number.isFinite(result.resources.sunlitScienceMarginW));
                                        assert.ok(Number.isFinite(result.resources.batteryWh));
                                        assert.ok(Number.isFinite(result.resources.deltaVMarginMps));
                                        assert.ok(Number.isFinite(result.observationFraction));
                                        assert.ok(Number.isFinite(result.collectedSciencePoints));
                                        assert.ok(Number.isFinite(result.returnedSciencePoints));
                                        assert.ok(Number.isFinite(result.scienceReturn));
                                        assert.ok(Number.isFinite(result.score.mpi));
                                        assert.ok(Number.isFinite(result.score.rawMPI));
                                        assert.ok(Number.isFinite(result.score.resourceUse));
                                        assert.ok(Number.isFinite(result.score.rawSciencePerResource));
                                        // Verify score caps
                                        assert.ok(result.score.mpi <= result.score.cap);
                                        if (result.outcome === 'success') {
                                            assert.equal(result.score.cap, 1000);
                                            assert.ok(result.returnedSciencePoints >= 80);
                                            successCount++;
                                        }
                                        else if (result.outcome === 'partial') {
                                            assert.equal(result.score.cap, 749);
                                            assert.ok(result.returnedSciencePoints > 0 && result.returnedSciencePoints < 80);
                                            partialCount++;
                                        }
                                        else if (result.outcome === 'failure') {
                                            assert.equal(result.score.cap, 249);
                                            assert.equal(result.returnedSciencePoints, 0);
                                            failureCount++;
                                        }
                                        // Verify events
                                        assert.equal(result.events.length, 3);
                                        assert.equal(result.events[0]?.id, 'arrival');
                                        assert.equal(result.events[1]?.id, 'E1');
                                        assert.equal(result.events[2]?.id, 'E2');
                                        // Mapping camera always produces failure (0 ice science)
                                        if (payloadId === 'mapping_camera') {
                                            assert.equal(result.outcome, 'failure');
                                            assert.equal(result.returnedSciencePoints, 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Assert exact combination counts
        assert.equal(totalCombinations, 128);
        // 2 payloads * 2 power * 2 comms * 1 (prop_low + direct) * 4 decisions = 32 rejected
        assert.equal(rejectedCount, 32);
        // 128 - 32 = 96 completed
        assert.equal(completedCount, 96);
        // Verify all 3 flown outcomes are reachable
        assert.ok(successCount > 0, `Expected successCount > 0, got ${successCount}`);
        assert.ok(partialCount > 0, `Expected partialCount > 0, got ${partialCount}`);
        assert.ok(failureCount > 0, `Expected failureCount > 0, got ${failureCount}`);
        assert.equal(successCount + partialCount + failureCount, 96);
        // DETERMINISM CHECK: Second execution must produce 100% byte-for-byte identical output
        let secondIdx = 0;
        for (const payloadId of payloads) {
            for (const powerId of powers) {
                for (const propulsionId of propulsions) {
                    for (const commsId of commsList) {
                        for (const trajectoryId of trajectories) {
                            for (const observeAction of observeActions) {
                                for (const downlinkAction of downlinkActions) {
                                    const input = {
                                        config: { payloadId, powerId, propulsionId, commsId, trajectoryId },
                                        decisions: { observeAction, downlinkAction },
                                        scenarioId: 'lunar_south_pole_ice_v1',
                                        modelVersion: '0.1.0',
                                    };
                                    const attempt = (0, domain_1.simulateMission)(input);
                                    const serialized = JSON.stringify(attempt);
                                    assert.equal(serialized, firstRunResults[secondIdx]);
                                    secondIdx++;
                                }
                            }
                        }
                    }
                }
            }
        }
    });
});
