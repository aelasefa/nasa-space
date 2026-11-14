import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  resolveObservation,
  resolveDownlink,
  evaluateOutcome,
  simulateMission,
} from '../../src/domain/simulation';
import type { SpacecraftConfig } from '../../src/domain/types';

describe('Mission Simulation Subsystem (Ticket T04)', () => {
  const nominalConfig: SpacecraftConfig = {
    payloadId: 'ice_spectrometer',
    powerId: 'solar_storage',
    propulsionId: 'prop_high',
    commsId: 'comms_high',
    trajectoryId: 'direct',
  };

  it('resolves nominal observe_full when battery is sufficient', () => {
    const obs = resolveObservation(nominalConfig, 'observe_full');
    assert.equal(obs.status, 'nominal');
    assert.equal(obs.observationFraction, 1.0);
    assert.equal(obs.event.id, 'E1');
  });

  it('resolves conserved observation with 0.50 fraction', () => {
    const obs = resolveObservation(nominalConfig, 'conserve');
    assert.equal(obs.status, 'conserved');
    assert.equal(obs.observationFraction, 0.50);
  });

  it('resolves science_cutoff when battery is depleted mid-window', () => {
    const lightSolarConfig: SpacecraftConfig = {
      ...nominalConfig,
      powerId: 'solar_light', // 80 Wh total, 60 Wh base, 20 Wh for payload
    };
    const obs = resolveObservation(lightSolarConfig, 'observe_full');
    assert.equal(obs.status, 'science_cutoff');
    // 0.50 + 0.50 * (20 / 170) ≈ 0.5588235
    assert.ok(obs.observationFraction > 0.50 && obs.observationFraction < 1.0);
  });

  it('resolves downlink for ice spectrometer and full capacity', () => {
    const down = resolveDownlink(nominalConfig, 'science_first', 1.0);
    assert.equal(down.collectedSciencePoints, 100);
    assert.equal(down.returnedSciencePoints, 100);
    assert.equal(down.event.status, 'nominal');
  });

  it('resolves downlink for basic comms capping data at 60 points', () => {
    const basicCommsConfig: SpacecraftConfig = {
      ...nominalConfig,
      commsId: 'comms_basic',
    };
    const down = resolveDownlink(basicCommsConfig, 'science_first', 1.0);
    assert.equal(down.collectedSciencePoints, 100);
    assert.equal(down.returnedSciencePoints, 60);
    assert.equal(down.event.status, 'downlink_limited');
  });

  it('resolves downlink for health_first applying 60% capacity factor', () => {
    const down = resolveDownlink(nominalConfig, 'health_first', 1.0);
    assert.equal(down.collectedSciencePoints, 100);
    assert.equal(down.returnedSciencePoints, 60); // 100 * 0.60
  });

  it('resolves downlink for mapping camera returning 0 ice science points', () => {
    const cameraConfig: SpacecraftConfig = {
      ...nominalConfig,
      payloadId: 'mapping_camera',
    };
    const down = resolveDownlink(cameraConfig, 'science_first', 1.0);
    assert.equal(down.collectedSciencePoints, 0);
    assert.equal(down.returnedSciencePoints, 0);
  });

  it('evaluates outcome categories accurately', () => {
    assert.equal(evaluateOutcome(100, 'nominal'), 'success');
    assert.equal(evaluateOutcome(80, 'nominal'), 'success');
    assert.equal(evaluateOutcome(79.9, 'nominal'), 'partial');
    assert.equal(evaluateOutcome(50, 'conserved'), 'partial');
    assert.equal(evaluateOutcome(0, 'nominal'), 'failure');
    assert.equal(evaluateOutcome(85, 'bus_energy_failure'), 'failure');
  });

  it('produces an ordered event trace: arrival -> E1 -> E2', () => {
    const attempt = simulateMission({
      config: nominalConfig,
      decisions: { observeAction: 'observe_full', downlinkAction: 'science_first' },
      scenarioId: 'lunar_south_pole_ice_v1',
      modelVersion: '0.1.0',
    });
    assert.equal(attempt.kind, 'completed');
    if (attempt.kind !== 'completed') return;
    const eventIds = attempt.result.events.map((e) => e.id);
    assert.deepEqual(eventIds, ['arrival', 'E1', 'E2']);
  });
});
