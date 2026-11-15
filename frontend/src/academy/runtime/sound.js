// Training Academy: sound effects (imported from AmanarII, js/audio.js).
// Short synthesized tones for clicks, right and wrong answers and a passed chapter. No
// audio files. The Academy page owns the on/off preference and passes it in.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  isMuted() {
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1, delay = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // UI Click
  click() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    this.playTone(880, 'sine', 0.04, 0.06);
  }

  // Subtle telemetry blip
  blip() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    this.playTone(1200, 'triangle', 0.06, 0.04);
  }

  // Correct answer
  correct() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    // Harmonic arpeggio (C5 - E5 - G5 - C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.25, 0.08, idx * 0.06);
    });
  }

  // Wrong answer
  incorrect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const startTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, startTime);
    osc.frequency.exponentialRampToValueAtTime(80, startTime + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, startTime);
    filter.frequency.exponentialRampToValueAtTime(200, startTime + 0.28);

    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  }

  // Chapter Passed / Victory Fanfare (>= 8/10)
  victory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const chord1 = [440, 554.37, 659.25]; // A major
    const chord2 = [587.33, 739.99, 880];  // D major
    const chord3 = [659.25, 830.61, 987.77, 1318.51]; // E major high

    chord1.forEach(f => this.playTone(f, 'sine', 0.25, 0.06, 0.0));
    chord2.forEach(f => this.playTone(f, 'sine', 0.3, 0.07, 0.2));
    chord3.forEach(f => this.playTone(f, 'triangle', 0.6, 0.09, 0.45));
  }

  // Final chapter passed
  commanderUnlocked() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    // Grand fanfare
    const times = [0, 0.15, 0.3, 0.45, 0.7, 0.95, 1.3];
    const freqs = [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 1046.50];
    freqs.forEach((f, i) => {
      this.playTone(f, 'sine', i === 6 ? 0.9 : 0.2, 0.09, times[i]);
      if (i === 6) {
        this.playTone(523.25, 'triangle', 1.0, 0.07, times[i]);
        this.playTone(1318.51, 'sine', 1.0, 0.05, times[i]);
      }
    });
  }

  // Thruster pulse for Docking Simulator
  thruster() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 450;
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  // Docking Hard Lock latch sound
  dockLock() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    this.playTone(180, 'square', 0.12, 0.1, 0);
    this.playTone(240, 'triangle', 0.25, 0.09, 0.1);
    this.playTone(987.77, 'sine', 0.4, 0.08, 0.2);
  }
}

export const Sound = new SoundEngine();
