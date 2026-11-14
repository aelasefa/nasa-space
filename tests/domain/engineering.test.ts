import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeResources,
  evaluateFeasibility,
  hashConfig,
} from '../../src/domain/engineering';
import type { SpacecraftConfig } from '../../src/domain/types';

describe('Engineering Subsystem (Ticket T02 & T03)', () => {
  const nominalConfig: SpacecraftConfig = {
    payloadId: 'ice_spectrometer',
    powerId: 'solar_storage',
    propulsionId: 'prop_high',
    commsId: 'comms_high',
    trajectoryId: 'direct',
  };

  it('computes exact resource totals for nominal configuration', () => {
    const resources = computeResources(nominalConfig);
    // Cost: 35 (ice) + 30 (storage) + 30 (prop_high) + 20 (comms_high) = 115 BU
    assert.equal(resources.costBU, 115);
    // Mass: 120 (base) + 65 (ice) + 75 (storage) + 105 (prop_high) + 30 (comms_high) = 395 kg
    assert.equal(resources.launchMassKg, 395);
    // Sunlit science load: 30 (base) + 85 (ice) = 115 W
    assert.equal(resources.sunlitScienceLoadW, 115);
    // Sunlit science margin: 190 - 115 = 75 W
    assert.equal(resources.sunlitScienceMarginW, 75);
    // Downlink load: 30 (base) + 40 (comms_high) = 70 W
    assert.equal(resources.downlinkLoadW, 70);
    // Downlink margin: 190 - 70 = 120 W
    assert.equal(resources.sunlitDownlinkMarginW, 120);
    // Delta-V margin: 1150 - 1000 = 150 m/s
    assert.equal(resources.deltaVMarginMps, 150);
    // Battery: 400 Wh
    assert.equal(resources.batteryWh, 400);
  });

  it('evaluates feasibility and warnings accurately', () => {
    const report = evaluateFeasibility(nominalConfig);
    assert.equal(report.eligible, true);
    assert.equal(report.blockers.length, 0);
    // For nominal, margins are generous: science margin 75 >= 15, delta-v 150 >= 100, battery 400 >= 230
    assert.equal(report.warnings.length, 0);
  });

  it('triggers delta_v_margin warning when reserve is < 100 m/s', () => {
    const lowPropEfficient: SpacecraftConfig = {
      ...nominalConfig,
      propulsionId: 'prop_low',
      trajectoryId: 'efficient', // 750 - 700 = 50 m/s margin
    };
    const report = evaluateFeasibility(lowPropEfficient);
    assert.equal(report.eligible, true);
    const dvWarning = report.warnings.find((w) => w.id === 'delta_v_margin');
    assert.ok(dvWarning);
    assert.equal(dvWarning?.actual, 50);
    assert.equal(dvWarning?.threshold, 100);
  });

  it('triggers battery_endurance warning when battery cannot sustain full shadow science pass', () => {
    const lightSolarConfig: SpacecraftConfig = {
      ...nominalConfig,
      powerId: 'solar_light', // 80 Wh battery vs (30 + 85)*2 = 230 Wh required
    };
    const report = evaluateFeasibility(lightSolarConfig);
    assert.equal(report.eligible, true);
    const batteryWarning = report.warnings.find((w) => w.id === 'battery_endurance');
    assert.ok(batteryWarning);
    assert.equal(batteryWarning?.actual, 80);
    assert.equal(batteryWarning?.threshold, 230);
  });

  it('blocks launch when delta-v margin is negative (prop_low + direct)', () => {
    const infeasibleConfig: SpacecraftConfig = {
      ...nominalConfig,
      propulsionId: 'prop_low',
      trajectoryId: 'direct', // 750 - 1000 = -250 m/s
    };
    const report = evaluateFeasibility(infeasibleConfig);
    assert.equal(report.eligible, false);
    assert.ok(report.blockers.some((b) => b.id === 'BLOCKER_PROPULSION_DEFICIT'));
  });

  it('hashConfig is insensitive to object key insertion order and deterministic', () => {
    const config1: SpacecraftConfig = {
      payloadId: 'ice_spectrometer',
      powerId: 'solar_storage',
      propulsionId: 'prop_high',
      commsId: 'comms_high',
      trajectoryId: 'direct',
    };
    // Reorder keys
    const config2 = {
      trajectoryId: 'direct',
      commsId: 'comms_high',
      propulsionId: 'prop_high',
      powerId: 'solar_storage',
      payloadId: 'ice_spectrometer',
    } as SpacecraftConfig;

    const hash1 = hashConfig(config1);
    const hash2 = hashConfig(config2);
    assert.equal(hash1, hash2);

    // Different config produces different hash
    const config3: SpacecraftConfig = { ...config1, commsId: 'comms_basic' };
    assert.notEqual(hash1, hashConfig(config3));
  });
});
