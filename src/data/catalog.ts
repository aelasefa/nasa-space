// Component catalog and mission constants for LUNA-01
// Source of truth: GAME_RULES.md

import type {
  PayloadId,
  PowerId,
  PropulsionId,
  CommsId,
  TrajectoryId,
} from '../domain/types';

export const BUDGET_CAP_BU = 120;
export const LAUNCH_MASS_CAP_KG = 500;
export const BASE_BUS_MASS_KG = 120;
export const BASE_BUS_SUNLIT_LOAD_W = 30;
export const BASE_BUS_SHADOW_LOAD_W = 30;
export const E1_OBSERVATION_DURATION_HOURS = 2;
export const BASE_SURVIVAL_ENERGY_WH = BASE_BUS_SHADOW_LOAD_W * E1_OBSERVATION_DURATION_HOURS; // 60 Wh

export const DEFAULT_SCENARIO_ID = 'lunar_south_pole_ice_v1' as const;
export const DEFAULT_MODEL_VERSION = '0.1.0';
export const DATA_PROVENANCE = 'illustrative' as const;

export interface PayloadComponent {
  id: PayloadId;
  display: string;
  costBU: number;
  massKg: number;
  activeLoadW: number;
  isIceSensitive: boolean;
  capability: string;
}

export interface PowerComponent {
  id: PowerId;
  display: string;
  costBU: number;
  massKg: number;
  generationW: number;
  usableBatteryWh: number;
}

export interface PropulsionComponent {
  id: PropulsionId;
  display: string;
  costBU: number;
  massKg: number;
  availableDeltaVMps: number;
}

export interface CommsComponent {
  id: CommsId;
  display: string;
  costBU: number;
  massKg: number;
  downlinkLoadW: number;
  maxScienceDownlinkPoints: number;
}

export interface TrajectoryComponent {
  id: TrajectoryId;
  display: string;
  requiredDeltaVMps: number;
  narrativeTravelTime: string;
  provenance: 'illustrative' | 'gmat-precomputed';
}

export const PAYLOAD_CATALOG: Record<PayloadId, PayloadComponent> = {
  mapping_camera: {
    id: 'mapping_camera',
    display: 'Mapping camera',
    costBU: 18,
    massKg: 35,
    activeLoadW: 35,
    isIceSensitive: false,
    capability: 'Contextual mapping only; primary ice objective not met',
  },
  ice_spectrometer: {
    id: 'ice_spectrometer',
    display: 'Ice-sensitive spectrometer',
    costBU: 35,
    massKg: 65,
    activeLoadW: 85,
    isIceSensitive: true,
    capability: 'Primary water-ice investigation',
  },
};

export const POWER_CATALOG: Record<PowerId, PowerComponent> = {
  solar_light: {
    id: 'solar_light',
    display: 'Lightweight solar',
    costBU: 15,
    massKg: 35,
    generationW: 150,
    usableBatteryWh: 80,
  },
  solar_storage: {
    id: 'solar_storage',
    display: 'Solar + storage',
    costBU: 30,
    massKg: 75,
    generationW: 190,
    usableBatteryWh: 400,
  },
};

export const PROPULSION_CATALOG: Record<PropulsionId, PropulsionComponent> = {
  prop_low: {
    id: 'prop_low',
    display: 'Low reserve',
    costBU: 18,
    massKg: 60,
    availableDeltaVMps: 750,
  },
  prop_high: {
    id: 'prop_high',
    display: 'High reserve',
    costBU: 30,
    massKg: 105,
    availableDeltaVMps: 1150,
  },
};

export const COMMS_CATALOG: Record<CommsId, CommsComponent> = {
  comms_basic: {
    id: 'comms_basic',
    display: 'Basic antenna',
    costBU: 10,
    massKg: 15,
    downlinkLoadW: 20,
    maxScienceDownlinkPoints: 60,
  },
  comms_high: {
    id: 'comms_high',
    display: 'High-throughput antenna',
    costBU: 20,
    massKg: 30,
    downlinkLoadW: 40,
    maxScienceDownlinkPoints: 100,
  },
};

export const TRAJECTORY_CATALOG: Record<TrajectoryId, TrajectoryComponent> = {
  direct: {
    id: 'direct',
    display: 'Direct transfer',
    requiredDeltaVMps: 1000,
    narrativeTravelTime: '72 h',
    provenance: 'illustrative',
  },
  efficient: {
    id: 'efficient',
    display: 'Efficient transfer',
    requiredDeltaVMps: 700,
    narrativeTravelTime: '120 h',
    provenance: 'illustrative',
  },
};
