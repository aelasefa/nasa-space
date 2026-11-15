// Lunar Rover: telemetry and the in-headset HUD (imported from Amanar, js/hud.js).
// `readTelemetry` is the single reading of the rover's state. The page's own HUD (React)
// and the floating panel drawn here both use it. The floating panel sits one metre in
// front of the camera and is shown in VR only: on a flat screen it would cover the view.
// All values are illustrative game values.

import * as THREE from 'three';

/** One reading of the rover: what the HUDs show. Plain data, no three.js objects. */
export function readTelemetry(rover, terrain, waypoint) {
  const dx = waypoint.x - rover.position.x;
  const dz = waypoint.z - rover.position.z;
  const targetAngle = Math.atan2(dx, dz);
  const roverAngle = Math.atan2(-Math.sin(rover.heading), -Math.cos(rover.heading));
  let bearing = targetAngle - roverAngle;
  while (bearing > Math.PI) bearing -= Math.PI * 2;
  while (bearing < -Math.PI) bearing += Math.PI * 2;
  const iceSignal = terrain.getIceConcentration(rover.position.x, rover.position.z);
  const attitude = rover.getAttitude();
  return {
    speedKmh: rover.getSpeedKmh(),
    speedLimitKmh: rover.maxSpeedKmh,
    batteryPct: rover.batteryJoules,
    solarW: Math.round(rover.solarPowerWatts),
    loadW: Math.round(rover.rcsPowerWatts),
    thermalMarginC: rover.thermalMarginC,
    pitchDeg: attitude.pitch,
    rollDeg: attitude.roll,
    targetName: waypoint.name,
    targetDistanceM: Math.round(Math.hypot(dx, dz)),
    targetBearingDeg: Math.round(THREE.MathUtils.radToDeg(bearing)),
    targetBearingRad: bearing,
    iceSignal,
    icePercent: iceSignal * (waypoint.h2oPercent || 5.6),
    inShadow: terrain.isPositionInPSR(rover.position.x, rover.position.z),
    braking: rover.isBraking,
    autoNav: rover.isAutoNav,
    drilling: rover.isDrilling,
    sample: rover.lastScienceResult ? Number(rover.lastScienceResult.wehPercent) : null,
    headlights: rover.headlightLevel
  };
}

export class LunaHUD {
  constructor(camera, rover, terrain) {
    this.camera = camera;
    this.rover = rover;
    this.terrain = terrain;

    // 3D VR HUD objects
    this.hudMesh = null;
    this.canvas = null;
    this.ctx = null;
    this.texture = null;

    // Active waypoint
    this.currentWaypointIndex = 0;
    this.waypoints = this.terrain.iceDepositLocations;

    // Last update timestamp for throttling canvas redraws
    this.lastDrawTime = 0;
    this.drawInterval = 1 / 30; // 30 FPS HUD canvas update

    this.init();
  }

  init() {
    this.create3DHUD();
  }

  // The floating panel: a canvas texture one metre in front of the VR camera
  create3DHUD() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1536;
    this.canvas.height = 768;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    const hudGeo = new THREE.PlaneGeometry(1.35, 0.675);
    const hudMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.94,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.hudMesh = new THREE.Mesh(hudGeo, hudMat);
    this.hudMesh.position.set(0, 0.2, -1.0);
    this.hudMesh.renderOrder = 999;
    this.hudMesh.visible = false;

