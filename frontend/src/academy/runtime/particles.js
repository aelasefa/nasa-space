// Training Academy: celebration burst (imported from AmanarII, js/particles.js).
// A short confetti burst when a chapter is passed. Purely decorative: it is skipped when
// the visitor prefers reduced motion, and the result is always stated in text.

class ParticleSystem {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'academy-confetti';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(x = window.innerWidth / 2, y = window.innerHeight * 0.45, count = 100, isGrand = false) {
    const colors = isGrand 
      ? ['#f4d78a', '#ffe08a', '#b0e3d9', '#e7edf0', '#d9fff7']
      : ['#b0e3d9', '#d9fff7', '#f4d78a', '#e7edf0'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isGrand ? 12 : 8) + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isGrand ? 4 : 2),
        size: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 15,
        alpha: 1,
        gravity: 0.16,
        drag: 0.97,
        shape: Math.random() > 0.4 ? 'rect' : 'star',
        decay: Math.random() * 0.012 + 0.008
      });
    }

    if (!this.animId) {
      this.animate();
    }
  }

  launchCelebration(isCommander = false) {
    this.resize();
    const count = isCommander ? 160 : 100;
    this.burst(window.innerWidth * 0.5, window.innerHeight * 0.4, count, isCommander);
    setTimeout(() => {
      this.burst(window.innerWidth * 0.3, window.innerHeight * 0.35, count * 0.6, isCommander);
      this.burst(window.innerWidth * 0.7, window.innerHeight * 0.35, count * 0.6, isCommander);
    }, 250);
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      } else {
        // Star shape
        this.drawStar(0, 0, 5, p.size, p.size * 0.5);
      }
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.animate());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    this.ctx.lineTo(cx, cy - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
  }
}

let system = null;

/** One burst; a bigger one for the final chapter. Does nothing under reduced motion. */
export function celebrate(grand = false) {
  if (typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!system) system = new ParticleSystem();
  system.launchCelebration(grand);
}
