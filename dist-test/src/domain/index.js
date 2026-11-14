"use strict";
// LUNA-01 Domain Engine Barrel Export
// Source of truth: DOMAIN_CONTRACTS.md and GAME_RULES.md
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRAJECTORY_CATALOG = exports.COMMS_CATALOG = exports.PROPULSION_CATALOG = exports.POWER_CATALOG = exports.PAYLOAD_CATALOG = exports.DATA_PROVENANCE = exports.DEFAULT_MODEL_VERSION = exports.DEFAULT_SCENARIO_ID = exports.BASE_SURVIVAL_ENERGY_WH = exports.E1_OBSERVATION_DURATION_HOURS = exports.BASE_BUS_SHADOW_LOAD_W = exports.BASE_BUS_SUNLIT_LOAD_W = exports.BASE_BUS_MASS_KG = exports.LAUNCH_MASS_CAP_KG = exports.BUDGET_CAP_BU = exports.compareUniverses = exports.branchUniverse = exports.createRootUniverse = exports.isReviewEvidenceStale = exports.evaluateReviews = exports.buildCausalFindings = exports.computeMPI = exports.simulateMission = exports.evaluateOutcome = exports.resolveDownlink = exports.resolveObservation = exports.hashConfig = exports.evaluateFeasibility = exports.computeResources = void 0;
// Canonical Types
__exportStar(require("./types"), exports);
// Engineering Calculations
var engineering_1 = require("./engineering");
Object.defineProperty(exports, "computeResources", { enumerable: true, get: function () { return engineering_1.computeResources; } });
Object.defineProperty(exports, "evaluateFeasibility", { enumerable: true, get: function () { return engineering_1.evaluateFeasibility; } });
Object.defineProperty(exports, "hashConfig", { enumerable: true, get: function () { return engineering_1.hashConfig; } });
// Mission Simulation
var simulation_1 = require("./simulation");
Object.defineProperty(exports, "resolveObservation", { enumerable: true, get: function () { return simulation_1.resolveObservation; } });
Object.defineProperty(exports, "resolveDownlink", { enumerable: true, get: function () { return simulation_1.resolveDownlink; } });
Object.defineProperty(exports, "evaluateOutcome", { enumerable: true, get: function () { return simulation_1.evaluateOutcome; } });
Object.defineProperty(exports, "simulateMission", { enumerable: true, get: function () { return simulation_1.simulateMission; } });
// Mission Scoring
var scoring_1 = require("./scoring");
Object.defineProperty(exports, "computeMPI", { enumerable: true, get: function () { return scoring_1.computeMPI; } });
// Causal Findings
var causality_1 = require("./causality");
Object.defineProperty(exports, "buildCausalFindings", { enumerable: true, get: function () { return causality_1.buildCausalFindings; } });
// CML Engineering Reviews
var reviews_1 = require("./reviews");
Object.defineProperty(exports, "evaluateReviews", { enumerable: true, get: function () { return reviews_1.evaluateReviews; } });
Object.defineProperty(exports, "isReviewEvidenceStale", { enumerable: true, get: function () { return reviews_1.isReviewEvidenceStale; } });
// Multiverse Engine
var multiverse_1 = require("./multiverse");
Object.defineProperty(exports, "createRootUniverse", { enumerable: true, get: function () { return multiverse_1.createRootUniverse; } });
Object.defineProperty(exports, "branchUniverse", { enumerable: true, get: function () { return multiverse_1.branchUniverse; } });
Object.defineProperty(exports, "compareUniverses", { enumerable: true, get: function () { return multiverse_1.compareUniverses; } });
// Data Catalog and Constants
var catalog_1 = require("../data/catalog");
Object.defineProperty(exports, "BUDGET_CAP_BU", { enumerable: true, get: function () { return catalog_1.BUDGET_CAP_BU; } });
Object.defineProperty(exports, "LAUNCH_MASS_CAP_KG", { enumerable: true, get: function () { return catalog_1.LAUNCH_MASS_CAP_KG; } });
Object.defineProperty(exports, "BASE_BUS_MASS_KG", { enumerable: true, get: function () { return catalog_1.BASE_BUS_MASS_KG; } });
Object.defineProperty(exports, "BASE_BUS_SUNLIT_LOAD_W", { enumerable: true, get: function () { return catalog_1.BASE_BUS_SUNLIT_LOAD_W; } });
Object.defineProperty(exports, "BASE_BUS_SHADOW_LOAD_W", { enumerable: true, get: function () { return catalog_1.BASE_BUS_SHADOW_LOAD_W; } });
Object.defineProperty(exports, "E1_OBSERVATION_DURATION_HOURS", { enumerable: true, get: function () { return catalog_1.E1_OBSERVATION_DURATION_HOURS; } });
Object.defineProperty(exports, "BASE_SURVIVAL_ENERGY_WH", { enumerable: true, get: function () { return catalog_1.BASE_SURVIVAL_ENERGY_WH; } });
Object.defineProperty(exports, "DEFAULT_SCENARIO_ID", { enumerable: true, get: function () { return catalog_1.DEFAULT_SCENARIO_ID; } });
Object.defineProperty(exports, "DEFAULT_MODEL_VERSION", { enumerable: true, get: function () { return catalog_1.DEFAULT_MODEL_VERSION; } });
Object.defineProperty(exports, "DATA_PROVENANCE", { enumerable: true, get: function () { return catalog_1.DATA_PROVENANCE; } });
Object.defineProperty(exports, "PAYLOAD_CATALOG", { enumerable: true, get: function () { return catalog_1.PAYLOAD_CATALOG; } });
Object.defineProperty(exports, "POWER_CATALOG", { enumerable: true, get: function () { return catalog_1.POWER_CATALOG; } });
Object.defineProperty(exports, "PROPULSION_CATALOG", { enumerable: true, get: function () { return catalog_1.PROPULSION_CATALOG; } });
Object.defineProperty(exports, "COMMS_CATALOG", { enumerable: true, get: function () { return catalog_1.COMMS_CATALOG; } });
Object.defineProperty(exports, "TRAJECTORY_CATALOG", { enumerable: true, get: function () { return catalog_1.TRAJECTORY_CATALOG; } });