    this.camera.add(this.hudMesh);
  }

  cycleWaypoint() {
    this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    return this.waypoints[this.currentWaypointIndex];
  }

  getCurrentWaypoint() {
    return this.waypoints[this.currentWaypointIndex];
  }

  // `inHeadset` is true while a WebXR session is presenting.
  update(time, inHeadset) {
    this.hudMesh.visible = inHeadset;
    if (inHeadset && time - this.lastDrawTime >= this.drawInterval) {
      this.lastDrawTime = time;
      this.draw3DHUD();
    }
  }

  read() {
    return readTelemetry(this.rover, this.terrain, this.getCurrentWaypoint());
  }

  // Draw 3D HUD onto CanvasTexture
  draw3DHUD() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const t = this.read();
    const speedKmh = t.speedKmh;
    const batteryPct = t.batteryPct;
    const solarW = t.solarW;
    const rcsW = t.loadW;
    const thermalC = t.thermalMarginC;
    const attitude = { pitch: t.pitchDeg, roll: t.rollDeg };
    const wp = this.getCurrentWaypoint();
    const distM = t.targetDistanceM;
    const relBearingRad = t.targetBearingRad;
    const relBearingDeg = t.targetBearingDeg;
    const iceConc = t.iceSignal;
    const icePercent = t.icePercent.toFixed(1);
    const inPSR = t.inShadow;

    // 1. Panel frame
    ctx.save();

    ctx.fillStyle = 'rgba(3, 6, 12, 0.6)';
    this.roundRect(ctx, 30, 20, w - 60, h - 40, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(176, 227, 217, 0.35)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 30, 20, w - 60, h - 40, 16);
    ctx.stroke();

    this.drawCornerBrackets(ctx, 30, 20, w - 60, h - 40, 24);

    // 2. Top Header Status Bar
    ctx.fillStyle = '#b0e3d9';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('AMANAR ROVER // SIMULATED DRIVE', 60, 62);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#a3b1bf';
    ctx.fillText('PROCEDURAL TERRAIN • ILLUSTRATIVE TELEMETRY', 60, 88);

    if (inPSR) {
      ctx.fillStyle = thermalC < 0 ? '#ffc2bc' : '#f5d498';
      ctx.fillText('● IN PERMANENT SHADOW', w - 420, 62);
    } else {
      ctx.fillStyle = '#b0e3d9';
      ctx.fillText('● SUNLIT RIM // SOLAR POWER ON', w - 420, 62);
    }

    ctx.strokeStyle = 'rgba(176, 227, 217, 0.2)';
    ctx.beginPath();
    ctx.moveTo(60, 102);
    ctx.lineTo(w - 60, 102);
    ctx.stroke();

    // 3. LEFT POD: SPEEDOMETER & ATTITUDE
    const speedX = 220;
    const speedY = 300;
    const speedRadius = 105;

    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(speedX, speedY, speedRadius, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();

    const speedRatio = Math.min(Math.abs(speedKmh) / 12.0, 1.0);
    const speedEndAngle = Math.PI * 0.75 + speedRatio * (Math.PI * 1.5);
    ctx.strokeStyle = speedKmh >= 0 ? '#b0e3d9' : '#f5d498';
    ctx.beginPath();
    ctx.arc(speedX, speedY, speedRadius, Math.PI * 0.75, speedEndAngle);
    ctx.stroke();

    ctx.fillStyle = '#e7edf0';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.abs(speedKmh).toFixed(1), speedX, speedY + 14);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#b0e3d9';
    ctx.fillText('KM / H', speedX, speedY + 44);

    ctx.font = '14px monospace';
    ctx.fillStyle = this.rover.isBraking ? '#ffc2bc' : (this.rover.isAutoNav ? '#b0e3d9' : (speedKmh < -0.1 ? '#f5d498' : '#b0e3d9'));
    ctx.fillText(this.rover.isBraking ? '[BRAKE ENGAGED]' : (this.rover.isAutoNav ? '[AUTO-NAV ACTIVE]' : (speedKmh < -0.1 ? '[REV]' : '[FORWARD]')), speedX, speedY + 68);

    // Inclinometer / Attitude Box
    const incY = 495;
    ctx.fillStyle = 'rgba(15, 24, 36, 0.82)';
    this.roundRect(ctx, 70, incY, 300, 145, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.25)';
    this.roundRect(ctx, 70, incY, 300, 145, 8);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#a3b1bf';
    ctx.font = '13px monospace';
    ctx.fillText('CHASSIS ATTITUDE', 90, incY + 28);

    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = Math.abs(attitude.pitch) > 20 ? '#f5d498' : '#e7edf0';
    ctx.fillText(`PITCH: ${attitude.pitch >= 0 ? '+' : ''}${attitude.pitch.toFixed(1)}°`, 90, incY + 65);

    ctx.fillStyle = Math.abs(attitude.roll) > 18 ? '#ffc2bc' : '#e7edf0';
    ctx.fillText(`ROLL:  ${attitude.roll >= 0 ? '+' : ''}${attitude.roll.toFixed(1)}°`, 90, incY + 98);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#a3b1bf';
    ctx.fillText('SLOPE WARNING ABOVE 20°', 90, incY + 128);

    // 4. CENTER POD: WAYPOINT NAV & BEARING ARROW
    const navCenterX = w / 2;
    const navCenterY = 300;

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.3)';
    ctx.beginPath();
    ctx.arc(navCenterX, navCenterY, 105, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(navCenterX + cosA * 98, navCenterY + sinA * 98);
      ctx.lineTo(navCenterX + cosA * 105, navCenterY + sinA * 105);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(navCenterX, navCenterY);
    ctx.rotate(relBearingRad);

    ctx.fillStyle = '#f4d78a';
    ctx.beginPath();
    ctx.moveTo(0, -85);
    ctx.lineTo(15, -52);
    ctx.lineTo(5, -56);
    ctx.lineTo(5, 36);
    ctx.lineTo(-5, 36);
    ctx.lineTo(-5, -56);
    ctx.lineTo(-15, -52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#e7edf0';
    ctx.fillText(`${distM} M`, navCenterX, navCenterY + 148);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#f4d78a';
    ctx.fillText(wp.name.toUpperCase(), navCenterX, navCenterY + 178);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#a3b1bf';
    ctx.fillText(`BEARING: ${relBearingDeg >= 0 ? '+' : ''}${relBearingDeg}° RELATIVE`, navCenterX, navCenterY + 204);

    // 5. RIGHT POD: POWER, THERMAL & VOLATILES SPECTROMETER
    const rightX = w - 460;
    const rightY = 120;

    // Power Panel
    ctx.fillStyle = 'rgba(15, 24, 36, 0.82)';
    this.roundRect(ctx, rightX, rightY, 390, 150, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.25)';
    this.roundRect(ctx, rightX, rightY, 390, 150, 8);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#a3b1bf';
    ctx.font = '13px monospace';
    ctx.fillText('POWER', rightX + 20, rightY + 28);

    ctx.fillStyle = '#e7edf0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`BATTERY: ${batteryPct.toFixed(1)}%`, rightX + 20, rightY + 60);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(rightX + 20, rightY + 70, 350, 10);
    ctx.fillStyle = batteryPct < 25 ? '#ffc2bc' : '#b0e3d9';
    ctx.fillRect(rightX + 20, rightY + 70, 350 * (batteryPct / 100), 10);

    ctx.font = '13px monospace';
    ctx.fillStyle = inPSR ? '#a3b1bf' : '#b0e3d9';
    ctx.fillText(`SOLAR GEN: +${solarW} W`, rightX + 20, rightY + 106);

    ctx.fillStyle = '#f5d498';
    ctx.fillText(`DRIVE + LIGHTS: -${rcsW} W`, rightX + 20, rightY + 130);

    // Thermal Panel
    const thermY = rightY + 165;
    ctx.fillStyle = 'rgba(15, 24, 36, 0.82)';
    this.roundRect(ctx, rightX, thermY, 390, 150, 8);
    ctx.fill();
    ctx.strokeStyle = thermalC < 0 ? 'rgba(255, 194, 188, 0.6)' : 'rgba(176, 227, 217, 0.25)';
    this.roundRect(ctx, rightX, thermY, 390, 150, 8);
    ctx.stroke();

    ctx.fillStyle = '#a3b1bf';
    ctx.font = '13px monospace';
    ctx.fillText('THERMAL MARGIN ABOVE COLD LIMIT', rightX + 20, thermY + 28);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = thermalC < 0 ? '#ffc2bc' : (thermalC < 10 ? '#f5d498' : '#b0e3d9');
    ctx.fillText(`${thermalC >= 0 ? '+' : ''}${thermalC.toFixed(1)} °C`, rightX + 20, thermY + 65);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(rightX + 20, thermY + 78, 350, 10);
    const thermRatio = Math.max(0, Math.min((thermalC + 40) / 75, 1));
    ctx.fillStyle = thermalC < 0 ? '#ffc2bc' : (thermalC < 10 ? '#f5d498' : '#b0e3d9');
    ctx.fillRect(rightX + 20, thermY + 78, 350 * thermRatio, 10);

    ctx.font = '12px monospace';
    ctx.fillStyle = thermalC < 0 ? '#ffc2bc' : '#a3b1bf';
    ctx.fillText(thermalC < 0 ? 'BELOW THE COLD LIMIT' : 'THERMAL MARGIN OK', rightX + 20, thermY + 118);

    // Volatiles / Spectrometer Panel
    const iceY = thermY + 165;
    ctx.fillStyle = 'rgba(15, 24, 36, 0.82)';
    this.roundRect(ctx, rightX, iceY, 390, 150, 8);
    ctx.fill();
    ctx.strokeStyle = iceConc > 0.3 ? 'rgba(176, 227, 217, 0.6)' : 'rgba(176, 227, 217, 0.25)';
    this.roundRect(ctx, rightX, iceY, 390, 150, 8);
    ctx.stroke();

    ctx.fillStyle = '#a3b1bf';
    ctx.font = '13px monospace';
    ctx.fillText('ICE SIGNAL (SIMULATED)', rightX + 20, iceY + 28);

    ctx.font = 'bold 19px monospace';
    ctx.fillStyle = iceConc > 0.2 ? '#b0e3d9' : '#e7edf0';
    ctx.fillText(`SIGNAL: ${icePercent} wt% (GAME VALUE)`, rightX + 20, iceY + 60);

    const barX = rightX + 20;
    const barY = iceY + 78;
    for (let b = 0; b < 18; b++) {
      const active = (b / 18) <= iceConc;
      ctx.fillStyle = active ? '#b0e3d9' : 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX + b * 19, barY, 15, 20);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = iceConc > 0.4 ? '#b0e3d9' : '#a3b1bf';
    ctx.fillText(iceConc > 0.4 ? 'STRONG SIMULATED SIGNAL' : 'SEARCHING...', rightX + 20, iceY + 128);

    // 6. BOTTOM BAR: MISSION CONTROL TELECOMMAND ROW IN VR
    const mcBarY = h - 90;
    ctx.fillStyle = 'rgba(15, 24, 36, 0.9)';
    this.roundRect(ctx, 60, mcBarY, w - 120, 50, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 227, 217, 0.35)';
    this.roundRect(ctx, 60, mcBarY, w - 120, 50, 6);
    ctx.stroke();

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#b0e3d9';
    ctx.textAlign = 'left';
    ctx.fillText('ROVER STATUS:', 80, mcBarY + 31);

    ctx.font = '13px monospace';
    ctx.fillStyle = this.rover.isAutoNav ? '#b0e3d9' : '#a3b1bf';
    ctx.fillText(`AUTO-DRIVE: [${this.rover.isAutoNav ? 'ON' : 'STANDBY'}]`, 390, mcBarY + 31);

    ctx.fillStyle = this.rover.isDrilling ? '#f5d498' : '#a3b1bf';
    ctx.fillText(`DRILL: [${this.rover.isDrilling ? 'SAMPLING...' : 'READY'}]`, 820, mcBarY + 31);

    ctx.fillStyle = '#a3b1bf';
    ctx.fillText(`SPEED LIMIT: [${this.rover.maxSpeedKmh} KM/H]`, 1120, mcBarY + 31);

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  // Canvas utility: rounded rectangle
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Canvas utility: HUD corner brackets
  drawCornerBrackets(ctx, x, y, width, height, len) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#b0e3d9';
    ctx.beginPath();
    ctx.moveTo(x, y + len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + width - len, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + len);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + height - len);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + len, y + height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + width - len, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - len);
    ctx.stroke();
  }
}
