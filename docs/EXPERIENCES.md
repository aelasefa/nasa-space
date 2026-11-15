# Amanar mission hub: three experiences

The product is **Amanar**; LUNA-01 is the name of its orbiter mission. The entry page
(`frontend/index.html`) is the **mission hub**. It launches three
experiences. Each has one description, one launch action and a “Back to mission hub”
control as the first item of its top bar.

| Experience | URL (relative to the site root) | Source | Code |
|---|---|---|---|
| LUNA-01 Orbiter, solo | `#/solo` | this repo | `src/App.tsx`, `src/features/*` |
| LUNA-01 Orbiter, crew | `#/crew` (invites: `#/join/CODE`) | this repo | `src/features/multiplayer/*` |
| Lunar Rover | `rover/` | Mamatou/Amanar (commit c61c7ed) | `src/rover/` |
| Training Academy | `academy/` (chapters `#/chapter/N`, quiz `#/chapter/N/quiz`) | Mamatou/AmanarII (commit 1ee4d33) | `src/academy/` |

The hub itself is `#/hub`. Without a hash, a first visit opens the hub and a device with a
mission under way reopens it, as before the hub existed.

All links are relative and Vite builds with `base: './'`, so the site works from any
subpath (`https://host/anything/`). Rover and Academy are separate HTML entry points
(`frontend/rover/index.html`, `frontend/academy/index.html`, listed in `vite.config.ts`).
The dev and preview servers redirect `/rover` and `/academy` to the trailing-slash URL;
static hosts do this themselves.

## Isolation

- **Pages:** Rover and Academy are separate documents. Their keyboard handlers, audio
  contexts and animation loops cannot run while the Orbiter is open, and vice versa.
- **Styles:** one stylesheet (`src/styles/mission.css`). Rover rules are under `.rover-*`,
  Academy rules under `.academy-*`; the imported simulator markup is styled only inside
  `.academy-sim`. The original stylesheets (Orbitron, neon cyan) were not brought over.
- **Saves:** each has its own `localStorage` key and never reads another:
  - Orbiter solo `luna01:save:v1`, crew `luna01:mp:session:v1` (unchanged)
  - Academy `luna01:academy:v1` (best score per chapter and sound preference, zod-validated)
  - Rover `luna01:rover:prefs:v1` (sound preference only)
  The originals used `luna_progress_v1` and `luna_sound_muted`; old Academy progress is
  not migrated.

## Lunar Rover (from Amanar)

Imported: `js/terrain.js`, `js/rover.js`, `js/audio.js`, `js/hud.js` (now `runtime/hud.js`,
which also exports the telemetry reading), `js/nasaLoader.js` (now `runtime/models.js`),
and `js/app.js` (now `runtime/sim.js`, a class the React page drives). three.js comes from
the repo's own dependency instead of the unpkg import map.

Left in the source folder: `server.js`, `index.html`, `css/style.css`, `js/cesiumMoon.js`
(CesiumJS globe), `.git`.

Changes, and why:
- **Start on the sunlit rim.** The original spawn was inside the shadow zone, so every drive
  began with no solar power and a falling thermal margin.
- **Face the Sun** now points at the scene's actual sun direction (the original turned to a
  fixed heading that did not match the power model).
- **Chase and wheel cameras** looked away from the rover (`Object3D.lookAt` on the camera's
  parent); fixed.
- **Floating HUD panel** shows only in VR; on a flat screen the page's HUD replaces it.
- **Cesium globe removed.** It needed a Cesium ion token (the original sent an empty one and
  got 401), loaded 30+ MB from cesium.com and showed placeholder coordinates.
- **Remote NASA models are links, not loads.** The SVS Moon model is 77.7 MB and the
  Hugging Face URLs were blocked by CORS. The Apollo lunar module ships locally (see
  `public/models/CREDITS.txt`); other models can be loaded from a file on the device.
- **Controls:** `Tab` cycled targets and trapped keyboard focus; it is now `T`. `M` (globe)
  is gone. Keys are ignored while typing in a field, while a dialog is open, and with
  modifier keys; Space on a focused button presses the button. Releasing input on
  window blur stops the rover. Drive pad uses pointer events (mouse, touch, pen).
- **VR** is offered only when `navigator.xr.isSessionSupported('immersive-vr')` is true.
- **Labels:** terrain is procedural and not to scale; speed, power, temperature and ice
  readings are illustrative game values. “NASA”, “LOLA”, “Shackleton” and DSN claims were
  removed from the HUD.
- No WebGL: a text page with the control guide and links back to the hub and the Academy.

## Training Academy (from AmanarII)

Imported: `js/dataset.js` (now `curriculum.ts`, same questions and explanations),
`js/simulations.js` (the five chapter simulators, now an ES module), `js/audio.js`
(`runtime/sound.js`), `js/particles.js` (`runtime/particles.js`). The flow, progress and
achievement logic were rewritten in React (`AcademyApp.tsx`, `progress.ts`).

Left in the source folder: `index.html`, `style.css`, `js/app.js` (replaced),
`js/rover_vr.js` and `js/cesium_moon.js` (a second rover runtime: the Academy now links to
the canonical Rover instead), `VR/index.html` (empty), `capture_multishot.py`,
`assets/models/nasa-rover.glb` (Mars rover), `.git`.

Changes, and why:
- One flow with steps (Lesson and simulator → Quiz → Result) and a hash URL per step.
- Each locked chapter says which chapter unlocks it and the score needed.
- Rank, badges and the printable “certificate” (with a random “security hash”) became an
  Achievements dialog; they are labelled in-game achievements, not a certification.
- “Unlock all” (test mode) became **Settings → Preview locked chapters**: chapters can be
  opened for a look without changing the gate. “Reset progress” moved to Settings with an
  in-page confirmation instead of `confirm()`.
- Simulators: colors from the console palette, `aria-pressed` on option buttons, readings
  placed under the canvas instead of over it, listeners removed on exit, a **Pause motion**
  control (paused by default under reduced motion), and no confetti under reduced motion.
- The rover banner and the “VR rover” shortcut became one “Drive the rover” link to
  `../rover/`, which offers VR when the browser supports it.
