import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  simulateMission,
  evaluateReviews,
  hashConfig,
  branchUniverse,
  createRootUniverse,
  compareUniverses,
} from '../../src/domain';
import type {
  SpacecraftConfig,
  MissionInput,
  ReviewEvidence,
  UniverseCollection,
} from '../../src/domain/types';

describe('GAME_RULES.md Acceptance Tests (Section 11)', () => {
  it('1. Deterministic simulation produces finite numbers and never returns flown results for invalid inputs', () => {
    const invalidInput: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_low',
        commsId: 'comms_high',
        trajectoryId: 'direct', // 750 m/s < 1000 m/s => infeasible
      },
      decisions: {
        observeAction: 'observe_full',
        downlinkAction: 'science_first',
      },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };

    const attempt = simulateMission(invalidInput);
    assert.equal(attempt.kind, 'rejected');
    if (attempt.kind !== 'rejected') return;
    assert.equal(attempt.feasibility.eligible, false);
    assert.ok(attempt.feasibility.blockers.length > 0);
  });

  it('2. Ice spectrometer + solar storage + high prop + high comms + direct + observe_full + science_first achieves SUCCESS', () => {
    const input: MissionInput = {
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

    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    assert.equal(attempt.result.outcome, 'success');
    assert.equal(attempt.result.returnedSciencePoints, 100);
    assert.equal(attempt.result.observationFraction, 1.0);
    assert.ok(attempt.result.score.mpi > 749);
  });

  it('3. Ice spectrometer + solar storage + low prop + basic comms + efficient + observe_full + science_first achieves PARTIAL due to downlink cap', () => {
    const input: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_low',
        commsId: 'comms_basic',
        trajectoryId: 'efficient',
      },
      decisions: {
        observeAction: 'observe_full',
        downlinkAction: 'science_first',
      },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };

    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    assert.equal(attempt.result.outcome, 'partial');
    assert.equal(attempt.result.collectedSciencePoints, 100);
    assert.equal(attempt.result.returnedSciencePoints, 60); // Capped by basic comms max points
    assert.ok(attempt.result.score.mpi <= 749);
  });

  it('4. Ice spectrometer + lightweight solar + low prop + basic comms + efficient + observe_full produces PARTIAL with science cutoff (not destruction)', () => {
    const input: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_light',
        propulsionId: 'prop_low',
        commsId: 'comms_basic',
        trajectoryId: 'efficient',
      },
      decisions: {
        observeAction: 'observe_full',
        downlinkAction: 'science_first',
      },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };

    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    assert.equal(attempt.result.outcome, 'partial');

    const e1 = attempt.result.events.find((e) => e.id === 'E1');
    assert.equal(e1?.status, 'science_cutoff');
    assert.ok(attempt.result.observationFraction > 0.50);
    assert.ok(attempt.result.observationFraction < 1.0);
    assert.ok(attempt.result.returnedSciencePoints > 0);
  });

  it('5. Camera-only configuration cannot pass CML 1 for the ice investigation mission', () => {
    const config: SpacecraftConfig = {
      payloadId: 'mapping_camera',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };
    const evidence: ReviewEvidence = {
      configHash: hashConfig(config),
      acknowledgedWarnings: [],
    };

    const report = evaluateReviews(config, evidence);
    assert.equal(report.gates.CML1.passed, false);
    assert.equal(report.authorized, false);
    assert.equal(report.gates.CML1.findings[0]?.sourceField, 'payloadId');
  });

  it('6. Low propulsion + direct transfer fails feasibility (750 < 1000 m/s)', () => {
    const config: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_low',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };

    const attempt = simulateMission({
      config,
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    assert.equal(attempt.kind, 'rejected');
    if (attempt.kind !== 'rejected') return;
    const blocker = attempt.feasibility.blockers.find((b) => b.id === 'BLOCKER_PROPULSION_DEFICIT');
    assert.ok(blocker);
    assert.equal(blocker?.actual, -250);
  });

  it('7. Battery endurance accounts for 30 W bus load during the entire 2-hour interval (60 Wh reserve)', () => {
    const input: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_light', // 80 Wh
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

    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    const expectedFraction = 0.50 + 0.50 * (20 / 170);
    assert.ok(Math.abs(attempt.result.observationFraction - expectedFraction) < 1e-6);
  });

  it('8. Conserve cannot return more collected science than feasible observe_full under identical configuration', () => {
    const baseConfig: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };

    const fullAttempt = simulateMission({
      config: baseConfig,
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    const conserveAttempt = simulateMission({
      config: baseConfig,
      decisions: { observeAction: 'conserve', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    assert.equal(fullAttempt.kind, 'completed');
    assert.equal(conserveAttempt.kind, 'completed');
    if (fullAttempt.kind !== 'completed' || conserveAttempt.kind !== 'completed') return;
    assert.ok(
      conserveAttempt.result.collectedSciencePoints <= fullAttempt.result.collectedSciencePoints
    );
    assert.equal(conserveAttempt.result.collectedSciencePoints, 50);
    assert.equal(fullAttempt.result.collectedSciencePoints, 100);
  });

  it('9. Health-first cannot return more science than science-first for identical configuration', () => {
    const baseConfig: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };

    const scienceFirst = simulateMission({
      config: baseConfig,
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    const healthFirst = simulateMission({
      config: baseConfig,
      decisions: { observeAction: 'observe_full', downlinkAction: 'health_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    assert.equal(scienceFirst.kind, 'completed');
    assert.equal(healthFirst.kind, 'completed');
    if (scienceFirst.kind !== 'completed' || healthFirst.kind !== 'completed') return;
    assert.ok(
      healthFirst.result.returnedSciencePoints <= scienceFirst.result.returnedSciencePoints
    );
    assert.equal(healthFirst.result.returnedSciencePoints, 60);
    assert.equal(scienceFirst.result.returnedSciencePoints, 100);
  });

  it('10. CML 3 requires two genuinely different configurations and a rationale', () => {
    const configA: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };
    const hashA = hashConfig(configA);

    const evidenceIdentical: ReviewEvidence = {
      configHash: hashA,
      tradeStudy: {
        configHashA: hashA,
        configHashB: hashA,
        chosenConfigHash: hashA,
        rationale: 'science',
      },
      acknowledgedWarnings: [],
    };
    const report1 = evaluateReviews(configA, evidenceIdentical);
    assert.equal(report1.gates.CML3.passed, false);

    const configB: SpacecraftConfig = {
      ...configA,
      powerId: 'solar_light',
    };
    const hashB = hashConfig(configB);

    const evidenceDistinct: ReviewEvidence = {
      configHash: hashA,
      tradeStudy: {
        configHashA: hashA,
        configHashB: hashB,
        chosenConfigHash: hashA,
        rationale: 'science',
      },
      acknowledgedWarnings: [],
    };
    const report2 = evaluateReviews(configA, evidenceDistinct);
    assert.equal(report2.gates.CML3.passed, true);
  });

  it('11. Changing configuration invalidates stale CML review approvals', () => {
    const configA: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };
    const configB: SpacecraftConfig = {
      ...configA,
      propulsionId: 'prop_low',
      trajectoryId: 'efficient',
    };

    const evidenceForA: ReviewEvidence = {
      configHash: hashConfig(configA),
      tradeStudy: {
        configHashA: hashConfig(configA),
        configHashB: hashConfig(configB),
        chosenConfigHash: hashConfig(configA),
        rationale: 'mass',
      },
      acknowledgedWarnings: [],
    };

    const report = evaluateReviews(configB, evidenceForA);
    assert.equal(report.authorized, false);
    assert.equal(report.gates.CML4.passed, false);
    assert.ok(report.gates.CML4.findings.some((f) => f.id === 'CML4_STALE_REVIEW_HASH'));
  });

  it('12. Branching changes exactly one input field, preserves parent snapshot, and recomputes from same engine', () => {
    const parentAttempt = simulateMission({
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });

    assert.equal(parentAttempt.kind, 'completed');
    if (parentAttempt.kind !== 'completed') return;
    const universeA = createRootUniverse(parentAttempt, 'universe_a', '2026-11-14T00:00:00Z');
    const collection: UniverseCollection = {
      schemaVersion: 1,
      rootId: universeA.id,
      universes: [universeA],
    };

    const branchRes = branchUniverse(
      universeA,
      { field: 'commsId', from: 'comms_high', to: 'comms_basic' },
      collection,
      'universe_b',
      '2026-11-14T00:05:00Z'
    );

    assert.equal(branchRes.kind, 'created');
    if (branchRes.kind !== 'created') return;
    assert.equal(branchRes.universe.parentId, 'universe_a');
    assert.equal(branchRes.universe.input.config.commsId, 'comms_basic');
    assert.equal(branchRes.universe.input.config.powerId, 'solar_storage');
    assert.equal(universeA.input.config.commsId, 'comms_high');
    assert.equal(branchRes.universe.result.returnedSciencePoints, 60);
  });

  it('13. Comparing universes reports the correct changed field and causal event differences', () => {
    const inputA: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };
    const simA = simulateMission(inputA);
    assert.equal(simA.kind, 'completed');
    if (simA.kind !== 'completed') return;
    const uA = createRootUniverse(simA, 'uA', '2026-11-14T00:00:00Z');

    const col: UniverseCollection = { schemaVersion: 1, rootId: uA.id, universes: [uA] };
    const branchRes = branchUniverse(
      uA,
      { field: 'commsId', from: 'comms_high', to: 'comms_basic' },
      col,
      'uB',
      '2026-11-14T00:05:00Z'
    );
    assert.equal(branchRes.kind, 'created');
    if (branchRes.kind !== 'created') return;

    const comp = compareUniverses(uA, branchRes.universe);
    assert.deepEqual(comp.changedFields, ['commsId']);
    assert.equal(comp.changes[0]?.valueA, 'comms_high');
    assert.equal(comp.changes[0]?.valueB, 'comms_basic');
    assert.equal(comp.scienceDelta.returnedSciencePoints, -40);
    assert.equal(comp.resourceDeltas.costBU, -10);
    assert.equal(comp.resourceDeltas.launchMassKg, -15);
    assert.equal(comp.eventComparisons['E2']?.statusChanged, true);
    assert.equal(comp.eventComparisons['E2']?.statusA, 'nominal');
    assert.equal(comp.eventComparisons['E2']?.statusB, 'downlink_limited');
  });

  it('14. No gmat-precomputed label appears without verified dataset provenance', () => {
    const input: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };
    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    for (const cause of attempt.result.causes) {
      assert.notEqual(cause.modelSource, 'gmat-precomputed');
      assert.equal(cause.modelSource, 'illustrative');
    }
  });

  it('15. No score is assigned to not_launched; score stays within the outcome cap', () => {
    const infeasibleInput: MissionInput = {
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_low',
        commsId: 'comms_high',
        trajectoryId: 'direct',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    };

    const attempt = simulateMission(infeasibleInput);
    assert.equal(attempt.kind, 'rejected');
    assert.equal('score' in attempt, false);

    const partialAttempt = simulateMission({
      config: {
        payloadId: 'ice_spectrometer',
        powerId: 'solar_storage',
        propulsionId: 'prop_low',
        commsId: 'comms_basic',
        trajectoryId: 'efficient',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });
    assert.equal(partialAttempt.kind, 'completed');
    if (partialAttempt.kind !== 'completed') return;
    assert.equal(partialAttempt.result.outcome, 'partial');
    assert.ok(partialAttempt.result.score.mpi <= 749);
    assert.equal(partialAttempt.result.score.cap, 749);

    const failureAttempt = simulateMission({
      config: {
        payloadId: 'mapping_camera',
        powerId: 'solar_storage',
        propulsionId: 'prop_high',
        commsId: 'comms_high',
        trajectoryId: 'direct',
      },
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });
    assert.equal(failureAttempt.kind, 'completed');
    if (failureAttempt.kind !== 'completed') return;
    assert.equal(failureAttempt.result.outcome, 'failure');
    assert.ok(failureAttempt.result.score.mpi <= 249);
    assert.equal(failureAttempt.result.score.cap, 249);
  });
});
