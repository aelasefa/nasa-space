import type { ConfigField, SpacecraftConfig } from '../app/contracts'

/*
 * Mission definition types. A mission supplies its own build steps, component
 * explanations, crew and spacecraft look; the stepper, radio and 3D renderer are generic.
 * Nothing here is specific to the Moon or to a seven-step build.
 */

export interface Reference { org: string; title: string; url: string }

/** Where a statement comes from, so the UI can label it. */
export type Grounding = 'sourced' | 'model' | 'fiction'

export interface OptionInfo {
  /** Everyday description of the part. */
  what: string
  /** What choosing it gains and what it costs. */
  tradeoff: string
}

export interface Spec { label: string; value: string }

export interface BuildStep {
  id: string
  /** Short name for the progress indicator. */
  label: string
  title: string
  /** What is it? One or two plain sentences. */
  what: string
  /** Why do I need it? */
  why: string
  /** Config fields chosen in this step. Empty for a fixed (not selectable) subsystem. */
  fields: ConfigField[]
  /** Shown when the subsystem is fixed in this mission's model. */
  fixedNote?: string
  /** Show each option's shadow-pass energy picture (solar output, storage, endurance) from the engine. */
  preview?: 'shadow-energy'
  /** Which part of the spacecraft to highlight. */
  focus: string
  /** Optional deeper explanation. */
  learn: {
    principle: string
    examples: { text: string; source: Reference }[]
    /** How this mission's model simplifies the subsystem. */
    assumptions: string[]
  }
  /** Optional crew comment for this step (fictional dialogue). */
  radio?: { from: string; text: string }
  /** Subsystems named in the brief that this mission's model does not simulate yet. */
  notModeled?: string[]
}

export interface Character { id: string; name: string; role: string; initials: string; tone: string }

export interface MissionDefinition<Design extends Record<string, string> = Record<string, string>> {
  id: string
  name: string
  steps: BuildStep[]
  options: Partial<Record<string, OptionInfo>>
  specs: (field: ConfigField, id: string) => Spec[]
  /** Maps the engine configuration to stylized spacecraft parts (slot → variant). */
  design: (config: SpacecraftConfig) => Design
  crew: Record<string, Character>
  /** Plain-language wording for engine finding IDs. Unlisted findings fall back to the engine message. */
  findingText: Partial<Record<string, string>>
}

/** Index of the build step where a config field is chosen, or -1 when no step offers it. */
export const stepIndexFor = (mission: MissionDefinition, field: string) =>
  mission.steps.findIndex(step => step.fields.some(item => item === field))
