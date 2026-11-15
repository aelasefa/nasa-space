// Training Academy: the five chapter simulators (imported from AmanarII, js/simulations.js).
// Each one draws on a 2D canvas and builds its own controls inside the container it is
// given. They are simplified textbook models for learning: orbital speed from v = √(μ/r),
// Kepler's laws, the rocket equation, Clohessy-Wiltshire relative motion and a toy debris
// cascade. Numbers are illustrative, not mission data.
//
// Changes from the original: an ES module instead of a global; listeners are removed on
// cleanup; colors use the console palette; pressed state is exposed to assistive
// technology; the particle burst respects reduced motion. Types: simulations.d.ts.

import { Sound } from './sound.js';
import { celebrate } from './particles.js';

export const Simulators = {
  currentSim: null,
  animId: null,
  nextFrame: null,
  paused: false,
  disposers: [],

  cleanup() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.nextFrame = null;
    for (const off of this.disposers) off();
    this.disposers = [];
    // Stops any simulator loop that checks for its canvas before drawing the next frame.
    if (this.currentSim) this.currentSim.canvas = null;
    this.currentSim = null;
  },

  // Every simulator loop asks for its next frame here, so motion can be paused.
  schedule(frame) {
    this.nextFrame = frame;
    this.animId = this.paused ? null : requestAnimationFrame(frame);
  },

  // Pause or resume the moving picture. While paused, the picture still redraws once
  // after each control change, so the simulators stay usable without motion.
  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    if (!this.paused && this.nextFrame) this.animId = requestAnimationFrame(this.nextFrame);
  },

  stepWhilePaused() {
    if (this.paused && this.nextFrame) this.nextFrame();
  },

  // Redraw at the new width, for as long as the simulator is mounted.
  onResize(handler) {
    window.addEventListener('resize', handler);
    this.disposers.push(() => window.removeEventListener('resize', handler));
  },

  // The simulators mark the chosen option with an `active` class. Mirror it as
  // aria-pressed so the choice is announced, not only colored.
  syncPressed(containerEl) {
    const sync = () => containerEl.querySelectorAll('.hud-pill-btn, .sub-btn').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });
    const later = () => queueMicrotask(() => { sync(); this.stepWhilePaused(); });
    sync();
    containerEl.addEventListener('click', later);
    containerEl.addEventListener('input', later);
    this.disposers.push(() => {
      containerEl.removeEventListener('click', later);
      containerEl.removeEventListener('input', later);
    });
  },

  init(chapterId, containerEl) {
    this.cleanup();
    containerEl.innerHTML = '';

    switch (chapterId) {
      case 1:
        this.currentSim = new OrbitViewerSim(containerEl);
        break;
      case 2:
        this.currentSim = new KeplerEllipseSim(containerEl);
        break;
      case 3:
        this.currentSim = new SubsystemTradeoffSim(containerEl);
        break;
      case 4:
        this.currentSim = new DockingConeSim(containerEl);
        break;
      case 5:
        this.currentSim = new KesslerDebrisSim(containerEl);
        break;
      default:
        containerEl.textContent = 'No simulator for this chapter.';
        return;
    }
    containerEl.querySelectorAll('button:not([type])').forEach((button) => { button.type = 'button'; });
    containerEl.querySelectorAll('canvas').forEach((canvas) => canvas.setAttribute('aria-hidden', 'true'));
    this.syncPressed(containerEl);
  }
};

