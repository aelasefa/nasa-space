// Lunar Rover: the simulation (imported from Amanar, js/app.js).
// Three.js scene, low polar sun with hard shadows, four camera rigs, keyboard / pointer /
// headset input and the render loop. The original wired itself to its own page; here it
// is one object the page (React) creates in a container and talks to through methods and
// two callbacks, so it shares nothing with the rest of the product:
//   onTelemetry(reading)  about ten times a second, and right after every command
//   onNotice(text)        short status messages (what the original showed as toasts)
// Types: sim.d.ts.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { audioManager } from './audio.js';
import { LunarTerrain } from './terrain.js';
import { LunaRover } from './rover.js';
import { LunaHUD } from './hud.js';
import { SceneModels } from './models.js';

export const CAMERA_NAMES = ['Cockpit', 'Chase', 'Wheels', 'Orbit'];
export const SPEED_LIMITS_KMH = [3, 7, 12];
export const LIGHT_NAMES = ['Off', 'Low', 'High'];

const DRIVE_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const TELEMETRY_INTERVAL = 0.1;

class RoverSimulation {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this.clock = new THREE.Clock();
    this.disposers = [];

    // Camera view modes: 0 = cockpit mast cam, 1 = chase, 2 = wheel, 3 = free orbit
    this.cameraMode = 0;
    this.cameraOffsetChase = new THREE.Vector3(0, 2.8, 5.2);
    this.cameraOffsetWheel = new THREE.Vector3(-1.8, 0.8, -0.6);
    this.look = { yaw: 0, pitch: 0, pointer: null, x: 0, y: 0 };
    this.aimMatrix = new THREE.Matrix4();

    this.input = { throttle: 0, steer: 0, brake: false };
    this.pad = { fwd: false, rev: false, left: false, right: false, brake: false };
    this.keys = {};
    this.inputEnabled = true;
    this.vrThrottle = 0;
    this.lastTelemetry = 0;

