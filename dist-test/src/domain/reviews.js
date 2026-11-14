"use strict";
// CML-inspired engineering review gates for LUNA-01
// Source of truth: GAME_RULES.md (Section 8) and DOMAIN_CONTRACTS.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReviewEvidenceStale = isReviewEvidenceStale;
exports.evaluateReviews = evaluateReviews;
const engineering_1 = require("./engineering");
/**
 * Validates whether review evidence is tied to the current configuration hash.
 */
function isReviewEvidenceStale(config, evidence) {
    return evidence.configHash !== (0, engineering_1.hashConfig)(config);
}
/**
 * Evaluates CML 1–4 review gates for a spacecraft configuration against submitted evidence.
 * Returns per-gate pass/fail status and launch authorization determination.
 */
function evaluateReviews(config, evidence) {
    const currentHash = (0, engineering_1.hashConfig)(config);
    const feasibility = (0, engineering_1.evaluateFeasibility)(config);
    const gates = {
        CML1: { passed: false, findings: [] },
        CML2: { passed: false, findings: [] },
        CML3: { passed: false, findings: [] },
        CML4: { passed: false, findings: [] },
    };
    // CML 1 — Charter: South-pole ice investigation + matching instrument
    // Pass rule: ice_spectrometer selected
    if (config.payloadId === 'ice_spectrometer') {
        gates.CML1 = { passed: true, findings: [] };
    }
    else {
        gates.CML1 = {
            passed: false,
            findings: [
                {
                    id: 'CML1_INSTRUMENT_MISMATCH',
                    severity: 'blocker',
                    sourceField: 'payloadId',
                    message: 'Mission charter requires lunar south-pole water-ice investigation; selected payload (mapping_camera) cannot satisfy primary ice-sensitive observation criteria.',
                },
            ],
        };
    }
    // CML 2 — Feasibility: Resources and trajectory
    // Pass rule: No feasibility blockers
    if (feasibility.blockers.length === 0) {
        gates.CML2 = { passed: true, findings: [] };
    }
    else {
        gates.CML2 = {
            passed: false,
            findings: [...feasibility.blockers],
        };
    }
    // CML 3 — Trade study: Two distinct saved configurations; side-by-side metrics; selected compromise
    // Pass rule: Comparison saved with two different configuration hashes and one selected rationale code ('science' | 'mass' | 'cost' | 'risk')
    // Must reference current configuration as the chosen candidate.
    if (evidence.tradeStudy &&
        evidence.tradeStudy.configHashA !== evidence.tradeStudy.configHashB &&
        evidence.tradeStudy.chosenConfigHash === currentHash &&
        (evidence.tradeStudy.chosenConfigHash === evidence.tradeStudy.configHashA ||
            evidence.tradeStudy.chosenConfigHash === evidence.tradeStudy.configHashB) &&
        ['science', 'mass', 'cost', 'risk'].includes(evidence.tradeStudy.rationale)) {
        gates.CML3 = { passed: true, findings: [] };
    }
    else {
        const findings = [];
        if (!evidence.tradeStudy) {
            findings.push({
                id: 'CML3_MISSING_TRADE_STUDY',
                severity: 'blocker',
                sourceField: 'scenario',
                message: 'CML 3 requires a completed trade study comparing two distinct configurations.',
            });
        }
        else if (evidence.tradeStudy.configHashA === evidence.tradeStudy.configHashB) {
            findings.push({
                id: 'CML3_IDENTICAL_CONFIGS',
                severity: 'blocker',
                sourceField: 'scenario',
                message: 'Trade study comparison must contrast two genuinely distinct configurations.',
            });
        }
        else if (evidence.tradeStudy.chosenConfigHash !== currentHash) {
            findings.push({
                id: 'CML3_CHOSEN_CONFIG_MISMATCH',
                severity: 'blocker',
                sourceField: 'scenario',
                message: 'Trade study compromise candidate does not match current configuration hash.',
            });
        }
        else {
            findings.push({
                id: 'CML3_INVALID_RATIONALE',
                severity: 'blocker',
                sourceField: 'scenario',
                message: 'Trade study requires a documented rationale code (science, mass, cost, or risk).',
            });
        }
        gates.CML3 = { passed: false, findings };
    }
    // CML 4 — Point design: Final config, warnings reviewed, decision to accept/resolve
    // Pass rule: No blockers, all current warnings explicitly acknowledged, review tied to current config hash
    const cml4Findings = [];
    if (evidence.configHash !== currentHash) {
        cml4Findings.push({
            id: 'CML4_STALE_REVIEW_HASH',
            severity: 'blocker',
            sourceField: 'scenario',
            message: 'Review evidence is stale; design configuration was modified since last review.',
        });
    }
    if (feasibility.blockers.length > 0) {
        cml4Findings.push({
            id: 'CML4_UNRESOLVED_BLOCKERS',
            severity: 'blocker',
            sourceField: 'scenario',
            message: 'Point design cannot be approved while feasibility blockers remain unresolved.',
        });
    }
    // Check that all current warnings are acknowledged
    const unacknowledged = feasibility.warnings.filter((w) => !evidence.acknowledgedWarnings.includes(w.id));
    for (const unack of unacknowledged) {
        cml4Findings.push({
            id: `CML4_UNACKNOWLEDGED_${unack.id.toUpperCase()}`,
            severity: 'blocker',
            sourceField: unack.sourceField,
            message: `Unacknowledged engineering warning: ${unack.message}`,
        });
    }
    gates.CML4 = {
        passed: cml4Findings.length === 0,
        findings: cml4Findings,
    };
    const authorized = gates.CML1.passed && gates.CML2.passed && gates.CML3.passed && gates.CML4.passed;
    return {
        configHash: currentHash,
        gates,
        authorized,
    };
}