// ============================================================================
// CHAPTER 1: INTERACTIVE 3D/CANVAS EARTH ORBIT VIEWER (LEO vs GEO vs SSO)
// ============================================================================
class OrbitViewerSim {
  constructor(container) {
    this.container = container;
    this.orbitType = 'LEO'; // LEO, GEO, SSO
    this.altitudeKm = 400; // km
    this.angle = 0;
    this.earthRotation = 0;
    this.initDOM();
    this.animate();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="sim-wrapper">
        <div class="sim-hud-header">
          <div class="sim-title"><span class="neon-dot"></span> ORBITAL DYNAMICS LAB // EARTH TRAJECTORY VIEWER</div>
          <div class="sim-preset-buttons">
            <button class="hud-pill-btn active" data-orbit="LEO">LEO (400 km)</button>
            <button class="hud-pill-btn" data-orbit="SSO">SSO Polar (800 km)</button>
            <button class="hud-pill-btn" data-orbit="GEO">GEO (35,786 km)</button>
          </div>
        </div>

        <div class="sim-canvas-viewport">
          <canvas id="simCanvas1" class="sim-canvas"></canvas>
          <div class="sim-overlay-hud">
            <div class="hud-stat-box">
              <span class="hud-label">ALTITUDE</span>
              <span class="hud-val" id="hudAltitude">400 km</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">VELOCITY</span>
              <span class="hud-val text-cyan" id="hudVelocity">7.67 km/s</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">PERIOD</span>
              <span class="hud-val" id="hudPeriod">92.6 min</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">THERMAL STATUS</span>
              <span class="hud-val text-gold" id="hudThermal">Sunlit (+120°C)</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">ENV HAZARD</span>
              <span class="hud-val" id="hudHazard">Atomic Oxygen Drag</span>
            </div>
          </div>
        </div>

        <div class="sim-controls-panel">
          <div class="control-row">
            <label for="altSlider" class="control-label">Fine Altitude Adjust: <span id="altSliderVal">400</span> km</label>
            <input type="range" id="altSlider" min="200" max="36000" step="100" value="400" class="hud-range">
          </div>
          <div class="sim-intel-text" id="simIntel">
            <strong>Low Earth Orbit (LEO):</strong> Rapid orbit (~7.67 km/s). Spacecraft traverses sunlight and Earth's shadow every ~90 minutes (+120°C to -150°C thermal swing). Residual atomic oxygen causes continuous surface erosion and drag.
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('simCanvas1');
    this.ctx = this.canvas.getContext('2d');
    this.altSlider = document.getElementById('altSlider');
    this.altSliderVal = document.getElementById('altSliderVal');
    this.hudAltitude = document.getElementById('hudAltitude');
    this.hudVelocity = document.getElementById('hudVelocity');
    this.hudPeriod = document.getElementById('hudPeriod');
    this.hudThermal = document.getElementById('hudThermal');
    this.hudHazard = document.getElementById('hudHazard');
    this.simIntel = document.getElementById('simIntel');

    // Event listeners
    this.container.querySelectorAll('.hud-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.container.querySelectorAll('.hud-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setOrbit(btn.dataset.orbit);
      });
    });

    this.altSlider.addEventListener('input', (e) => {
      this.altitudeKm = parseInt(e.target.value, 10);
      this.orbitType = 'CUSTOM';
      this.container.querySelectorAll('.hud-pill-btn').forEach(b => b.classList.remove('active'));
      this.updateTelemetry();
    });

    this.resize();
    Simulators.onResize(() => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = 360;
  }

  setOrbit(type) {
    this.orbitType = type;
    if (type === 'LEO') {
      this.altitudeKm = 400;
      this.altSlider.value = 400;
      this.simIntel.innerHTML = `<strong>Low Earth Orbit (LEO):</strong> Rapid orbit (~7.67 km/s). Spacecraft traverses sunlight and Earth's shadow every ~90 min (+120°C to -150°C thermal cycle). High atmospheric drag and atomic oxygen degradation.`;
    } else if (type === 'SSO') {
      this.altitudeKm = 800;
      this.altSlider.value = 800;
      this.simIntel.innerHTML = `<strong>Sun-Synchronous Orbit (SSO):</strong> Near-polar inclination (~98°). Precesses 360°/year matching Earth's orbit around the Sun, keeping the local solar illumination angle constant across every pass—ideal for optical Earth observation.`;
    } else if (type === 'GEO') {
      this.altitudeKm = 35786;
      this.altSlider.value = 35786;
      this.simIntel.innerHTML = `<strong>Geostationary Orbit (GEO):</strong> Altitude 35,786 km. Orbital speed drops to ~3.07 km/s; period exactly matches Earth's 23.93 hr rotation, making the spacecraft hover over a stationary longitude point on the equator.`;
    }
    this.updateTelemetry();
  }

  updateTelemetry() {
    const mu = 398600.4418; // km^3/s^2 (Earth gravitational parameter)
    const rEarth = 6378; // km
    const r = rEarth + this.altitudeKm;
    const v = Math.sqrt(mu / r); // km/s
    const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / mu);
    const periodMin = periodSec / 60;

    this.altSliderVal.textContent = this.altitudeKm.toLocaleString();
    this.hudAltitude.textContent = `${this.altitudeKm.toLocaleString()} km`;
    this.hudVelocity.textContent = `${v.toFixed(2)} km/s`;

    if (periodMin > 180) {
      this.hudPeriod.textContent = `${(periodMin / 60).toFixed(1)} hrs`;
    } else {
      this.hudPeriod.textContent = `${periodMin.toFixed(1)} min`;
    }

    if (this.altitudeKm < 1000) {
      this.hudHazard.textContent = 'Atomic Oxygen / Drag';
      this.hudHazard.className = 'hud-val text-coral';
    } else if (this.altitudeKm >= 1000 && this.altitudeKm <= 20000) {
      this.hudHazard.textContent = 'Van Allen Belts (SEU)';
      this.hudHazard.className = 'hud-val text-gold';
    } else {
      this.hudHazard.textContent = 'Deep Radiation / Plasma';
      this.hudHazard.className = 'hud-val text-cyan';
    }
  }

  animate() {
    if (!this.canvas) return;
    this.render();
    Simulators.schedule(() => this.animate());
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Deep space backdrop
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h));
    grad.addColorStop(0, '#0b1420');
    grad.addColorStop(1, '#03060c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sun vector indicator from left
    ctx.fillStyle = 'rgba(255, 235, 150, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, cy - 80);
    ctx.lineTo(w * 0.35, cy - 40);
    ctx.lineTo(w * 0.35, cy + 40);
    ctx.lineTo(0, cy + 80);
    ctx.fill();

    ctx.fillStyle = '#ffe08a';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('☀️ SOLAR FLUX', 15, cy - 50);

    // Scaling factors
    const earthRadiusPx = 54;
    let orbitRadiusPx;
    let orbitTilt = 0; // degrees

    if (this.orbitType === 'GEO') {
      orbitRadiusPx = 135;
      orbitTilt = 12;
    } else if (this.orbitType === 'SSO') {
      orbitRadiusPx = 72;
      orbitTilt = 75; // polar
    } else {
      // LEO or custom
      const normAlt = Math.min(1, Math.max(0, (this.altitudeKm - 200) / 35586));
      orbitRadiusPx = earthRadiusPx + 15 + normAlt * 75;
      orbitTilt = 28;
    }

    // Van Allen Belts visualization
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.12)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, 95, 75, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 80, 0, 0.08)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw Orbit Path
    ctx.save();
    ctx.translate(cx, cy);
    const tiltRad = (orbitTilt * Math.PI) / 180;
    ctx.rotate(tiltRad);

    ctx.strokeStyle = 'rgba(176, 227, 217, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, orbitRadiusPx, orbitRadiusPx * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Update orbit angle
    // Higher altitude = slower rotation
    const speedFactor = 0.04 * (1 / (1 + (this.altitudeKm / 4000)));
    this.angle += speedFactor;

    const satX = Math.cos(this.angle) * orbitRadiusPx;
    const satY = Math.sin(this.angle) * orbitRadiusPx * 0.88;

    // Determine if satellite is in eclipse (in shadow behind Earth relative to Sun on left)
    // Transform satellite back to global canvas coords
    const globalSatX = cx + (satX * Math.cos(tiltRad) - satY * Math.sin(tiltRad));
    const isShadow = globalSatX > cx && Math.abs(satY) < earthRadiusPx * 0.75;

    if (this.hudThermal) {
      if (isShadow) {
        this.hudThermal.textContent = 'Eclipse Shadow (-150°C)';
        this.hudThermal.className = 'hud-val text-cyan';
      } else {
        this.hudThermal.textContent = 'Sunlit (+120°C)';
        this.hudThermal.className = 'hud-val text-gold';
      }
    }

    // Draw Satellite
    ctx.fillStyle = isShadow ? '#b0e3d9' : '#b0e3d9';
    ctx.shadowBlur = 10;
    ctx.shadowColor = isShadow ? '#b0e3d9' : '#b0e3d9';
    ctx.beginPath();
    ctx.arc(satX, satY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Solar panels on satellite
    ctx.strokeStyle = '#f4d78a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(satX - 8, satY);
    ctx.lineTo(satX + 8, satY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();

    // Draw Earth in Center
    ctx.save();
    ctx.translate(cx, cy);

    // Atmosphere Glow
    const atmosGrad = ctx.createRadialGradient(0, 0, earthRadiusPx - 4, 0, 0, earthRadiusPx + 10);
    atmosGrad.addColorStop(0, 'rgba(176, 227, 217, 0.4)');
    atmosGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.15)');
    atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadiusPx + 10, 0, Math.PI * 2);
    ctx.fill();

    // Earth Base
    ctx.fillStyle = '#114488';
    ctx.beginPath();
    ctx.arc(0, 0, earthRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Continents / Landmass effect
    this.earthRotation += 0.005;
    ctx.save();
    ctx.clip(); // clip inside Earth circle
    ctx.fillStyle = '#1b7a42';
    for (let i = -1; i <= 2; i++) {
      const offsetX = ((this.earthRotation * 40 + i * 80) % 180) - 90;
      ctx.beginPath();
      ctx.ellipse(offsetX, -10, 24, 16, 0.2, 0, Math.PI * 2);
      ctx.ellipse(offsetX + 15, 18, 20, 14, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Day/Night Terminator (Sun is on left side)
    const shadowGrad = ctx.createLinearGradient(-earthRadiusPx, 0, earthRadiusPx, 0);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGrad.addColorStop(0.5, 'rgba(3, 6, 12, 0.2)');
    shadowGrad.addColorStop(0.75, 'rgba(3, 6, 12, 0.85)');
    shadowGrad.addColorStop(1, 'rgba(3, 6, 12, 0.98)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // restore clip

    // Earth outline
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadiusPx, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

// ============================================================================
// CHAPTER 2: DYNAMIC KEPLERIAN ELLIPSE EDITOR
// ============================================================================
class KeplerEllipseSim {
  constructor(container) {
    this.container = container;
    this.a = 22000; // Semi-major axis in km
    this.e = 0.55;  // Eccentricity
    this.showSectors = true;
    this.showVectors = true;
    this.trueAnomaly = 0;
    this.initDOM();
    this.animate();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="sim-wrapper">
        <div class="sim-hud-header">
          <div class="sim-title"><span class="neon-dot"></span> KEPLERIAN TRAJECTORY DESIGNER // EQUAL AREA ENGINE</div>
          <div class="sim-preset-buttons">
            <button class="hud-pill-btn active" id="btnToggleSectors">Kepler 2nd Law (Areas)</button>
            <button class="hud-pill-btn active" id="btnToggleVectors">Velocity Vectors</button>
            <button class="hud-pill-btn" id="btnCircularize">Circularize (e = 0)</button>
          </div>
        </div>

        <div class="sim-canvas-viewport">
          <canvas id="simCanvas2" class="sim-canvas"></canvas>
          <div class="sim-overlay-hud">
            <div class="hud-stat-box">
              <span class="hud-label">PERIGEE (r_p)</span>
              <span class="hud-val text-green" id="hudPerigee">9,900 km</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">APOGEE (r_a)</span>
              <span class="hud-val text-coral" id="hudApogee">34,100 km</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">PERIGEE VEL (v_p)</span>
              <span class="hud-val text-green" id="hudVp">7.82 km/s</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">APOGEE VEL (v_a)</span>
              <span class="hud-val text-coral" id="hudVa">2.27 km/s</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">PERIOD (T)</span>
              <span class="hud-val" id="hudKeplerPeriod">8.9 hrs</span>
            </div>
          </div>
        </div>

        <div class="sim-controls-panel">
          <div class="control-row">
            <label class="control-label">Semi-Major Axis (a): <span id="valA">22,000</span> km</label>
            <input type="range" id="sliderA" min="10000" max="42000" step="500" value="22000" class="hud-range">
          </div>
          <div class="control-row">
            <label class="control-label">Eccentricity (e): <span id="valE">0.55</span> <span class="text-muted">(0 = Circle, 0.75 = Ellipse)</span></label>
            <input type="range" id="sliderE" min="0.0" max="0.75" step="0.02" value="0.55" class="hud-range">
          </div>
          <div class="sim-intel-text">
            <strong>Kepler's Second Law:</strong> A line segment joining a planet and the Sun sweeps out equal areas during equal intervals of time. Therefore, orbital velocity is highest at <strong>perigee</strong> (closest approach) and lowest at <strong>apogee</strong> (furthest point).
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('simCanvas2');
    this.ctx = this.canvas.getContext('2d');
    this.sliderA = document.getElementById('sliderA');
    this.sliderE = document.getElementById('sliderE');
    this.valA = document.getElementById('valA');
    this.valE = document.getElementById('valE');

    this.hudPerigee = document.getElementById('hudPerigee');
    this.hudApogee = document.getElementById('hudApogee');
    this.hudVp = document.getElementById('hudVp');
    this.hudVa = document.getElementById('hudVa');
    this.hudKeplerPeriod = document.getElementById('hudKeplerPeriod');

    this.sliderA.addEventListener('input', (e) => {
      this.a = parseFloat(e.target.value);
      this.valA.textContent = this.a.toLocaleString();
      this.updateTelemetry();
    });

    this.sliderE.addEventListener('input', (e) => {
      this.e = parseFloat(e.target.value);
      this.valE.textContent = this.e.toFixed(2);
      this.updateTelemetry();
    });

    document.getElementById('btnToggleSectors').addEventListener('click', (e) => {
      Sound.click();
      this.showSectors = !this.showSectors;
      e.target.classList.toggle('active', this.showSectors);
    });

    document.getElementById('btnToggleVectors').addEventListener('click', (e) => {
      Sound.click();
      this.showVectors = !this.showVectors;
      e.target.classList.toggle('active', this.showVectors);
    });

    document.getElementById('btnCircularize').addEventListener('click', () => {
      Sound.click();
      this.e = 0.0;
      this.sliderE.value = 0.0;
      this.valE.textContent = '0.00';
      this.updateTelemetry();
    });

    this.resize();
    this.updateTelemetry();
    Simulators.onResize(() => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = 360;
  }

  updateTelemetry() {
    const mu = 398600.4418;
    const rp = this.a * (1 - this.e);
    const ra = this.a * (1 + this.e);
    const vp = Math.sqrt(mu * (2 / rp - 1 / this.a));
    const va = Math.sqrt(mu * (2 / ra - 1 / this.a));
    const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(this.a, 3) / mu);

    this.hudPerigee.textContent = `${Math.round(rp).toLocaleString()} km`;
    this.hudApogee.textContent = `${Math.round(ra).toLocaleString()} km`;
    this.hudVp.textContent = `${vp.toFixed(2)} km/s`;
    this.hudVa.textContent = `${va.toFixed(2)} km/s`;
    this.hudKeplerPeriod.textContent = `${(periodSec / 3600).toFixed(1)} hrs`;
  }

  animate() {
    if (!this.canvas) return;
    this.render();
    Simulators.schedule(() => this.animate());
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Deep space
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, w, h);

    // Center of canvas
    const cx = w / 2;
    const cy = h / 2;

    // Scale down a & e to pixels
    // Fit within canvas
    const maxPxA = w * 0.38;
    const scalePx = maxPxA / 42000;
    const pxA = this.a * scalePx;
    const pxC = pxA * this.e; // Distance from center to focus
    const pxB = pxA * Math.sqrt(Math.max(0.01, 1 - this.e * this.e));

    // Focus 1 (Earth position) is at (cx - pxC, cy)
    const earthX = cx - pxC;
    const earthY = cy;

    // Kepler 2nd Law sweep angular velocity: d(nu)/dt = h / r^2 = sqrt(mu*p) / r^2
    // We compute instantaneous radius r at true anomaly nu:
    const p = this.a * (1 - this.e * this.e);
    const rCurrent = (this.a * (1 - this.e * this.e)) / (1 + this.e * Math.cos(this.trueAnomaly));
    // Step size scales with 1 / r^2
    const dNu = 0.05 * Math.pow(this.a / rCurrent, 1.6);
    this.trueAnomaly = (this.trueAnomaly + dNu * 0.4) % (Math.PI * 2);

    // Draw grid axes
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(earthX, 0);
    ctx.lineTo(earthX, h);
    ctx.stroke();

    // Equal Area Sectors (Kepler's 2nd Law demonstration)
    if (this.showSectors) {
      // Sector 1: Near Perigee (swept in equal dt, wide angle, short radius)
      ctx.fillStyle = 'rgba(176, 227, 217, 0.16)';
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      for (let angle = -0.35; angle <= 0.35; angle += 0.05) {
        const rad = (p * scalePx) / (1 + this.e * Math.cos(angle));
        ctx.lineTo(earthX + rad * Math.cos(angle), earthY + rad * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();

      // Sector 2: Near Apogee (swept in same dt, narrow angle, long radius)
      ctx.fillStyle = 'rgba(255, 194, 188, 0.14)';
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      for (let angle = Math.PI - 0.12; angle <= Math.PI + 0.12; angle += 0.02) {
        const rad = (p * scalePx) / (1 + this.e * Math.cos(angle));
        ctx.lineTo(earthX + rad * Math.cos(angle), earthY + rad * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(176, 227, 217, 0.8)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('Area A (High v)', earthX + (this.a * (1 - this.e) * scalePx) * 0.5, cy - 25);
      ctx.fillStyle = 'rgba(255, 194, 188, 0.8)';
      ctx.fillText('Area B (Low v)', earthX - (this.a * (1 + this.e) * scalePx) * 0.6, cy - 25);
    }

    // Draw Ellipse Orbit
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#b0e3d9';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#b0e3d9';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, pxA, pxB, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Mark Perigee & Apogee points
    const perigeeX = earthX + this.a * (1 - this.e) * scalePx;
    const apogeeX = earthX - this.a * (1 + this.e) * scalePx;

    ctx.fillStyle = '#b0e3d9';
    ctx.beginPath();
    ctx.arc(perigeeX, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('PERIGEE', perigeeX + 8, cy - 8);

    ctx.fillStyle = '#ffc2bc';
    ctx.beginPath();
    ctx.arc(apogeeX, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('APOGEE', apogeeX - 50, cy - 8);

    // Current satellite position from true anomaly
    const curRpx = (p * scalePx) / (1 + this.e * Math.cos(this.trueAnomaly));
    const satX = earthX + curRpx * Math.cos(this.trueAnomaly);
    const satY = earthY + curRpx * Math.sin(this.trueAnomaly);

    // Radius line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    ctx.lineTo(satX, satY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Velocity Vector
    if (this.showVectors) {
      // Tangent direction
      const vx = -Math.sin(this.trueAnomaly);
      const vy = this.e + Math.cos(this.trueAnomaly);
      const len = Math.sqrt(vx * vx + vy * vy);
      // Speed multiplier
      const vScale = 22 * (this.a / rCurrent);
      ctx.strokeStyle = '#f4d78a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(satX, satY);
      ctx.lineTo(satX + (vx / len) * vScale, satY + (vy / len) * vScale);
      ctx.stroke();

      // Arrowhead
      const headX = satX + (vx / len) * vScale;
      const headY = satY + (vy / len) * vScale;
      ctx.fillStyle = '#f4d78a';
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Satellite
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#b0e3d9';
    ctx.beginPath();
    ctx.arc(satX, satY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Primary Central Body (Earth at Focus 1)
    const earthGrad = ctx.createRadialGradient(earthX, earthY, 4, earthX, earthY, 20);
    earthGrad.addColorStop(0, '#7fa4ff');
    earthGrad.addColorStop(0.8, '#0369a1');
    earthGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = earthGrad;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#b0e3d9';
    ctx.beginPath();
    ctx.arc(earthX, earthY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Orbitron", sans-serif';
    ctx.fillText('EARTH (Focus 1)', earthX - 44, earthY + 34);
  }
}

// ============================================================================
// CHAPTER 3: SPACECRAFT SUBSYSTEM TRADE-OFF SIMULATOR
// ============================================================================
class SubsystemTradeoffSim {
  constructor(container) {
    this.container = container;
    this.propType = 'ion'; // chemical, ion, hydrazine, coldgas
    this.solarTech = 'gaas'; // silicon, gaas
    this.adcsType = 'wheels'; // wheels, rcs, magnetorquers
    this.solarArea = 10; // m^2
    this.propMass = 180; // kg
    this.dryMass = 450; // kg
    this.batteryWh = 2200; // Wh
    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="sim-wrapper">
        <div class="sim-hud-header">
          <div class="sim-title"><span class="neon-dot"></span> SYSTEMS ENGINEERING // PROPULSION & POWER TRADE-OFF</div>
        </div>

        <div class="subsystem-grid">
          <!-- Left: Subsystem Configurator -->
          <div class="subsystem-col">
            <div class="subsystem-card">
              <div class="card-label">1. PRIMARY PROPULSION ENGINE</div>
              <div class="option-button-group">
                <button class="sub-btn" data-prop="chemical">Chemical Bi-prop (Isp 315s, 450N)</button>
                <button class="sub-btn active" data-prop="ion">Electric / Ion Thruster (Isp 3,200s, 0.25N)</button>
                <button class="sub-btn" data-prop="hydrazine">Monoprop Hydrazine (Isp 220s, 22N)</button>
                <button class="sub-btn" data-prop="coldgas">Cold Gas RCS (Isp 68s, 5N)</button>
              </div>
            </div>

            <div class="subsystem-card">
              <div class="card-label">2. SOLAR PHOTOVOLTAIC ARRAYS</div>
              <div class="option-button-group">
                <button class="sub-btn" data-solar="silicon">Silicon Photovoltaic (18% Eff, Lower Cost)</button>
                <button class="sub-btn active" data-solar="gaas">Multi-Junction GaAs (32% Eff, High Eff)</button>
              </div>
              <div class="control-row mt-2">
                <label class="control-label">Array Surface Area: <span id="valSolarArea">10</span> m²</label>
                <input type="range" id="sliderSolarArea" min="2" max="24" step="1" value="10" class="hud-range">
              </div>
            </div>

            <div class="subsystem-card">
              <div class="card-label">3. ATTITUDE DETERMINATION & CONTROL (ADCS)</div>
              <div class="option-button-group">
                <button class="sub-btn active" data-adcs="wheels">Reaction Wheels + Star Tracker</button>
                <button class="sub-btn" data-adcs="rcs">Pure RCS Thrusters</button>
                <button class="sub-btn" data-adcs="magnetorquers">Magnetorquers (LEO Only)</button>
              </div>
            </div>

            <div class="subsystem-card">
              <div class="card-label">4. CONSUMABLES & MASS BUDGET</div>
              <div class="control-row">
                <label class="control-label">Propellant Mass Load: <span id="valPropMass">180</span> kg</label>
                <input type="range" id="sliderPropMass" min="30" max="600" step="10" value="180" class="hud-range">
              </div>
            </div>
          </div>

          <!-- Right: Real-time Flight Metrics & Balance HUD -->
          <div class="subsystem-col">
            <div class="hud-analysis-box">
              <div class="analysis-header">LIVE MISSION FEASIBILITY ANALYSIS</div>
              
              <div class="metric-row">
                <span class="m-title">TOTAL WET MASS (m₀)</span>
                <span class="m-val text-cyan" id="metricMass">630 kg</span>
              </div>
              <div class="metric-row">
                <span class="m-title">DELTA-V BUDGET (Δv)</span>
                <span class="m-val text-green" id="metricDeltaV">4,680 m/s</span>
              </div>
              <div class="metric-row">
                <span class="m-title">ENGINE SPECIFIC IMPULSE (Isp)</span>
                <span class="m-val" id="metricIsp">3,200 s</span>
              </div>
              <div class="metric-row">
                <span class="m-title">SOLAR POWER HARVEST</span>
                <span class="m-val text-gold" id="metricPower">4,380 W</span>
              </div>
              <div class="metric-row">
                <span class="m-title">POWER MARGIN IN SUNLIGHT</span>
                <span class="m-val text-green" id="metricMargin">+2,880 W (Surplus)</span>
              </div>
              <div class="metric-row">
                <span class="m-title">ADCS PROPELLANT EXPENDITURE</span>
                <span class="m-val" id="metricAdcsExp">0.0 kg/orbit (Momentum Wheel)</span>
              </div>
              <div class="metric-row">
                <span class="m-title">DESATURATION DEMAND</span>
                <span class="m-val text-gold" id="metricDesat">Periodic Thruster Pulse</span>
              </div>

              <div class="mission-rating-box" id="ratingBox">
                <div class="rating-title">MISSION PROFILE VIABILITY</div>
                <div class="rating-status text-green" id="ratingStatus">DEEP SPACE CRUISE & ORBIT INSERTION READY</div>
                <div class="rating-desc" id="ratingDesc">High specific impulse ion propulsion delivers over 4,000 m/s Δv, easily surpassing interplanetary transfer requirements. Multi-junction GaAs panels sustain ion thruster power draw.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    this.container.querySelectorAll('[data-prop]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.container.querySelectorAll('[data-prop]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.propType = btn.dataset.prop;
        this.updateCalculations();
      });
    });

    this.container.querySelectorAll('[data-solar]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.container.querySelectorAll('[data-solar]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.solarTech = btn.dataset.solar;
        this.updateCalculations();
      });
    });

    this.container.querySelectorAll('[data-adcs]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.container.querySelectorAll('[data-adcs]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.adcsType = btn.dataset.adcs;
        this.updateCalculations();
      });
    });

    const sliderArea = document.getElementById('sliderSolarArea');
    sliderArea.addEventListener('input', (e) => {
      this.solarArea = parseInt(e.target.value, 10);
      document.getElementById('valSolarArea').textContent = this.solarArea;
      this.updateCalculations();
    });

    const sliderProp = document.getElementById('sliderPropMass');
    sliderProp.addEventListener('input', (e) => {
      this.propMass = parseInt(e.target.value, 10);
      document.getElementById('valPropMass').textContent = this.propMass;
      this.updateCalculations();
    });

    this.updateCalculations();
  }

  updateCalculations() {
    let isp = 315;
    let powerDrawBase = 600; // Base avionics & payload
    let thrusterPowerDraw = 0;

    if (this.propType === 'chemical') {
      isp = 315;
      thrusterPowerDraw = 50;
    } else if (this.propType === 'ion') {
      isp = 3200;
      thrusterPowerDraw = 1800; // Electric thrusters need high electrical power!
    } else if (this.propType === 'hydrazine') {
      isp = 220;
      thrusterPowerDraw = 30;
    } else if (this.propType === 'coldgas') {
      isp = 68;
      thrusterPowerDraw = 10;
    }

    const solarFlux = 1361; // W/m^2 in Earth orbit
    const efficiency = this.solarTech === 'gaas' ? 0.32 : 0.18;
    const generatedPower = Math.round(this.solarArea * solarFlux * efficiency);
    const totalPowerDraw = powerDrawBase + thrusterPowerDraw;
    const powerMargin = generatedPower - totalPowerDraw;

    const totalWetMass = this.dryMass + this.propMass;
    const g0 = 9.80665;
    // Tsiolkovsky rocket equation: deltaV = Isp * g0 * ln(m0 / mf)
    const deltaV = Math.round(isp * g0 * Math.log(totalWetMass / this.dryMass));

    document.getElementById('metricMass').textContent = `${totalWetMass} kg`;
    document.getElementById('metricDeltaV').textContent = `${deltaV.toLocaleString()} m/s`;
    document.getElementById('metricIsp').textContent = `${isp} s`;
    document.getElementById('metricPower').textContent = `${generatedPower.toLocaleString()} W`;

    const marginEl = document.getElementById('metricMargin');
    if (powerMargin >= 0) {
      marginEl.textContent = `+${powerMargin.toLocaleString()} W (Surplus)`;
      marginEl.className = 'm-val text-green';
    } else {
      marginEl.textContent = `${powerMargin.toLocaleString()} W (DEFICIT - Batteries draining!)`;
      marginEl.className = 'm-val text-coral';
    }

    const adcsExpEl = document.getElementById('metricAdcsExp');
    const desatEl = document.getElementById('metricDesat');
    if (this.adcsType === 'wheels') {
      adcsExpEl.textContent = '0.0 kg/orbit (Internal momentum wheels)';
      desatEl.textContent = 'Requires desaturation burns when wheels hit RPM limit';
      desatEl.className = 'm-val text-gold';
    } else if (this.adcsType === 'rcs') {
      adcsExpEl.textContent = '~0.3 kg/day (Continuous propellant dump)';
      desatEl.textContent = 'None (Expends fuel directly)';
      desatEl.className = 'm-val text-cyan';
    } else {
      adcsExpEl.textContent = '0.0 kg/orbit (Interacts with Earth magnetic field)';
      desatEl.textContent = 'Passive desaturation (Inoperable in deep space)';
      desatEl.className = 'm-val text-green';
    }

    // Viability assessment
    const ratingStatus = document.getElementById('ratingStatus');
    const ratingDesc = document.getElementById('ratingDesc');

    if (powerMargin < 0) {
      ratingStatus.textContent = 'CRITICAL DEFICIT: INSUFFICIENT SOLAR POWER';
      ratingStatus.className = 'rating-status text-coral';
      ratingDesc.textContent = 'The chosen propulsion and avionics exceed solar array power production. Switch to higher-efficiency Multi-Junction GaAs arrays or enlarge solar panel area.';
    } else if (deltaV >= 3500) {
      ratingStatus.textContent = 'DEEP SPACE INTERPLANETARY CAPABLE (HIGH EFFICIENCY)';
      ratingStatus.className = 'rating-status text-green';
      ratingDesc.textContent = `With ${deltaV.toLocaleString()} m/s Δv and positive power margin, this spacecraft can execute lunar insertion, orbital phasing, and interplanetary exploration maneuvers.`;
    } else if (deltaV >= 1200) {
      ratingStatus.textContent = 'LEO-TO-GEO ORBITAL TRANSFER VIABLE';
      ratingStatus.className = 'rating-status text-cyan';
      ratingDesc.textContent = `With ${deltaV.toLocaleString()} m/s Δv, the spacecraft easily conducts LEO orbit-raising, inclination adjustments, and end-of-life de-orbit maneuvers.`;
    } else {
      ratingStatus.textContent = 'LOW PROPULSION MARGIN: STATIONKEEPING ONLY';
      ratingStatus.className = 'rating-status text-gold';
      ratingDesc.textContent = 'Delta-V is below 1,200 m/s. Suitable only for short-duration cubesat stationkeeping; cannot escape or perform major orbital plane changes.';
    }
  }
}

// ============================================================================
// CHAPTER 4: 3D DOCKING CONE & PROXIMITY OPS SIMULATOR (LVLH FRAME)
// ============================================================================
class DockingConeSim {
  constructor(container) {
    this.container = container;
    // Relative position in meters (x = V-bar along velocity, y = in-plane cross, z = R-bar radial)
    this.x = 85.0; // Range in meters (approaching from 85m)
    this.y = 8.5;  // Off-axis lateral error
    this.z = -5.0; // Off-axis vertical error
    this.vx = -0.55; // Approach speed (m/s)
    this.vy = -0.08;
    this.vz = 0.04;
    this.roll = 6.0; // degrees
    this.docked = false;
    this.autopilot = false;
    this.initDOM();
    this.animate();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="sim-wrapper">
        <div class="sim-hud-header">
          <div class="sim-title"><span class="neon-dot"></span> LVLH HILL FRAME // ISS DOCKING CONE GUIDANCE</div>
          <div class="sim-preset-buttons">
            <button class="hud-pill-btn" id="btnAutopilot">Autopilot: OFF</button>
            <button class="hud-pill-btn text-coral" id="btnAbort">Abort Maneuver (KOS)</button>
            <button class="hud-pill-btn" id="btnResetDock">Reset Range (85m)</button>
          </div>
        </div>

        <div class="sim-canvas-viewport">
          <canvas id="simCanvas4" class="sim-canvas"></canvas>
          <div class="sim-overlay-hud">
            <div class="hud-stat-box">
              <span class="hud-label">RANGE (V-BAR)</span>
              <span class="hud-val text-cyan" id="hudRange">85.0 m</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">CLOSING SPEED</span>
              <span class="hud-val" id="hudRelV">0.55 m/s</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">LATERAL OFFSET</span>
              <span class="hud-val" id="hudOffset">Y: +8.5m | Z: -5.0m</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">CAPTURE CONE</span>
              <span class="hud-val text-gold" id="hudConeStatus">ALIGNING</span>
            </div>
            <div class="hud-stat-box">
              <span class="hud-label">HARD-LOCK READY</span>
              <span class="hud-val text-muted" id="hudLockReady">NO (< 0.1 m/s req)</span>
            </div>
          </div>
        </div>

        <div class="docking-controls-bar">
          <div class="thruster-pad">
            <div class="pad-title">TRANSLATION (RCS PULSES)</div>
            <div class="pad-buttons">
              <button class="thruster-btn" id="btnThrusterUp">▲ +Z (R-bar Up)</button>
              <div class="pad-h-row">
                <button class="thruster-btn" id="btnThrusterPort">◄ -Y (Port)</button>
                <button class="thruster-btn" id="btnThrusterForward">▼ FORWARD (+V)</button>
                <button class="thruster-btn" id="btnThrusterRetro">▲ RETRO (-V)</button>
                <button class="thruster-btn" id="btnThrusterStbd">► +Y (Stbd)</button>
              </div>
              <button class="thruster-btn" id="btnThrusterDown">▼ -Z (Earthward)</button>
            </div>
          </div>

          <div class="docking-action-box">
            <button class="btn-hard-lock" id="btnHardLock" disabled>ENGAGE HARD LOCK</button>
            <div class="cw-warning">
              <strong>Clohessy-Wiltshire Physics Notice:</strong> In orbit, firing prograde toward a target ahead raises altitude into a slower orbit! Keep relative approach velocity under <strong>0.1 m/s</strong> within the 200m Keep-Out Sphere.
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('simCanvas4');
    this.ctx = this.canvas.getContext('2d');
    this.hudRange = document.getElementById('hudRange');
    this.hudRelV = document.getElementById('hudRelV');
    this.hudOffset = document.getElementById('hudOffset');
    this.hudConeStatus = document.getElementById('hudConeStatus');
    this.hudLockReady = document.getElementById('hudLockReady');
    this.btnHardLock = document.getElementById('btnHardLock');

    // Controls
    document.getElementById('btnThrusterForward').addEventListener('click', () => {
      Sound.thruster();
      // Forward thrust increases negative vx (approaching faster)
      this.vx -= 0.12;
      // Clohessy-Wiltshire cross-coupling: forward burn causes upward drift!
      this.vz += 0.04;
    });

    document.getElementById('btnThrusterRetro').addEventListener('click', () => {
      Sound.thruster();
      this.vx += 0.12;
    });

    document.getElementById('btnThrusterUp').addEventListener('click', () => {
      Sound.thruster();
      this.vz += 0.1;
    });

    document.getElementById('btnThrusterDown').addEventListener('click', () => {
      Sound.thruster();
      this.vz -= 0.1;
    });

    document.getElementById('btnThrusterPort').addEventListener('click', () => {
      Sound.thruster();
      this.vy -= 0.1;
    });

    document.getElementById('btnThrusterStbd').addEventListener('click', () => {
      Sound.thruster();
      this.vy += 0.1;
    });

    document.getElementById('btnAutopilot').addEventListener('click', (e) => {
      Sound.click();
      this.autopilot = !this.autopilot;
      e.target.textContent = `Autopilot: ${this.autopilot ? 'ACTIVE' : 'OFF'}`;
      e.target.classList.toggle('active', this.autopilot);
    });

    document.getElementById('btnAbort').addEventListener('click', () => {
      Sound.incorrect();
      this.autopilot = false;
      this.vx = 1.2; // Back away rapidly
      this.vz = 0.5; // Radial push away
      this.hudConeStatus.textContent = 'ABORT EXECUTING';
      this.hudConeStatus.className = 'hud-val text-coral';
    });

    document.getElementById('btnResetDock').addEventListener('click', () => {
      Sound.click();
      this.x = 85.0;
      this.y = 8.5;
      this.z = -5.0;
      this.vx = -0.55;
      this.vy = -0.08;
      this.vz = 0.04;
      this.docked = false;
      this.btnHardLock.disabled = true;
      this.btnHardLock.textContent = 'ENGAGE HARD LOCK';
    });

    this.btnHardLock.addEventListener('click', () => {
      Sound.dockLock();
      this.docked = true;
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      this.btnHardLock.textContent = 'HARD LOCK CONFIRMED (SEAL INTEGRITY 100%)';
      this.btnHardLock.classList.add('locked-success');
      celebrate();
    });

    this.resize();
    Simulators.onResize(() => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = 360;
  }

  animate() {
    if (!this.canvas) return;

    if (!this.docked) {
      if (this.autopilot) {
        // Autopilot guidance toward 0,0,0 with < 0.08 m/s closure
        const targetVx = Math.max(-0.25, -this.x * 0.03 - 0.05);
        this.vx += (targetVx - this.vx) * 0.05;
        this.vy += (-this.y * 0.08 - this.vy) * 0.06;
        this.vz += (-this.z * 0.08 - this.vz) * 0.06;
      }

      this.x += this.vx * 0.04;
      this.y += this.vy * 0.04;
      this.z += this.vz * 0.04;

      // Soft stop at docking contact
      if (this.x <= 0.2) {
        this.x = 0.2;
        if (Math.abs(this.vx) > 0.3) {
          // Bounced
          this.vx = 0.15;
          Sound.incorrect();
        } else {
          this.vx = 0;
        }
      }
    }

    this.updateHUD();
    this.render();
    Simulators.schedule(() => this.animate());
  }

  updateHUD() {
    const range = Math.max(0, this.x);
    const speed = Math.abs(this.vx);
    const lateralErr = Math.sqrt(this.y * this.y + this.z * this.z);

    this.hudRange.textContent = `${range.toFixed(1)} m`;
    this.hudRelV.textContent = `${speed.toFixed(2)} m/s`;
    this.hudOffset.textContent = `Y: ${this.y > 0 ? '+' : ''}${this.y.toFixed(1)}m | Z: ${this.z > 0 ? '+' : ''}${this.z.toFixed(1)}m`;

    if (speed < 0.10) {
      this.hudRelV.className = 'hud-val text-green';
    } else if (speed < 0.25) {
      this.hudRelV.className = 'hud-val text-gold';
    } else {
      this.hudRelV.className = 'hud-val text-coral';
    }

    const insideCone = lateralErr < (range * 0.2 + 0.8);
    if (this.docked) {
      this.hudConeStatus.textContent = 'HARD LOCK COMPLETE';
      this.hudConeStatus.className = 'hud-val text-green';
      this.hudLockReady.textContent = 'LATCHES ENGAGED';
      this.hudLockReady.className = 'hud-val text-green';
    } else if (range < 1.0 && insideCone && speed <= 0.12) {
      this.hudConeStatus.textContent = 'READY FOR HARD LOCK';
      this.hudConeStatus.className = 'hud-val text-green';
      this.hudLockReady.textContent = 'READY (PRESS BUTTON)';
      this.hudLockReady.className = 'hud-val text-green pulse-text';
      this.btnHardLock.disabled = false;
    } else if (insideCone) {
      this.hudConeStatus.textContent = 'INSIDE CONE (NOMINAL)';
      this.hudConeStatus.className = 'hud-val text-cyan';
      this.hudLockReady.textContent = speed <= 0.10 ? 'WAIT FOR CONTACT' : 'SPEED > 0.1 m/s';
      this.hudLockReady.className = 'hud-val text-gold';
      this.btnHardLock.disabled = true;
    } else {
      this.hudConeStatus.textContent = 'OUTSIDE CAPTURE CONE';
      this.hudConeStatus.className = 'hud-val text-coral';
      this.hudLockReady.textContent = 'ALIGNMENT REQ';
      this.hudLockReady.className = 'hud-val text-muted';
      this.btnHardLock.disabled = true;
    }
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Deep space cockpit view
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Distant Earth horizon in bottom background
    ctx.save();
    const earthGrad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    earthGrad.addColorStop(0, 'rgba(0, 150, 255, 0.0)');
    earthGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.25)');
    earthGrad.addColorStop(1, 'rgba(0, 80, 180, 0.6)');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.ellipse(cx, h + 200, w * 0.8, 300, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Perspective projection of ISS Docking Port
    // Distance scale
    const depth = Math.max(1.0, this.x);
    const projScale = 300 / depth;

    // Screen position with lateral and vertical offsets
    const portScreenX = cx - this.y * projScale;
    const portScreenY = cy - this.z * projScale;

    // Draw 3D Docking Capture Cone Wireframe
    ctx.save();
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.25)';
    ctx.lineWidth = 1;

    // Outer cone ring at chaser distance
    const coneRadiusAtChaser = (depth * 0.2 + 0.8) * projScale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, coneRadiusAtChaser, coneRadiusAtChaser * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Lines connecting cone vertex at target port to screen periphery
    const portRadius = 24 * (projScale / 12);
    ctx.beginPath();
    ctx.moveTo(portScreenX - portRadius, portScreenY);
    ctx.lineTo(cx - coneRadiusAtChaser, cy);
    ctx.moveTo(portScreenX + portRadius, portScreenY);
    ctx.lineTo(cx + coneRadiusAtChaser, cy);
    ctx.moveTo(portScreenX, portScreenY - portRadius * 0.85);
    ctx.lineTo(cx, cy - coneRadiusAtChaser * 0.85);
    ctx.moveTo(portScreenX, portScreenY + portRadius * 0.85);
    ctx.lineTo(cx, cy + coneRadiusAtChaser * 0.85);
    ctx.stroke();
    ctx.restore();

    // Draw ISS Module and Docking Adapter (IDA)
    ctx.save();
    ctx.translate(portScreenX, portScreenY);

    // ISS Module Body (Metallic cylinder)
    const modW = Math.min(w * 0.7, 70 * (projScale / 10));
    const modH = Math.min(h * 0.6, 50 * (projScale / 10));

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(-modW / 2, -modH / 2, modW, modH);
    ctx.strokeRect(-modW / 2, -modH / 2, modW, modH);

    // Docking Ring Outer
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#b0e3d9';
    ctx.lineWidth = Math.max(1.5, 3 * (projScale / 15));
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#b0e3d9';
    ctx.beginPath();
    ctx.arc(0, 0, portRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Docking Hatch Target Mark (Crosshairs & Petals)
    ctx.strokeStyle = '#f4d78a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, portRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Alignment guide petals
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (portRadius * 0.4), Math.sin(a) * (portRadius * 0.4));
      ctx.lineTo(Math.cos(a) * (portRadius * 0.9), Math.sin(a) * (portRadius * 0.9));
      ctx.stroke();
    }

    ctx.restore();

    // Cockpit Heads-Up Display (HUD) Crosshair in center
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = '#b0e3d9';
    ctx.lineWidth = 1.5;

    // Center reticle
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines with gap
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(-20, 0);
    ctx.moveTo(20, 0);
    ctx.lineTo(35, 0);
    ctx.moveTo(0, -35);
    ctx.lineTo(0, -20);
    ctx.moveTo(0, 20);
    ctx.lineTo(0, 35);
    ctx.stroke();

    // Flight path vector indicator
    const fpvX = -this.vy * 60;
    const fpvY = -this.vz * 60;
    ctx.strokeStyle = '#ffe08a';
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(fpvX, fpvY, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fpvX - 8, fpvY);
    ctx.lineTo(fpvX + 8, fpvY);
    ctx.moveTo(fpvX, fpvY - 8);
    ctx.lineTo(fpvX, fpvY);
    ctx.stroke();

    ctx.restore();
  }
}

// ============================================================================
// CHAPTER 5: KESSLER SYNDROME CHAIN SIMULATOR & DE-ORBIT PROPULSION CALCULATOR
// ============================================================================
class KesslerDebrisSim {
  constructor(container) {
    this.container = container;
    this.debrisCount = 120;
    this.particles = [];
    this.collisionsCount = 0;
    this.cascadeTriggered = false;
    this.scMass = 750; // kg
    this.orbitAlt = 700; // km
    this.initDOM();
    this.initParticles();
    this.animate();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="sim-wrapper">
        <div class="sim-hud-header">
          <div class="sim-title"><span class="neon-dot"></span> SPACE SUSTAINABILITY // KESSLER SYNDROME & DE-ORBIT LAB</div>
          <div class="sim-preset-buttons">
            <button class="hud-pill-btn text-coral" id="btnTriggerCollision">💥 TRIGGER HYPERVELOCITY COLLISION</button>
            <button class="hud-pill-btn" id="btnResetField">Reset Debris Field</button>
          </div>
        </div>

        <div class="kessler-split-grid">
          <!-- Left: Kessler Chain Collision Visualizer -->
          <div class="kessler-sim-box">
            <div class="sim-canvas-viewport">
              <canvas id="simCanvas5" class="sim-canvas"></canvas>
              <div class="sim-overlay-hud">
                <div class="hud-stat-box">
                  <span class="hud-label">TRACKED OBJECTS</span>
                  <span class="hud-val text-cyan" id="hudTracked">120</span>
                </div>
                <div class="hud-stat-box">
                  <span class="hud-label">CASCADING COLLISIONS</span>
                  <span class="hud-val text-coral" id="hudCollisions">0</span>
                </div>
                <div class="hud-stat-box">
                  <span class="hud-label">KESSLER RISK LEVEL</span>
                  <span class="hud-val text-green" id="hudRisk">CONTROLLED</span>
                </div>
              </div>
            </div>

            <div class="control-row mt-2">
              <label class="control-label">LEO Constellation Density: <span id="valDensity">120</span> objects</label>
              <input type="range" id="sliderDensity" min="60" max="400" step="20" value="120" class="hud-range">
            </div>
          </div>

          <!-- Right: De-orbit & Passivation Calculator -->
          <div class="deorbit-calc-box">
            <div class="calc-header">5-YEAR DE-ORBIT & PASSIVATION CALCULATOR</div>

            <div class="calc-inputs">
              <div class="control-row">
                <label class="control-label">Spacecraft Mass: <span id="valScMass">750</span> kg</label>
                <input type="range" id="sliderScMass" min="100" max="3000" step="50" value="750" class="hud-range">
              </div>
              <div class="control-row">
                <label class="control-label">Initial LEO Altitude: <span id="valScAlt">700</span> km</label>
                <input type="range" id="sliderScAlt" min="300" max="1400" step="25" value="700" class="hud-range">
              </div>
            </div>

            <div class="calc-results-list">
              <div class="metric-row">
                <span class="m-title">REQUIRED RETROGRADE Δv (TO LOWER PERIGEE TO 70km)</span>
                <span class="m-val text-cyan" id="calcDeltaV">174 m/s</span>
              </div>
              <div class="metric-row">
                <span class="m-title">PROPELLANT RESERVE NEEDED (Isp 220s)</span>
                <span class="m-val text-gold" id="calcFuel">58.2 kg</span>
              </div>
              <div class="metric-row">
                <span class="m-title">RE-ENTRY TIMEFRAME POST-BURN</span>
                <span class="m-val text-green" id="calcTime">< 90 days (Compliant with 5-yr rule)</span>
              </div>
            </div>

            <div class="passivation-checklist">
              <div class="chk-title">END-OF-LIFE PASSIVATION PROTOCOL</div>
              <label class="chk-item"><input type="checkbox" id="chkDepress" checked> Depressurize propellant tanks & manifolds</label>
              <label class="chk-item"><input type="checkbox" id="chkBatt" checked> Discharge and isolate lithium batteries</label>
              <label class="chk-item"><input type="checkbox" id="chkWheels" checked> Despin and safe ADCS momentum wheels</label>
              <button class="btn-execute-passivation" id="btnPassivate">EXECUTE PASSIVATION SEQUENCE</button>
              <div id="passivateStatus" class="passivate-status text-green"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('simCanvas5');
    this.ctx = this.canvas.getContext('2d');
    this.hudTracked = document.getElementById('hudTracked');
    this.hudCollisions = document.getElementById('hudCollisions');
    this.hudRisk = document.getElementById('hudRisk');

    // Controls
    document.getElementById('sliderDensity').addEventListener('input', (e) => {
      this.debrisCount = parseInt(e.target.value, 10);
      document.getElementById('valDensity').textContent = this.debrisCount;
      this.initParticles();
    });

    document.getElementById('btnTriggerCollision').addEventListener('click', () => {
      Sound.incorrect();
      this.triggerCascade();
    });

    document.getElementById('btnResetField').addEventListener('click', () => {
      Sound.click();
      this.collisionsCount = 0;
      this.cascadeTriggered = false;
      this.initParticles();
      this.hudCollisions.textContent = '0';
      this.hudRisk.textContent = 'CONTROLLED';
      this.hudRisk.className = 'hud-val text-green';
    });

    // Calculator inputs
    const sliderMass = document.getElementById('sliderScMass');
    sliderMass.addEventListener('input', (e) => {
      this.scMass = parseInt(e.target.value, 10);
      document.getElementById('valScMass').textContent = this.scMass;
      this.updateCalculator();
    });

    const sliderAlt = document.getElementById('sliderScAlt');
    sliderAlt.addEventListener('input', (e) => {
      this.orbitAlt = parseInt(e.target.value, 10);
      document.getElementById('valScAlt').textContent = this.orbitAlt;
      this.updateCalculator();
    });

    document.getElementById('btnPassivate').addEventListener('click', () => {
      Sound.victory();
      const status = document.getElementById('passivateStatus');
      status.textContent = '✓ PASSIVATION COMPLETED: Spacecraft fully discharged & depressurized. Zero stored chemical/kinetic energy remaining.';
    });

    this.resize();
    this.updateCalculator();
    Simulators.onResize(() => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = 360;
  }

  initParticles() {
    this.particles = [];
    const rEarth = 60;
    for (let i = 0; i < this.debrisCount; i++) {
      const radius = rEarth + 15 + Math.random() * 85;
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.015 + Math.random() * 0.01) * (Math.random() > 0.1 ? 1 : -1);
      const isSat = i % 4 === 0;
      this.particles.push({
        r: radius,
        angle: angle,
        speed: speed,
        size: isSat ? 3.5 : 1.5,
        isSat: isSat,
        color: isSat ? '#b0e3d9' : '#94a3b8',
        eccentricity: Math.random() * 0.15,
        tilt: (Math.random() - 0.5) * 0.6
      });
    }
    if (this.hudTracked) this.hudTracked.textContent = this.particles.length;
  }

  triggerCascade() {
    this.cascadeTriggered = true;
    this.collisionsCount += 3;
    // Spawn 45 hypervelocity fragments at impact point
    const impactR = 100;
    const impactAngle = Math.PI * 0.25;

    for (let i = 0; i < 45; i++) {
      this.particles.push({
        r: impactR + (Math.random() - 0.5) * 40,
        angle: impactAngle + (Math.random() - 0.5) * 0.5,
        speed: (Math.random() - 0.5) * 0.06,
        size: Math.random() * 2 + 1,
        isSat: false,
        color: '#ffc2bc',
        eccentricity: Math.random() * 0.4,
        tilt: (Math.random() - 0.5) * 1.5
      });
    }

    this.hudTracked.textContent = this.particles.length;
    this.hudCollisions.textContent = this.collisionsCount;
    this.hudRisk.textContent = 'RUNAWAY KESSLER CASCADE!';
    this.hudRisk.className = 'hud-val text-coral pulse-text';
  }

  updateCalculator() {
    const mu = 398600.4418;
    const rEarth = 6378;
    const r1 = rEarth + this.orbitAlt;
    const rTargetPerigee = rEarth + 70; // 70 km perigee ensures rapid atmospheric burnup

    // Hohmann retrograde burn to drop perigee from r1 to rTargetPerigee
    const aTransfer = (r1 + rTargetPerigee) / 2;
    const vCircular = Math.sqrt(mu / r1);
    const vTransferApogee = Math.sqrt(mu * (2 / r1 - 1 / aTransfer));
    const deltaV = Math.abs(vCircular - vTransferApogee) * 1000; // m/s

    // Fuel required via rocket equation
    const isp = 220; // hydrazine monoprop
    const g0 = 9.80665;
    const massRatio = Math.exp(deltaV / (isp * g0));
    const propNeeded = this.scMass * (1 - 1 / massRatio);

    document.getElementById('calcDeltaV').textContent = `${Math.round(deltaV)} m/s`;
    document.getElementById('calcFuel').textContent = `${propNeeded.toFixed(1)} kg`;

    const timeEl = document.getElementById('calcTime');
    if (this.orbitAlt > 1000) {
      timeEl.textContent = '< 180 days (Graveyard boost alternative)';
    } else {
      timeEl.textContent = '< 25 days (Direct atmospheric burnup)';
    }
  }

  animate() {
    if (!this.canvas) return;
    this.render();
    Simulators.schedule(() => this.animate());
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const rEarth = 52;

    // Earth in Center
    ctx.save();
    ctx.translate(cx, cy);

    // Atmosphere halo
    const atmosGrad = ctx.createRadialGradient(0, 0, rEarth - 5, 0, 0, rEarth + 15);
    atmosGrad.addColorStop(0, 'rgba(176, 227, 217, 0.4)');
    atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rEarth + 15, 0, Math.PI * 2);
    ctx.fill();

    // Earth Sphere
    ctx.fillStyle = '#0d254c';
    ctx.strokeStyle = '#b0e3d9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, rEarth, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7fa4ff';
    ctx.font = '10px "Orbitron", sans-serif';
    ctx.fillText('LEO SHELL', -30, 4);

    // Orbiting particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.angle += p.speed;

      const px = Math.cos(p.angle) * p.r;
      const py = Math.sin(p.angle) * p.r * (1 - p.eccentricity) + Math.sin(p.angle) * p.r * p.tilt * 0.4;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Debris trail if in cascade
      if (this.cascadeTriggered && p.color === '#ffc2bc') {
        ctx.strokeStyle = 'rgba(255, 194, 188, 0.2)';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - p.speed * 80, py);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
