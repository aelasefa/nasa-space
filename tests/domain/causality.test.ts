import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { simulateMission } from '../../src/domain/simulation';
import type { MissionInput } from '../../src/domain/types';

describe('Causal Findings Subsystem (Ticket T05)', () => {
  it('generates structured causal findings for nominal success', () => {
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

  it('generates science cutoff and downlink bottleneck causal findings', () => {
    // 1. Cutoff test: solar_light causes science cutoff
    const cutoffInput: MissionInput = {
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
    const cutoffAttempt = simulateMission(cutoffInput);
    assert.equal(cutoffAttempt.kind, 'completed');
    if (cutoffAttempt.kind !== 'completed') return;
    const cutoffCause = cutoffAttempt.result.causes.find((c) => c.id === 'CF_SCIENCE_CUTOFF');
    assert.ok(cutoffCause);
    assert.equal(cutoffCause?.sourceField, 'powerId');
    assert.equal(cutoffCause?.severity, 'warning');
    assert.equal(cutoffCause?.eventId, 'E1');

    // 2. Downlink bottleneck test: solar_storage (100 pts) + comms_basic (60 pts cap)
    const bottleneckInput: MissionInput = {
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
    const bottleneckAttempt = simulateMission(bottleneckInput);
    assert.equal(bottleneckAttempt.kind, 'completed');
    if (bottleneckAttempt.kind !== 'completed') return;
    const downlinkCause = bottleneckAttempt.result.causes.find((c) => c.id === 'CF_DOWNLINK_BOTTLENECK');
    assert.ok(downlinkCause);
    assert.equal(downlinkCause?.sourceField, 'commsId');
    assert.equal(downlinkCause?.severity, 'warning');
    assert.equal(downlinkCause?.eventId, 'E2');
  });

  it('generates non-ice payload failure finding when camera is selected', () => {
    const input: MissionInput = {
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

    const attempt = simulateMission(input);
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    const cameraCause = attempt.result.causes.find((c) => c.id === 'CF_NON_ICE_PAYLOAD');
    assert.ok(cameraCause);
    assert.equal(cameraCause?.sourceField, 'payloadId');
    assert.equal(cameraCause?.severity, 'failure');
  });
});
