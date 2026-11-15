/** Types for the imported chapter simulators (simulations.js). */
export const Simulators: {
  /** Build the simulator for a chapter (1–5) inside `container`, replacing any previous one. */
  init(chapterId: number, container: HTMLElement): void
  /** Pause or resume the moving picture. Paused simulators still redraw after each control change. */
  setPaused(paused: boolean): void
  /** Stop the running simulator and remove its listeners. */
  cleanup(): void
}
