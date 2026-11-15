/*
 * Amanar: the three playable experiences behind the mission hub. LUNA-01 is the name of
 * the orbiter mission, the first experience.
 *
 * The hub and the Orbiter live in this document (`#/hub`, `#/solo`, `#/crew`). The Rover and the Academy are
 * separate pages, so their styles, keys, audio and saves cannot reach the Orbiter. Every
 * link here is relative: the product also works when it is hosted under a subpath.
 */

export type Mode = 'hub' | 'solo' | 'crew'

/** Where the hub sends the player, relative to the hub page. */
export const pages = { rover: 'rover/', academy: 'academy/' } as const
/** From a separate page (Rover, Academy) back to the hub and across to its sibling. */
export const fromPage = { hub: '../#/hub', rover: '../rover/', academy: '../academy/' } as const

export const experiences = {
  orbiter: {
    name: 'LUNA-01 Orbiter',
    kind: 'Mission game',
    summary: 'Plan, build and fly a robotic orbiter that looks for water ice at the Moon’s south pole.',
    note: 'Educational model. Mission numbers are illustrative.',
  },
  rover: {
    name: 'Lunar Rover',
    kind: 'Driving simulation',
    summary: 'Drive a rover from a sunlit crater rim down into permanent shadow, with a keyboard, a touch screen or a VR headset.',
    note: 'Simulated terrain. Telemetry is illustrative.',
  },
  academy: {
    name: 'Training Academy',
    kind: 'Lessons and quizzes',
    summary: 'Short lessons on orbits and spacecraft. Each chapter has a hands-on simulator and a quiz.',
    note: 'Simplified textbook models. Badges are in-game achievements.',
  },
} as const

/**
 * The hub, the solo Orbiter and the crew Orbiter share one page; the hash says which is
 * open (`#/hub`, `#/solo`, `#/crew`, or an invite link `#/join/CODE`), so a reload and the
 * browser's Back button land where expected. Returns null when the hash names no route.
 */
export function modeFromHash(hash: string = window.location.hash): Mode | null {
  if (/^#\/hub(\/|$)/.test(hash)) return 'hub'
  if (/^#\/solo(\/|$)/.test(hash)) return 'solo'
  if (/^#\/(crew(\/|$)|join\/)/.test(hash)) return 'crew'
  return null
}

/**
 * Without a route, a first visit opens the hub. A mission already under way on this
 * device opens where the player left it, as it did before the hub existed.
 */
export function resolveMode(saved: { crew: boolean; solo: boolean }, hash?: string): Mode {
  return modeFromHash(hash) ?? (saved.crew ? 'crew' : saved.solo ? 'solo' : 'hub')
}

export const hashFor = (mode: Mode) => `#/${mode}`