    this.initRenderer();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000206);
    this.initCamera();
    this.initLighting();
    this.initDeepSpace();

    this.terrain = new LunarTerrain(this.scene);
    this.rover = new LunaRover(this.scene, this.terrain);
    this.hud = new LunaHUD(this.camera, this.rover, this.terrain);
    this.rover.autoNavTarget = this.hud.getCurrentWaypoint();
    this.models = new SceneModels(this.scene, this.terrain);

    this.setupXR();
    this.setupInput();
    this.renderer.setAnimationLoop(() => this.render());
    this.emit();
  }

  // ───────────────────────── Scene ─────────────────────────

  initRenderer() {
    // Throws when the browser cannot give a WebGL context: the page then shows its text fallback.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Hard shadows: with no air to scatter light, lunar shadows have sharp edges.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(canvas);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 8000);
    // The dolly moves with the rover; in VR the headset pose is applied inside it.
    this.cameraDolly = new THREE.Group();
    this.scene.add(this.cameraDolly);
    this.cameraDolly.add(this.camera);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.minDistance = 3;
    this.orbitControls.maxDistance = 60;
    this.orbitControls.maxPolarAngle = Math.PI * 0.49;
    this.orbitControls.enabled = false;
    this.resize();
  }

  initLighting() {
    // A sun 4° above the horizon, as near the lunar poles.
    const radElev = THREE.MathUtils.degToRad(4.0);
    const radAzim = THREE.MathUtils.degToRad(135.0);
    const sunDist = 800;

    this.sunLight = new THREE.DirectionalLight(0xfffbf0, 3.5);
    this.sunLight.position.set(
      sunDist * Math.cos(radElev) * Math.sin(radAzim),
      sunDist * Math.sin(radElev),
      sunDist * Math.cos(radElev) * Math.cos(radAzim));
    this.sunLight.castShadow = true;
    // A smaller shadow map on phones keeps the frame rate usable.
    const mapSize = Math.min(this.renderer.capabilities.maxTextureSize, window.innerWidth < 800 ? 2048 : 4096);
    this.sunLight.shadow.mapSize.set(mapSize, mapSize);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 1600;
    const box = 350;
    this.sunLight.shadow.camera.left = -box;
    this.sunLight.shadow.camera.right = box;
    this.sunLight.shadow.camera.top = box;
    this.sunLight.shadow.camera.bottom = -box;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunOffset = this.sunLight.position.clone();

    const earthshine = new THREE.DirectionalLight(0x406085, 0.12);
    earthshine.position.set(-200, 150, 400);
    this.scene.add(earthshine);
    this.scene.add(new THREE.AmbientLight(0x0a1018, 0.06));
  }

  initDeepSpace() {
    const starCount = 3500;
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = 4000;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 50;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const kind = Math.random();
      const color = kind > 0.8 ? [0.8, 0.9, 1.0] : kind > 0.6 ? [1.0, 0.85, 0.7] : [0.95, 0.95, 0.95];
      starColors.set(color, i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 2.2, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: false,
    })));

    // A stylized Earth low on the horizon (drawn, not a photograph).
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#081a3a';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#2d5a3f';
    for (let c = 0; c < 24; c++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, 25 + Math.random() * 35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let cl = 0; cl < 35; cl++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 256, 60 + Math.random() * 80, 12, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(45, 32, 32), new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(canvas), roughness: 0.6, metalness: 0.1, emissive: 0x051228, emissiveIntensity: 0.3,
    }));
    this.earthMesh.position.set(-600, 180, 2200);
    this.scene.add(this.earthMesh);

    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(28, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sunDisc.position.copy(this.sunLight.position);
    sunDisc.lookAt(0, 0, 0);
    this.scene.add(sunDisc);
  }

  // ───────────────────────── Headset (WebXR) ─────────────────────────

  setupXR() {
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      // Left trigger drives forward while held; right trigger cycles the headlights.
      controller.addEventListener('selectstart', () => { if (i === 0) this.vrThrottle = 1; else this.toggleHeadlights(); });
      controller.addEventListener('selectend', () => { if (i === 0) this.vrThrottle = 0; });
      this.cameraDolly.add(controller);
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.5)]),
        new THREE.LineBasicMaterial({ color: 0xb0e3d9, transparent: true, opacity: 0.5 }));
      controller.add(ray);
    }
    const started = () => {
      this.setCamera(0);
      this.wakeAudio();
      this.notice('Headset session started. Left stick drives, right stick turns.');
    };
    const ended = () => { this.vrThrottle = 0; this.resize(); this.notice('Headset session ended.'); this.emit(); };
    this.renderer.xr.addEventListener('sessionstart', started);
    this.renderer.xr.addEventListener('sessionend', ended);
  }

  async vrSupported() {
    try { return Boolean(navigator.xr) && await navigator.xr.isSessionSupported('immersive-vr'); }
    catch { return false; }
  }

  async enterVR() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await this.renderer.xr.setSession(session);
  }

  async exitVR() {
    const session = this.renderer.xr.getSession();
    if (session) await session.end();
  }

  // ───────────────────────── Input ─────────────────────────

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.disposers.push(() => target.removeEventListener(type, handler, options));
  }

  setupInput() {
    this.listen(window, 'keydown', (event) => this.onKeyDown(event));
    this.listen(window, 'keyup', (event) => { this.keys[event.code] = false; });
    // A key released while the window is elsewhere must not leave the rover driving.
    this.listen(window, 'blur', () => this.releaseAll());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.releaseAll(); });

    // Look around from the cockpit: drag with a mouse, a finger or a pen.
    const canvas = this.renderer.domElement;
    this.listen(canvas, 'pointerdown', (event) => {
      this.wakeAudio();
      if (this.cameraMode !== 0) return;
      this.look.pointer = event.pointerId;
      this.look.x = event.clientX;
      this.look.y = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });
    this.listen(canvas, 'pointermove', (event) => {
      if (this.cameraMode !== 0 || this.look.pointer !== event.pointerId) return;
      this.look.yaw -= (event.clientX - this.look.x) * 0.003;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - (event.clientY - this.look.y) * 0.003, -Math.PI / 3, Math.PI / 4);
      this.look.x = event.clientX;
      this.look.y = event.clientY;
    });
    const release = (event) => { if (this.look.pointer === event.pointerId) this.look.pointer = null; };
    this.listen(canvas, 'pointerup', release);
    this.listen(canvas, 'pointercancel', release);
    this.listen(canvas, 'dblclick', () => { if (this.cameraMode === 0) { this.look.yaw = 0; this.look.pitch = 0; } });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  onKeyDown(event) {
    if (!this.inputEnabled || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    // Space on a focused button presses that button. It is not also the brake.
    if (event.code === 'Space' && target && target.closest('button, a, summary')) return;
    this.wakeAudio();
    if (DRIVE_KEYS.has(event.code)) {
      event.preventDefault(); // arrows and Space must not scroll the page under the rover
      this.keys[event.code] = true;
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyH') this.toggleHeadlights();
    else if (event.code === 'KeyC') this.cycleCamera();
    else if (event.code === 'KeyT') this.nextTarget();
    else if (event.code === 'KeyR') this.reset();
  }

  releaseAll() {
    this.keys = {};
    for (const key of Object.keys(this.pad)) this.pad[key] = false;
    this.look.pointer = null;
  }

  wakeAudio() {
    audioManager.init();
    audioManager.resume();
  }

  updateInput() {
    let throttle = this.vrThrottle;
    let steer = 0;
    let brake = false;

    if (this.inputEnabled) {
      if (this.keys.KeyW || this.keys.ArrowUp) throttle += 1.0;
      if (this.keys.KeyS || this.keys.ArrowDown) throttle -= 1.0;
      if (this.keys.KeyA || this.keys.ArrowLeft) steer -= 1.0;
      if (this.keys.KeyD || this.keys.ArrowRight) steer += 1.0;
      if (this.keys.Space) brake = true;
    }

    if (this.pad.fwd) throttle += 1.0;
    if (this.pad.rev) throttle -= 1.0;
    if (this.pad.left) steer -= 1.0;
    if (this.pad.right) steer += 1.0;
    if (this.pad.brake) brake = true;

    // Headset controllers: left stick drives, right stick turns
    const session = this.renderer.xr.getSession();
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        const axes = source.gamepad && source.gamepad.axes;
        if (axes && axes.length >= 4) {
          if (Math.abs(axes[3]) > 0.1) throttle -= axes[3];
          if (Math.abs(axes[2]) > 0.1) steer += axes[2];
        }
      }
    }

    // Any manual input hands control back to the driver.
    if (this.rover.isAutoNav && (Math.abs(throttle) > 0.1 || Math.abs(steer) > 0.1 || brake)) {
      this.rover.isAutoNav = false;
      this.notice('Auto-drive off. You have control.');
    }

    this.input.throttle = THREE.MathUtils.clamp(throttle, -1, 1);
    this.input.steer = THREE.MathUtils.clamp(steer, -1, 1);
    this.input.brake = brake;
  }

  // ───────────────────────── Commands (the page's buttons and the keyboard) ─────────────────────────

  setDrive(control, active) {
    if (!(control in this.pad)) return;
    this.pad[control] = Boolean(active);
    if (active) this.wakeAudio();
  }

  setInputEnabled(enabled) {
    this.inputEnabled = Boolean(enabled);
    if (!enabled) this.releaseAll();
  }

  setCamera(mode) {
    this.cameraMode = ((mode % 4) + 4) % 4;
    this.look.yaw = 0;
    this.look.pitch = 0;
    this.look.pointer = null;
    if (this.cameraMode === 3) {
      // Orbit works in world space: park the dolly at the origin and move the camera itself.
      this.cameraDolly.position.set(0, 0, 0);
      this.cameraDolly.quaternion.identity();
      const behind = new THREE.Vector3(4, 3.5, 8).applyQuaternion(this.rover.root.quaternion);
      this.camera.position.copy(this.rover.position).add(behind);
      this.orbitControls.target.copy(this.rover.position);
      this.orbitControls.enabled = true;
      this.orbitControls.update();
    } else {
      this.orbitControls.enabled = false;
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
    }
    this.notice(`Camera: ${CAMERA_NAMES[this.cameraMode]}.`);
    this.emit();
    return this.cameraMode;
  }

  cycleCamera() { return this.setCamera(this.cameraMode + 1); }

  toggleHeadlights() {
    const level = this.rover.toggleHeadlights();
    this.notice(`Headlights: ${LIGHT_NAMES[level].toLowerCase()}.`);
    this.emit();
    return level;
  }

  setSpeedLimit(kmh) {
    const preset = SPEED_LIMITS_KMH.indexOf(kmh) + 1;
    if (!preset) return;
    this.rover.setSpeedPreset(preset);
    this.notice(`Speed limit: ${kmh} km/h.`);
    this.emit();
  }

  toggleAutoNav() {
    this.rover.autoNavTarget = this.hud.getCurrentWaypoint();
    this.rover.isAutoNav = !this.rover.isAutoNav;
    if (this.rover.isAutoNav) audioManager.playQuindar(2200, 0.1);
    this.notice(this.rover.isAutoNav ? `Auto-drive on: heading for ${this.rover.autoNavTarget.name}.` : 'Auto-drive off. You have control.');
    this.emit();
    return this.rover.isAutoNav;
  }

  nextTarget() {
    const waypoint = this.hud.cycleWaypoint();
    this.rover.autoNavTarget = waypoint;
    audioManager.playQuindar(2200, 0.08);
    this.notice(`Target: ${waypoint.name}.`);
    this.emit();
    return waypoint.name;
  }

  drill() {
    if (this.rover.isDrilling) return;
    this.rover.triggerDrillScan();
    this.notice('Drilling. The rover holds still for three seconds.');
    this.emit();
  }

  alignToSun() {
    this.rover.reacquireSun();
    this.notice('Turned the solar wings toward the Sun.');
    this.emit();
  }

  reset() {
    this.rover.resetToStart();
    this.rover.updateOrientation(1);
    if (this.cameraMode === 3) this.setCamera(3);
    this.notice('Back on the sunlit rim.');
    this.emit();
  }

  setMuted(muted) {
    audioManager.setMuted(muted);
    if (!muted) this.wakeAudio();
  }

  async loadModel(source, scale = 1) {
    if (typeof source === 'string') await this.models.loadFromURL(source, scale);
    else await this.models.loadFromFile(source);
  }

  clearModel() { this.models.clear(); }

  // ───────────────────────── Loop ─────────────────────────

  notice(text) { this.handlers.onNotice?.(text); }

  emit() {
    this.handlers.onTelemetry?.({
      ...this.hud.read(),
      camera: this.cameraMode,
      presenting: this.renderer.xr.isPresenting,
      hasModel: Boolean(this.models.active),
    });
  }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Point the dolly's camera at a world position. (Object3D.lookAt turns +Z toward the
  // target, which for a camera's parent means looking away from it.)
  aim(target) {
    this.cameraDolly.quaternion.setFromRotationMatrix(this.aimMatrix.lookAt(this.cameraDolly.position, target, this.cameraDolly.up));
  }

  updateCamera() {
    const rover = this.rover;
    if (this.renderer.xr.isPresenting || this.cameraMode === 0) {
      // Mast camera: on the front mast, 1.8 m up, turning with the chassis.
      rover.cockpitAnchor.getWorldPosition(this.cameraDolly.position);
      this.cameraDolly.quaternion.copy(rover.root.quaternion);
      if (!this.renderer.xr.isPresenting) {
        // Tilted down about 12° so the solar wings and front wheels sit in the foreground.
        this.cameraDolly.quaternion.multiply(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-0.22 + this.look.pitch, this.look.yaw, 0, 'YXZ')));
      }
    } else if (this.cameraMode === 1) {
      const target = rover.position.clone().add(this.cameraOffsetChase.clone().applyQuaternion(rover.root.quaternion));
      this.cameraDolly.position.lerp(target, 0.15);
      this.aim(rover.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    } else if (this.cameraMode === 2) {
      this.cameraDolly.position.copy(rover.position).add(this.cameraOffsetWheel.clone().applyQuaternion(rover.root.quaternion));
      this.aim(new THREE.Vector3(-1.15, 0.32, -1.25).applyQuaternion(rover.root.quaternion).add(rover.position));
    } else {
      // Free orbit: keep the rover in the middle as it moves.
      const moved = rover.position.clone().sub(this.orbitControls.target);
      this.camera.position.add(moved);
      this.orbitControls.target.copy(rover.position);
      this.orbitControls.update();
    }
  }

  render() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    this.updateInput();
    const wasDrilling = this.rover.isDrilling;
    this.rover.update(delta, this.input);
    if (wasDrilling && !this.rover.isDrilling && this.rover.lastScienceResult) {
      this.notice(`Drill sample: ${this.rover.lastScienceResult.wehPercent} wt% water-equivalent hydrogen (simulated).`);
      this.emit();
    }
    this.updateCamera();
    this.hud.update(elapsed, this.renderer.xr.isPresenting);

    // The sun's shadow box follows the rover, keeping the sun's direction fixed.
    this.sunLight.target.position.copy(this.rover.position);
    this.sunLight.position.copy(this.rover.position).add(this.sunOffset);
    this.earthMesh.rotation.y = elapsed * 0.015;

    if (elapsed - this.lastTelemetry >= TELEMETRY_INTERVAL) {
      this.lastTelemetry = elapsed;
      this.emit();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.exitVR().catch(() => {});
    for (const off of this.disposers) off();
    this.disposers = [];
    this.resizeObserver?.disconnect();
    this.orbitControls.dispose();
    audioManager.dispose();
    this.scene.traverse((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value && value.isTexture) value.dispose();
        material.dispose?.();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Start the rover simulation inside `container`. Throws when WebGL is unavailable. */
export function createRoverSim(container, handlers = {}) {
  return new RoverSimulation(container, handlers);
}
