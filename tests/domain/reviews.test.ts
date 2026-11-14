import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluateReviews, isReviewEvidenceStale } from '../../src/domain/reviews';
import { hashConfig } from '../../src/domain/engineering';
import type { SpacecraftConfig, ReviewEvidence } from '../../src/domain/types';

describe('CML Reviews Subsystem (Ticket T08)', () => {
  const validConfig: SpacecraftConfig = {
    payloadId: 'ice_spectrometer',
    powerId: 'solar_storage',
    propulsionId: 'prop_high',
    commsId: 'comms_high',
    trajectoryId: 'direct',
  };

  const alternativeConfig: SpacecraftConfig = {
    ...validConfig,
    propulsionId: 'prop_low',
    trajectoryId: 'efficient',
  };

  const validEvidence: ReviewEvidence = {
    configHash: hashConfig(validConfig),
    tradeStudy: {
      configHashA: hashConfig(validConfig),
      configHashB: hashConfig(alternativeConfig),
      chosenConfigHash: hashConfig(validConfig),
      rationale: 'risk',
    },
    acknowledgedWarnings: [],
  };

  it('authorizes launch when all CML 1-4 requirements pass', () => {
    const report = evaluateReviews(validConfig, validEvidence);
    assert.equal(report.authorized, true);
    assert.equal(report.gates.CML1.passed, true);
    assert.equal(report.gates.CML2.passed, true);
    assert.equal(report.gates.CML3.passed, true);
    assert.equal(report.gates.CML4.passed, true);
  });

  it('rejects CML 1 when mapping_camera is selected', () => {
    const cameraConfig: SpacecraftConfig = { ...validConfig, payloadId: 'mapping_camera' };
    const evidence: ReviewEvidence = {
      configHash: hashConfig(cameraConfig),
      tradeStudy: {
        configHashA: hashConfig(cameraConfig),
        configHashB: hashConfig(alternativeConfig),
        chosenConfigHash: hashConfig(cameraConfig),
        rationale: 'cost',
      },
      acknowledgedWarnings: [],
    };
    const report = evaluateReviews(cameraConfig, evidence);
    assert.equal(report.gates.CML1.passed, false);
    assert.equal(report.authorized, false);
  });

  it('rejects CML 2 when engineering feasibility has blockers', () => {
    const infeasibleConfig: SpacecraftConfig = {
      ...validConfig,
      propulsionId: 'prop_low',
      trajectoryId: 'direct', // delta-v blocker
    };
    const evidence: ReviewEvidence = {
      configHash: hashConfig(infeasibleConfig),
      acknowledgedWarnings: [],
    };
    const report = evaluateReviews(infeasibleConfig, evidence);
    assert.equal(report.gates.CML2.passed, false);
    assert.equal(report.authorized, false);
  });

  it('rejects CML 3 when trade study is missing or compares identical configs', () => {
    const noTradeStudy: ReviewEvidence = {
      configHash: hashConfig(validConfig),
      acknowledgedWarnings: [],
    };
    assert.equal(evaluateReviews(validConfig, noTradeStudy).gates.CML3.passed, false);

    const identicalTradeStudy: ReviewEvidence = {
      configHash: hashConfig(validConfig),
      tradeStudy: {
        configHashA: hashConfig(validConfig),
        configHashB: hashConfig(validConfig),
        chosenConfigHash: hashConfig(validConfig),
        rationale: 'science',
      },
      acknowledgedWarnings: [],
    };
    assert.equal(evaluateReviews(validConfig, identicalTradeStudy).gates.CML3.passed, false);
  });

  it('rejects CML 4 when warnings are unacknowledged', () => {
    // Config with warnings: prop_low + efficient has delta_v_margin warning
    const warningConfig: SpacecraftConfig = {
      ...validConfig,
      propulsionId: 'prop_low',
      trajectoryId: 'efficient',
    };
    const unacknowledgedEvidence: ReviewEvidence = {
      configHash: hashConfig(warningConfig),
      tradeStudy: {
        configHashA: hashConfig(warningConfig),
        configHashB: hashConfig(validConfig),
        chosenConfigHash: hashConfig(warningConfig),
        rationale: 'mass',
      },
      acknowledgedWarnings: [], // empty -> unacknowledged
    };

    const report = evaluateReviews(warningConfig, unacknowledgedEvidence);
    assert.equal(report.gates.CML4.passed, false);
    assert.equal(report.authorized, false);
    assert.ok(report.gates.CML4.findings.some((f) => f.id.includes('DELTA_V_MARGIN')));

    // Acknowledging the warning allows CML 4 to pass
    const acknowledgedEvidence: ReviewEvidence = {
      ...unacknowledgedEvidence,
      acknowledgedWarnings: ['delta_v_margin'],
    };
    const report2 = evaluateReviews(warningConfig, acknowledgedEvidence);
    assert.equal(report2.gates.CML4.passed, true);
    assert.equal(report2.authorized, true);
  });

  it('detects stale evidence when config changes after review', () => {
    assert.equal(isReviewEvidenceStale(validConfig, validEvidence), false);

    const modifiedConfig: SpacecraftConfig = { ...validConfig, commsId: 'comms_basic' };
    assert.equal(isReviewEvidenceStale(modifiedConfig, validEvidence), true);

    const staleReport = evaluateReviews(modifiedConfig, validEvidence);
    assert.equal(staleReport.gates.CML4.passed, false);
    assert.equal(staleReport.authorized, false);
  });
});
