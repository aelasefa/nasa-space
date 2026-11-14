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
const multiverse_1 = require("../../src/domain/multiverse");
const simulation_1 = require("../../src/domain/simulation");
(0, node_test_1.describe)('Multiverse Engine Subsystem (Tickets T12 & T13)', () => {
    const rootInput = {
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
    const completedAttempt = (0, simulation_1.simulateMission)(rootInput);
    if (completedAttempt.kind !== 'completed') {
        throw new Error('Root setup failed');
    }
    (0, node_test_1.it)('creates root Universe A with null parent and null change', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        assert.equal(root.id, 'univ_a');
        assert.equal(root.parentId, null);
        assert.equal(root.change, null);
        assert.equal(root.result.outcome, 'success');
    });
    (0, node_test_1.it)('branches universe changing exactly one field and preserves parent immutability', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = {
            schemaVersion: 1,
            rootId: root.id,
            universes: [root],
        };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'powerId', from: 'solar_storage', to: 'solar_light' }, collection, 'univ_b', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'created');
        if (branchRes.kind !== 'created')
            return;
        assert.equal(branchRes.universe.id, 'univ_b');
        assert.equal(branchRes.universe.parentId, 'univ_a');
        assert.equal(branchRes.universe.input.config.powerId, 'solar_light');
        assert.equal(branchRes.universe.change?.field, 'powerId');
        // Parent immutability check
        assert.equal(root.input.config.powerId, 'solar_storage');
        assert.equal(root.id, 'univ_a');
    });
    (0, node_test_1.it)('branches an operational decision field (downlinkAction)', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'downlinkAction', from: 'science_first', to: 'health_first' }, collection, 'univ_b', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'created');
        if (branchRes.kind !== 'created')
            return;
        assert.equal(branchRes.universe.input.decisions.downlinkAction, 'health_first');
        assert.equal(branchRes.universe.result.returnedSciencePoints, 60);
    });
    (0, node_test_1.it)('rejects branch when to value equals from value', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'powerId', from: 'solar_storage', to: 'solar_storage' }, collection, 'univ_b', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'rejected');
        if (branchRes.kind !== 'rejected')
            return;
        assert.ok(branchRes.reason.includes('identical to "from" value'));
    });
    (0, node_test_1.it)('rejects branch when parent current value does not match change.from', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'powerId', from: 'solar_light', to: 'solar_storage' }, collection, 'univ_b', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'rejected');
        if (branchRes.kind !== 'rejected')
            return;
        assert.ok(branchRes.reason.includes('does not match parent universe'));
    });
    (0, node_test_1.it)('rejects branch when candidate configuration fails engineering feasibility', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'propulsionId', from: 'prop_high', to: 'prop_low' }, collection, 'univ_infeasible', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'rejected');
        if (branchRes.kind !== 'rejected')
            return;
        assert.ok(branchRes.reason.includes('feasibility'));
        assert.equal(branchRes.attempt?.kind, 'rejected');
    });
    (0, node_test_1.it)('enforces maximum 8 universes per collection', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'u0', '2026-11-14T01:00:00Z');
        const collection = {
            schemaVersion: 1,
            rootId: root.id,
            universes: [root],
        };
        // Add 7 more universes to reach 8 total
        for (let i = 1; i < 8; i++) {
            collection.universes.push({
                ...root,
                id: `u${i}`,
            });
        }
        assert.equal(collection.universes.length, 8);
        // Attempting to branch a 9th universe must be rejected
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'commsId', from: 'comms_high', to: 'comms_basic' }, collection, 'u8', '2026-11-14T01:10:00Z');
        assert.equal(branchRes.kind, 'rejected');
        if (branchRes.kind !== 'rejected')
            return;
        assert.ok(branchRes.reason.includes('Maximum universe limit reached'));
    });
    (0, node_test_1.it)('rejects duplicate universe IDs', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'univ_a', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'commsId', from: 'comms_high', to: 'comms_basic' }, collection, 'univ_a', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'rejected');
        if (branchRes.kind !== 'rejected')
            return;
        assert.ok(branchRes.reason.includes('already exists'));
    });
    (0, node_test_1.it)('compareUniverses produces exact deltas across resources, science, score, and events', () => {
        const root = (0, multiverse_1.createRootUniverse)(completedAttempt, 'uA', '2026-11-14T01:00:00Z');
        const collection = { schemaVersion: 1, rootId: root.id, universes: [root] };
        const branchRes = (0, multiverse_1.branchUniverse)(root, { field: 'commsId', from: 'comms_high', to: 'comms_basic' }, collection, 'uB', '2026-11-14T01:05:00Z');
        assert.equal(branchRes.kind, 'created');
        if (branchRes.kind !== 'created')
            return;
        const comp = (0, multiverse_1.compareUniverses)(root, branchRes.universe);
        assert.equal(comp.universeIdA, 'uA');
        assert.equal(comp.universeIdB, 'uB');
        assert.deepEqual(comp.changedFields, ['commsId']);
        assert.equal(comp.resourceDeltas.costBU, -10);
        assert.equal(comp.resourceDeltas.launchMassKg, -15);
        assert.equal(comp.scienceDelta.returnedSciencePoints, -40);
        assert.equal(comp.outcomeTransition.from, 'success');
        assert.equal(comp.outcomeTransition.to, 'partial');
        assert.equal(comp.outcomeTransition.changed, true);
        assert.equal(comp.eventComparisons['E2']?.statusChanged, true);
    });
});
