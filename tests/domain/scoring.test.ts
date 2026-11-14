import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeMPI } from '../../src/domain/scoring';
import type {
  MissionInput,
  ResourceReport,
  ResolvedEvent,
  Finding,
} from '../../src/domain/types';

describe('Mission Scoring Subsystem (Ticket T05)', () => {
  const nominalInput: MissionInput = {
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

  const nominalResources: ResourceReport = {
    costBU: 115,
    launchMassKg: 395,
    sunlitScienceLoadW: 115,
    sunlitScienceMarginW: 75,
    downlinkLoadW: 70,
    sunlitDownlinkMarginW: 120,
    deltaVMarginMps: 150,
    batteryWh: 400,
  };

  const nominalEvents: ResolvedEvent[] = [
    { id: 'arrival', status: 'nominal', description: 'Arrival', metrics: {} },
    { id: 'E1', status: 'nominal', description: 'E1', metrics: {} },
    { id: 'E2', status: 'nominal', description: 'E2', metrics: {} },
  ];

  it('computes 5 category subscores correctly for nominal mission', () => {
    const score = computeMPI(
      nominalInput,
      nominalResources,
      nominalEvents,
      100,
      'success',
      []
    );

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

  it('enforces score caps based on outcome', () => {
    // Partial outcome cap = 749
    const partialScore = computeMPI(
      nominalInput,
      nominalResources,
      nominalEvents,
      70,
      'partial',
      []
    );
    assert.equal(partialScore.cap, 749);
    assert.ok(partialScore.mpi <= 749);

    // Failure outcome cap = 249
    const failureScore = computeMPI(
      nominalInput,
      nominalResources,
      nominalEvents,
      0,
      'failure',
      []
    );
    assert.equal(failureScore.cap, 249);
    assert.ok(failureScore.mpi <= 249);
  });

  it('penalizes engineering score by 20 per accepted warning', () => {
    const dummyWarnings: Finding[] = [
      { id: 'power_margin', severity: 'warning', sourceField: 'powerId', message: 'W1' },
      { id: 'delta_v_margin', severity: 'warning', sourceField: 'propulsionId', message: 'W2' },
    ];
    const score = computeMPI(
      nominalInput,
      nominalResources,
      nominalEvents,
      100,
      'success',
      dummyWarnings
    );
    // 100 - 20 * 2 = 60
    assert.equal(score.engineering, 60);
  });

  it('handles zero-science return without division by zero', () => {
    const score = computeMPI(
      nominalInput,
      nominalResources,
      nominalEvents,
      0,
      'failure',
      []
    );
    assert.equal(score.science, 0);
    assert.equal(score.efficiency, 0);
    assert.equal(score.rawSciencePerResource, 0);
    assert.ok(Number.isFinite(score.mpi));
  });
});
