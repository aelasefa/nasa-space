/** Types for the imported rover simulation (sim.js). */

export interface RoverTelemetry {
  speedKmh: number
  speedLimitKmh: number
  /** Battery charge, 0–100. */
  batteryPct: number
  solarW: number
  loadW: number
  /** Degrees Celsius above the cold limit; negative means below it. */
  thermalMarginC: number
  pitchDeg: number
  rollDeg: number
  targetName: string
  targetDistanceM: number
  /** Degrees to the target relative to where the rover points; positive is to the right. */
  targetBearingDeg: number
  /** Simulated ice signal at the rover, 0–1. */
  iceSignal: number
  /** The signal as a game value in weight percent. */
  icePercent: number
  inShadow: boolean
  braking: boolean
  autoNav: boolean
  drilling: boolean
  /** Last drill sample in weight percent, or null before the first one. */
  sample: number | null
  /** 0 off, 1 low, 2 high. */
  headlights: number
  /** Index into CAMERA_NAMES. */
  camera: number
  presenting: boolean
  hasModel: boolean
}

export type DriveControl = 'fwd' | 'rev' | 'left' | 'right' | 'brake'

export interface RoverSim {
  setDrive(control: DriveControl, active: boolean): void
  /** Pause keyboard driving while a dialog is open. */
  setInputEnabled(enabled: boolean): void
  setCamera(mode: number): number
  cycleCamera(): number
  toggleHeadlights(): number
  setSpeedLimit(kmh: number): void
  toggleAutoNav(): boolean
  nextTarget(): string
  drill(): void
  alignToSun(): void
  reset(): void
  setMuted(muted: boolean): void
  vrSupported(): Promise<boolean>
  enterVR(): Promise<void>
  exitVR(): Promise<void>
  /** Add one optional model to the scene, from a URL or a file the player picked. Rejects if it cannot load. */
  loadModel(source: string | File, scale?: number): Promise<void>
  clearModel(): void
  dispose(): void
}

export const CAMERA_NAMES: readonly string[]
export const SPEED_LIMITS_KMH: readonly number[]
export const LIGHT_NAMES: readonly string[]

/** Start the rover simulation inside `container`. Throws when WebGL is unavailable. */
export function createRoverSim(container: HTMLElement, handlers?: {
  onTelemetry?: (reading: RoverTelemetry) => void
  onNotice?: (text: string) => void
}): RoverSim
