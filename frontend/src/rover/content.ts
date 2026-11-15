/*
 * Lunar Rover: the words around the simulation. Controls, what is and is not real, and
 * where the optional model comes from. The simulation itself is in ./runtime.
 */

/** What each input does. The same list feeds the on-demand guide and the no-WebGL fallback. */
export const controls = {
  keyboard: [
    ['W / ↑', 'Drive forward'],
    ['S / ↓', 'Reverse'],
    ['A D / ← →', 'Steer'],
    ['Space', 'Brake'],
    ['C', 'Next camera'],
    ['H', 'Headlights: off, low, high'],
    ['T', 'Next target'],
    ['R', 'Back to the sunlit rim'],
  ],
  touch: [
    ['Drive pad', 'Hold an arrow to drive or steer. Stop is the brake.'],
    ['Drag the view', 'Look around from the cockpit. Changing the camera looks ahead again.'],
    ['Orbit camera', 'Drag to circle the rover, pinch to zoom.'],
  ],
  headset: [
    ['Left stick', 'Drive forward and back'],
    ['Right stick', 'Turn'],
    ['Left trigger', 'Hold to drive forward'],
    ['Right trigger', 'Headlights'],
  ],
} as const

/** Statements about what the player is looking at. Shown in the guide, never implied. */
export const honesty = [
  'The terrain is procedural: a crater, its rim and a shadowed floor built from a formula. It is not NASA elevation data and it is not to scale.',
  'Speed, power, temperature and ice readings are game values chosen to make the drive interesting. A strong ice signal here is not evidence of ice on the Moon.',
  'The rover is a stylized design, not a model of a real vehicle.',
] as const

/** The one bundled model. Details and checksum: public/models/CREDITS.txt. */
export const apollo = {
  name: 'Apollo lunar module',
  /** Served from `public/models`, one level above the Rover page. */
  path: '../models/apollo-lunar-module.glb',
  scale: 1.4,
  credit: 'NASA 3D Resources model, in the WebGL conversion published in the CodePawl “nasa-3d-glb” dataset.',
} as const

/** Places to get more models. Reference links only: the game never downloads from them. */
export const modelSources = [
  { name: 'NASA 3D Resources', url: 'https://science.nasa.gov/3d-resources/' },
  { name: 'NASA SVS: Moon 3D models (entry 14959)', url: 'https://svs.gsfc.nasa.gov/14959/' },
  { name: 'NASA Moon Trek', url: 'https://trek.nasa.gov/moon/' },
  { name: 'CodePawl nasa-3d-glb dataset', url: 'https://huggingface.co/datasets/codepawl/nasa-3d-glb' },
] as const

const PREFS = 'luna01:rover:prefs:v1'

/** The Rover's only saved state: a sound preference. Its key is its own, so it cannot touch another save. */
export function loadMuted(): boolean {
  try { return JSON.parse(window.localStorage.getItem(PREFS) ?? '{}').muted === true } catch { return false }
}
export function saveMuted(muted: boolean) {
  try { window.localStorage.setItem(PREFS, JSON.stringify({ muted })) } catch { /* preference only */ }
}
