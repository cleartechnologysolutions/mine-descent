/* Mine Descent: original industrial-space sound design. No media assets or dependencies. */
(function (global) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, Number(x) || 0));
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  class VoidAudio {
    constructor() {
      this.ctx = null;
      this.started = false;
      this.muted = false;
      this.paused = false;
      this.volume = 0.7;
      this.mode = 'mine';
      this._timer = null;
      this._sources = new Set();
      this._lastSound = Object.create(null);
      this._step = 0;
      this._modeStartStep = 0;
      this._nextBeat = 0;
      this._state = { speed: 0, boost: false, combat: false, danger: 0, space: false, minehum: 1 };
      this._ambientSources = [];
      this._nextAmbience = 0;
      this._ambientCount = 0;
    }

    async start() {
      try {
        const Audio = global.AudioContext || global.webkitAudioContext;
        if (!Audio) return false;
        // A context may only be unlocked by the play / resume / sound UI gesture.
        if ((!this.ctx || this.ctx.state !== 'running') &&
            global.navigator && global.navigator.userActivation &&
            !global.navigator.userActivation.isActive && !this.started) return false;
        if (!this.ctx) this._init(Audio);
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        if (this.ctx.state !== 'running') return false;
        this.started = true;
        this.paused = false;
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.72, this.ctx.currentTime, 0.06);
        this._scheduleStart();
        return true;
      } catch (error) {
        // Audio must never prevent starting the game (e.g. unsupported device).
        return false;
      }
    }

    _init(Audio) {
      const c = this.ctx = new Audio({ latencyHint: 'interactive' });
      this.master = c.createGain();
      this.master.gain.value = 0;
      const limiter = this.limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 10;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.20;
      limiter.connect(this.master);
      // A bounded final transfer prevents simultaneous cannon hits from clipping.
      this.outputCeiling = c.createWaveShaper();
      const ceilingCurve = new Float32Array(2048);
      for (let i = 0; i < ceilingCurve.length; i++) {
        const x = i * 2 / (ceilingCurve.length - 1) - 1;
        ceilingCurve[i] = 0.94 * Math.tanh(x / 0.94);
      }
      this.outputCeiling.curve = ceilingCurve;
      this.outputCeiling.oversample = '2x';
      this.master.connect(this.outputCeiling);
      this.outputCeiling.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.78;
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.31;
      this.engineBus = c.createGain();
      this.engineBus.gain.value = 0.06;
      this.ambientBus = c.createGain();
      this.ambientBus.gain.value = 0;
      this.ambientBus.connect(limiter);
      this.sfxBus.connect(limiter);
      this.musicBus.connect(limiter);
      this.engineBus.connect(limiter);

      this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      let seed = 481516;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 16807) % 2147483647;
        samples[i] = (seed / 2147483647) * 2 - 1;
      }
      // Short, entirely synthesized stereo chamber gives cannon and music depth.
      const convolver = c.createConvolver();
      const impulse = c.createBuffer(2, Math.floor(c.sampleRate * 2.4), c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          seed = (seed * 16807) % 2147483647;
          d[i] = (seed / 2147483647 * 2 - 1) * Math.pow(1 - i / d.length, 4.1) * 0.32;
        }
      }
      convolver.buffer = impulse;
      this.reverbSend = c.createGain();
      this.reverbSend.gain.value = 0.12;
      this.reverbSend.connect(convolver);
      convolver.connect(limiter);
      this.sfxBus.connect(this.reverbSend);
      this.musicBus.connect(this.reverbSend);
      this._engineInit();
      this._ambienceInit();
    }

    _engineInit() {
      const c = this.ctx;
      this.engineFilter = c.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 150;
      this.engineFilter.Q.value = 0.8;
      this.engineFilter.connect(this.engineBus);
      this.engineOsc = c.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 42;
      const oscillatorGain = c.createGain();
      oscillatorGain.gain.value = 0.42;
      this.engineOsc.connect(oscillatorGain);
      oscillatorGain.connect(this.engineFilter);
      this.engineOsc.start();
      this.engineSub = c.createOscillator();
      this.engineSub.type = 'sine';
      this.engineSub.frequency.value = 38;
      const subGain = c.createGain();
      subGain.gain.value = 0.5;
      this.engineSub.connect(subGain);
      subGain.connect(this.engineBus);
      this.engineSub.start();
      this.engineNoise = c.createBufferSource();
      this.engineNoise.buffer = this.noiseBuffer;
      this.engineNoise.loop = true;
      const noiseGain = c.createGain();
      noiseGain.gain.value = 0.55;
      this.engineNoise.connect(noiseGain);
      noiseGain.connect(this.engineFilter);
      this.engineNoise.start();
    }

    _ambienceInit() {
      const c = this.ctx;
      // Fixed, low-level machinery bed. Its sources end when dispose closes the context.
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 165;
      filter.Q.value = 0.6;
      filter.connect(this.ambientBus);
      for (const [frequency, level, type] of [[32.7, 0.38, 'sine'], [65.7, 0.12, 'triangle'], [97.9, 0.06, 'sawtooth']]) {
        const oscillator = c.createOscillator();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        const gain = c.createGain();
        gain.gain.value = level;
        oscillator.connect(gain); gain.connect(filter); oscillator.start();
        this._ambientSources.push(oscillator);
      }
      const ventilation = c.createBufferSource();
      ventilation.buffer = this.noiseBuffer;
      ventilation.loop = true;
      const gain = c.createGain();
      gain.gain.value = 0.6;
      ventilation.connect(gain); gain.connect(filter); ventilation.start();
      this._ambientSources.push(ventilation);
      this._nextAmbience = c.currentTime + 2.5;
    }

    setVolume(value) {
      this.volume = clamp(value, 0, 1);
      if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.72, this.ctx.currentTime, 0.06);
    }

    setMuted(value) {
      this.muted = !!value;
      if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.72, this.ctx.currentTime, 0.035);
    }

    async pause(value = true) {
      this.paused = !!value;
      if (!this.ctx) return;
      if (this.paused) {
        clearInterval(this._timer);
        this._timer = null;
        try { if (this.ctx.state === 'running') await this.ctx.suspend(); } catch (_) {}
      } else if (this.started) {
        try {
          await this.ctx.resume();
          this._nextBeat = Math.max(this._nextBeat, this.ctx.currentTime + 0.04);
          this._scheduleStart();
        } catch (_) {}
      }
    }

    update(state = {}, dt = 0.016) {
      Object.assign(this._state, state);
      if (!this.ctx || this.paused || !this.started) return;
      const s = this._state;
      const t = this.ctx.currentTime;
      const speed = clamp(s.speed, 0, 1);
      const boost = s.boost ? 1 : 0;
      const danger = clamp(s.danger, 0, 1);
      this.engineOsc.frequency.setTargetAtTime(42 + speed * 61 + boost * 31, t, 0.18);
      this.engineSub.frequency.setTargetAtTime(36 + speed * 20 + boost * 12, t, 0.22);
      this.engineFilter.frequency.setTargetAtTime(150 + speed * 650 + boost * 1000, t, 0.18);
      this.engineBus.gain.setTargetAtTime(0.035 + speed * 0.065 + boost * 0.075, t, 0.15);
      this.musicBus.gain.setTargetAtTime(danger > 0.72 ? 0.31 : s.combat ? 0.26 : s.space ? 0.30 : 0.23, t, 0.8);
      const inMine = !s.space && !['menu', 'off', 'victory'].includes(this.mode);
      this.ambientBus.gain.setTargetAtTime(inMine ? 0.15 * clamp(s.minehum, 0, 1) : 0, t, 0.8);
      this.reverbSend.gain.setTargetAtTime(inMine ? 0.19 : 0.075, t, 0.6);
      if (danger > 0.72 && (!this._nextDanger || t > this._nextDanger)) {
        this._nextDanger = t + 2.8;
        this.sfx('alarm');
      }
      const desired = danger > 0.72 ? 'escape' : s.combat ? 'combat' : s.space ? 'space' : 'mine';
      // Menu, mute-score, and the completion fanfare are explicit scene states.
      if (!['menu', 'off', 'victory'].includes(this.mode) && desired !== this.mode) this.music(desired);
    }

    music(mode) {
      if (!['mine', 'space', 'combat', 'escape', 'victory', 'menu', 'off'].includes(mode)) return;
      if (this.mode !== mode) {
        this.mode = mode;
        this._modeStartStep = this._step;
        if (this.ctx && ['victory', 'menu'].includes(mode)) {
          this.engineBus.gain.setTargetAtTime(0.008, this.ctx.currentTime, 0.3);
          this.ambientBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
        // Keep the phrase clock intact so transitions land naturally.
        if (this.ctx && !['menu', 'off'].includes(mode)) this._nextBeat = Math.max(this._nextBeat, this.ctx.currentTime + 0.015);
      }
    }

    _pan(pan, bus) {
      let node;
      if (this.ctx.createStereoPanner) {
        node = this.ctx.createStereoPanner();
        node.pan.value = clamp(pan, -1, 1);
      } else node = this.ctx.createGain();
      node.connect(bus || this.sfxBus);
      return node;
    }

    _tone(freq, endFreq, duration, volume, type = 'sine', pan = 0, when = this.ctx.currentTime, bus = this.sfxBus, attack = 0.004, cutoff = 0, hold = 0) {
      if (this._sources.size >= 144 || duration <= 0) return;
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(15, freq), when);
      if (endFreq && endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(15, endFreq), when + duration);
      const amp = c.createGain();
      amp.gain.setValueAtTime(0, when);
      const attackTime = Math.min(attack, duration * 0.3);
      amp.gain.linearRampToValueAtTime(volume, when + attackTime);
      // A short pressure shoulder gives weapon transients weight before release.
      if (hold > 0) amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.72),
        when + Math.min(attackTime + hold, duration * 0.75));
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      const panner = this._pan(pan, bus);
      let filter;
      if (cutoff) {
        filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, when);
        osc.connect(filter);
        filter.connect(amp);
      } else osc.connect(amp);
      amp.connect(panner);
      this._sources.add(osc);
      osc.onended = () => {
        this._sources.delete(osc);
        osc.disconnect(); amp.disconnect(); panner.disconnect();
        if (filter) filter.disconnect();
      };
      osc.start(when);
      osc.stop(when + duration + 0.02);
    }

    _noise(duration, volume, frequency, endFreq, type = 'lowpass', pan = 0, when = this.ctx.currentTime, bus = this.sfxBus, attack = 0.008) {
      if (this._sources.size >= 144 || duration <= 0) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = duration > 1.9;
      const filter = c.createBiquadFilter();
      filter.type = type;
      filter.Q.value = type === 'bandpass' ? 0.75 : 0.7;
      filter.frequency.setValueAtTime(Math.max(30, frequency), when);
      if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), when + duration);
      const amp = c.createGain();
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(volume, when + Math.min(attack, duration * 0.85));
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      const panner = this._pan(pan, bus);
      src.connect(filter); filter.connect(amp); amp.connect(panner);
      this._sources.add(src);
      src.onended = () => {
        this._sources.delete(src);
        src.disconnect(); filter.disconnect(); amp.disconnect(); panner.disconnect();
      };
      src.start(when, Math.random() * 0.05);
      src.stop(when + duration + 0.02);
    }

    _machine(freq, endFreq, duration, volume, pan, when, options = {}) {
      if (this._sources.size >= 142 || duration <= 0) return;
      const c = this.ctx;
      const carrier = c.createOscillator();
      const modulator = c.createOscillator();
      carrier.type = options.type || 'sine';
      modulator.type = 'sine';
      const ratio = options.ratio || 2.71;
      const depth = options.depth || 110;
      carrier.frequency.setValueAtTime(Math.max(20, freq), when);
      carrier.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), when + duration);
      modulator.frequency.setValueAtTime(Math.max(3, freq * ratio), when);
      modulator.frequency.exponentialRampToValueAtTime(Math.max(3, endFreq * ratio), when + duration);
      const modGain = c.createGain();
      modGain.gain.setValueAtTime(depth, when);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.14), when + duration);
      modulator.connect(modGain); modGain.connect(carrier.frequency);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(options.cutoff || 2100, when);
      filter.frequency.exponentialRampToValueAtTime(options.endCutoff || 260, when + duration);
      const amp = c.createGain();
      const attack = Math.min(options.attack || 0.008, duration * 0.87);
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(volume, when + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      const panner = this._pan(pan, options.bus || this.sfxBus);
      carrier.connect(filter); filter.connect(amp); amp.connect(panner);
      this._sources.add(carrier); this._sources.add(modulator);
      carrier.onended = () => {
        this._sources.delete(carrier); this._sources.delete(modulator);
        carrier.disconnect(); modulator.disconnect(); modGain.disconnect();
        filter.disconnect(); amp.disconnect(); panner.disconnect();
      };
      carrier.start(when); modulator.start(when);
      carrier.stop(when + duration + 0.025); modulator.stop(when + duration + 0.025);
    }

    _robotSound(name, pan, t, intensity = 1) {
      const boss = name.startsWith('warden');
      const action = name.replace(/^(robot|warden)/, '');
      const pitch = (boss ? 0.62 : 1) * (0.97 + Math.random() * 0.06);
      const level = intensity * (boss ? 1.06 : 0.94);
      const tone = (f, end, duration, volume, ...args) => this._tone(f * pitch, end * pitch, duration, volume * level, ...args);
      const noise = (duration, volume, ...args) => this._noise(duration, volume * level, ...args);
      const machine = (f, end, duration, volume, at = t, opts = {}) => this._machine(f * pitch, end * pitch, duration, volume * level, pan, at, opts);
      if (action === 'Wake') {
        // A predatory motor voice, interlocked steel joints, then a rising threat signal.
        machine(84, 46, boss ? 2.3 : 1.5, 0.28, t, { ratio: 0.47, depth: 160, attack: 0.18, cutoff: 900 });
        tone(62, 34, 1.8, 0.27, 'sine', pan, t, this.sfxBus, 0.11);
        noise(1.1, 0.24, 460, 1250, 'bandpass', pan, t + 0.12, this.sfxBus, 0.14);
        [0.08, 0.23, 0.44].forEach((offset, i) => {
          machine(310 - i * 53, 110 + i * 29, 0.33, 0.17, t + offset, { ratio: 3.17, depth: 370, cutoff: 1700 });
          noise(0.12, 0.18, 2700, 750, 'highpass', pan, t + offset);
        });
        machine(112, 370, 0.86, 0.19, t + 0.39, { ratio: 1.031, depth: 80, attack: 0.28, cutoff: 1500, endCutoff: 1600 });
        if (boss) machine(51, 31, 2.7, 0.34, t + 0.16, { ratio: 0.23, depth: 45, attack: 0.25, cutoff: 620 });
      } else if (action === 'Charge') {
        // The crescendo is approximately 0.6 seconds: gameplay can fire at +0.6.
        machine(62, 520, 0.64, 0.26, t, { ratio: 2.17, depth: 195, attack: 0.51, cutoff: 2400, endCutoff: 3800 });
        machine(79, 630, 0.63, 0.11, t, { ratio: 0.99, depth: 90, attack: 0.51, cutoff: 1800, endCutoff: 2600 });
        noise(0.64, 0.24, 180, 5200, 'bandpass', pan, t, this.sfxBus, 0.52);
        tone(43, 89, 0.63, 0.23, 'sine', pan, t, this.sfxBus, 0.18);
      } else if (action === 'Fire') {
        tone(174, 30, 0.62, 0.48, 'sine', pan, t);
        machine(390, 76, 0.34, 0.31, t, { ratio: 1.83, depth: 570, cutoff: 4100 });
        noise(0.075, 0.48, 6200, 1700, 'highpass', pan, t);
        noise(0.60, 0.34, 2200, 160, 'lowpass', pan, t + 0.014);
        machine(174, 53, boss ? 1.25 : 0.8, 0.13, t + 0.04, { ratio: 4.13, depth: 300, cutoff: 2400 });
        if (boss) tone(70, 24, 1.05, 0.23, 'sine', pan, t + 0.08);
      } else if (action === 'Move') {
        machine(133, 81, 0.34, 0.14, t, { ratio: 3.11, depth: 105, attack: 0.05, cutoff: 1200 });
        noise(0.36, 0.19, 1600, 410, 'bandpass', pan, t, this.sfxBus, 0.045);
        noise(0.08, 0.12, 1100, 300, 'lowpass', pan, t + 0.20);
        tone(94, 49, 0.15, 0.10, 'triangle', pan, t + 0.20);
      } else if (action === 'Death') {
        // Tearing metal above a heavy impact, then the rotor audibly dies.
        machine(690, 92, 1.37, 0.29, t, { ratio: 2.79, depth: 720, cutoff: 4600, endCutoff: 420 });
        tone(132, 25, 1.35, 0.45, 'sine', pan, t);
        noise(0.13, 0.47, 6500, 2100, 'highpass', pan, t);
        noise(1.48, 0.47, 4200, 110, 'lowpass', pan, t);
        [0.13, 0.29, 0.48, 0.79].forEach((offset, i) => {
          const spread = clamp(pan + (i % 2 ? 0.16 : -0.16), -1, 1);
          tone(620 - i * 91, 350 - i * 58, 0.32 + i * 0.07, 0.10, 'triangle', spread, t + offset);
          noise(0.11, 0.18 - i * 0.023, 3600 - i * 540, 610, 'bandpass', spread, t + offset);
        });
        machine(220, 24, boss ? 2.9 : 2.1, 0.22, t + 0.24, { ratio: 0.39, depth: 73, cutoff: 1400 });
        if (boss) {
          noise(2.7, 0.34, 870, 45, 'lowpass', pan, t + 0.3);
          tone(78, 20, 2.8, 0.27, 'sine', pan, t + 0.18);
        }
      }
    }

    _mineAmbience(t, intensity = 1) {
      const pan = Math.sin(++this._ambientCount * 2.399) * 0.8;
      const level = 0.14 * intensity;
      if (this._ambientCount % 3 === 0) {
        // Remote rock stress: low groan, then several small debris impacts.
        this._machine(48, 31, 3.4, level * 1.1, pan, t,
          { ratio: 0.32, depth: 40, attack: 0.8, cutoff: 580 });
        this._noise(3.1, level * 0.9, 490, 72, 'lowpass', pan, t, this.sfxBus, 0.45);
        for (let i = 0; i < 3; i++) this._noise(0.48, level * 0.7, 1600 - i * 330, 130, 'bandpass', pan, t + 0.9 + i * 0.26);
      } else {
        // Steel under pressure, with a hydraulic release deep in another shaft.
        this._machine(85, 57, 2.6, level, pan, t,
          { ratio: 3.47, depth: 88, attack: 0.55, cutoff: 840, endCutoff: 150 });
        this._noise(2.2, level * 0.85, 730, 230, 'bandpass', -pan * 0.6, t + 0.3, this.sfxBus, 0.5);
        this._tone(68, 36, 0.72, level, 'sine', pan, t + 0.6, this.sfxBus, 0.018);
      }
    }

    sfx(name, pan = 0, intensity = 1) {
      if (!this.ctx || !this.started || this.paused || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const gap = ({ laser: 0.035, vulcan: 0.025, breach: 0.1, siege: 0.1, equip: 0.12, door: 0.45, enemy: 0.09, hit: 0.10, explosion: 0.07, reactor: 2,
        alarm: 0.9, click: 0.035, robotWake: 0.7, robotCharge: 0.14, robotFire: 0.055,
        robotMove: 0.34, robotDeath: 0.09, wardenWake: 1.4, wardenCharge: 0.2,
        wardenFire: 0.07, wardenDeath: 0.5, mineAmbience: 4 })[name] || 0.05;
      const level = clamp(intensity, 0, 1);
      if (level <= 0.005) return;
      if (this._lastSound[name] !== undefined && t - this._lastSound[name] < gap) return;
      this._lastSound[name] = t;
      pan = clamp(pan, -1, 1);
      const tone = (f, end, duration, volume, ...args) => this._tone(f, end, duration, volume * level, ...args);
      const noise = (duration, volume, ...args) => this._noise(duration, volume * level, ...args);
      if (/^(robot|warden)(Wake|Charge|Fire|Move|Death)$/.test(name)) {
        this._robotSound(name, pan, t, level);
        return;
      }
      switch (name) {
        case 'laser':
          // Pressure, armor-piercing crack, charged metal, then the breech kicks back.
          // Brief tails keep individual shots distinct during sustained cannon fire.
          tone(146, 43, 0.29, 0.60, 'sine', pan, t, this.sfxBus, 0.002, 0, 0.026);
          tone(215, 66, 0.18, 0.15, 'triangle', pan, t, this.sfxBus, 0.002, 950, 0.012);
          this._machine(390, 76, 0.23, 0.25 * level, pan, t,
            { ratio: 1.57, depth: 440, attack: 0.002, cutoff: 3300, endCutoff: 280 });
          noise(0.047, 0.38, 2500, 1300, 'highpass', pan, t, this.sfxBus, 0.001);
          noise(0.19, 0.33, 2300, 210, 'lowpass', pan, t + 0.003, this.sfxBus, 0.002);
          tone(760, 155, 0.15, 0.10, 'sawtooth', -pan * 0.35, t + 0.012, this.sfxBus, 0.002, 2200);
          noise(0.065, 0.13, 1850, 640, 'bandpass', pan, t + 0.048, this.sfxBus, 0.002);
          break;
        case 'breach':
          tone(174, 33, .42, .65, 'sine', pan, t, this.sfxBus, .002, 0, .024);
          noise(.052, .48, 3900, 1700, 'highpass', pan, t, this.sfxBus, .001);
          noise(.30, .40, 2200, 160, 'lowpass', pan, t + .005, this.sfxBus, .002);
          this._machine(330, 56, .26, .25 * level, pan, t, {ratio:2.17,depth:520,attack:.002,cutoff:2900,endCutoff:190});
          noise(.085, .17, 1700, 520, 'bandpass', pan, t + .24);
          break;
        case 'vulcan':
          tone(188, 56, .115, .48, 'sine', pan, t, this.sfxBus, .001, 0, .01);
          noise(.028, .35, 4200, 1700, 'highpass', pan, t, this.sfxBus, .001);
          this._machine(470, 110, .095, .19 * level, pan, t, {ratio:2.43,depth:390,attack:.001,cutoff:2800,endCutoff:440});
          noise(.08, .17, 1800, 340, 'lowpass', pan, t + .006, this.sfxBus, .001);
          break;
        case 'siege':
          tone(130, 25, .65, .65, 'sine', pan, t, this.sfxBus, .003, 0, .035);
          this._machine(580, 44, .50, .36 * level, pan, t, {ratio:1.37,depth:810,attack:.003,cutoff:3600,endCutoff:160});
          noise(.065, .43, 3300, 1100, 'highpass', pan, t, this.sfxBus, .001);
          noise(.48, .36, 2100, 120, 'lowpass', pan, t + .012, this.sfxBus, .003);
          tone(880, 190, .38, .13, 'sawtooth', -pan, t + .03, this.sfxBus, .005, 2200);
          break;
        case 'equip':
          noise(.11, .22, 1600, 430, 'bandpass', pan, t, this.sfxBus, .003);
          tone(105, 49, .16, .23, 'triangle', pan, t + .07);
          tone(380, 620, .09, .08, 'sine', pan, t + .12);
          break;
        case 'door':
          this._machine(115, 68, 0.52, 0.17 * level, pan, t,
            { ratio: 3.11, depth: 90, attack: 0.05, cutoff: 1150, endCutoff: 240 });
          noise(0.6, 0.23, 1250, 300, 'bandpass', pan, t, this.sfxBus, 0.035);
          tone(92, 46, 0.16, 0.20, 'triangle', pan, t + 0.35);
          break;
        case 'missile':
          tone(138, 34, 0.48, 0.60, 'sine', pan, t, this.sfxBus, 0.003, 0, 0.035);
          noise(0.055, 0.30, 2700, 1100, 'highpass', pan, t, this.sfxBus, 0.001);
          noise(0.72, 0.56, 650, 4200, 'bandpass', pan, t);
          tone(220, 1350, 0.46, 0.13, 'sawtooth', pan, t + 0.02, this.sfxBus, 0.01, 2200);
          break;
        case 'enemy':
          this._robotSound('robotFire', pan, t, level * 0.78);
          break;
        case 'explosion':
          noise(1.15, 0.70, 4600, 110, 'lowpass', pan, t);
          tone(145, 28, 0.8, 0.62, 'sine', pan, t);
          noise(0.18, 0.45, 4300, 1600, 'highpass', pan, t);
          tone(68, 31, 1.2, 0.17, 'triangle', -pan * 0.5, t + 0.07);
          break;
        case 'reactor':
          tone(1200, 55, 1.7, 0.28, 'sawtooth', 0, t, this.sfxBus, 0.02, 1800);
          for (let i = 0; i < 5; i++) {
            const at = t + i * 0.18;
            const spread = i === 0 ? 0 : (i % 2 ? -0.7 : 0.7);
            noise(2.6, 0.55 - i * 0.04, 5300 - i * 450, 70, 'lowpass', spread, at);
            tone(120 - i * 8, 22, 2.1, 0.41, 'sine', spread * 0.25, at);
          }
          noise(4.2, 0.32, 260, 50, 'lowpass', 0, t + 0.6);
          break;
        case 'hit':
          noise(0.33, 0.40, 2100, 200, 'bandpass', pan, t);
          tone(325, 82, 0.36, 0.28, 'triangle', pan, t);
          tone(710, 130, 0.19, 0.14, 'sine', -pan, t);
          break;
        case 'pickup':
          [73, 80, 85, 92].forEach((note, i) => {
            tone(midi(note), midi(note), 0.32, 0.15, 'sine', pan, t + i * 0.065, this.sfxBus, 0.007);
            tone(midi(note) * 2, midi(note) * 2, 0.16, 0.035, 'triangle', -pan, t + i * 0.065);
          });
          break;
        case 'alarm':
          [0, 0.18].forEach((offset, i) => {
            tone(i ? 650 : 520, i ? 620 : 490, 0.12, 0.15, 'triangle', 0, t + offset);
          });
          break;
        case 'warp':
          noise(2.2, 0.52, 220, 9500, 'bandpass', -0.6, t);
          noise(1.7, 0.34, 600, 12000, 'bandpass', 0.6, t + 0.1);
          [0, 7, 12].forEach((semitone, i) => tone(midi(37 + semitone), midi(73 + semitone), 1.75, 0.12, 'sawtooth', (i - 1) * 0.65, t, this.sfxBus, 0.08, 2700));
          tone(170, 26, 1.2, 0.47, 'sine', 0, t + 1.3);
          break;
        case 'mineAmbience':
          this._mineAmbience(t, level);
          break;
        case 'click':
          tone(900, 620, 0.06, 0.12, 'sine', pan, t);
          break;
      }
    }

    _scheduleStart() {
      if (this._timer || this.paused || !this.started) return;
      this._nextBeat = Math.max(this._nextBeat, this.ctx.currentTime + 0.045);
      this._schedule();
      this._timer = setInterval(() => this._schedule(), 65);
    }

    _schedule() {
      if (!this.ctx || this.paused || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (!this._state.space && ['mine', 'combat', 'escape'].includes(this.mode) && now >= this._nextAmbience) {
        this._nextAmbience = now + 7.5 + Math.random() * 6;
        this._mineAmbience(now + 0.02, clamp(this._state.minehum, 0, 1));
      }
      if (this._nextBeat < now - 0.12) this._nextBeat = now + 0.03;
      let guard = 0;
      while (this._nextBeat < now + 0.18 && guard++ < 8) {
        const mode = this.mode;
        if (!['menu', 'off'].includes(mode)) this._musicStep(this._step, this._nextBeat, mode);
        const bpm = mode === 'escape' ? 152 : mode === 'combat' ? 126 : mode === 'victory' ? 88 : mode === 'space' ? 78 : 98;
        this._nextBeat += 60 / bpm / 4;
        this._step++;
      }
    }

    _musicStep(step, t, mode) {
      const bus = this.musicBus;
      const beat = step % 16;
      const bar = Math.floor(step / 16);
      const phrase = bar % 8;
      const space = mode === 'space';
      const escape = mode === 'escape';
      const combat = mode === 'combat' || escape;
      const bpm = escape ? 152 : combat ? 126 : mode === 'victory' ? 88 : space ? 78 : 98;
      const pulse = 60 / bpm / 4;
      if (mode === 'victory') {
        const v = step - this._modeStartStep;
        if (v >= 32) { this.music('off'); return; }
        // A brief major resolution after the dissonant escape score.
        if (v === 0 || v === 16) {
          const root = v === 0 ? 49 : 37;
          [0, 4, 7, 12].forEach((n, i) => this._tone(midi(root + n), midi(root + n),
            pulse * 20, 0.12, 'triangle', (i - 1.5) * 0.4, t, bus, 0.12, 1900));
          this._tone(midi(root - 12), midi(root - 12), pulse * 16, 0.28, 'sine', 0, t, bus, 0.05);
          this._noise(0.75, 0.10, 5400, 1600, 'highpass', 0.3, t, bus);
        }
        const fanfare = { 0: 61, 2: 64, 4: 68, 8: 73, 12: 76, 16: 80, 24: 85 };
        if (fanfare[v]) {
          const note = midi(fanfare[v]);
          this._tone(note, note, 1.7, 0.19, 'sine', Math.sin(v) * 0.45, t, bus, 0.014);
          this._tone(note * 2, note * 2, 0.65, 0.040, 'triangle', -Math.sin(v) * 0.45, t, bus, 0.02);
        }
        return;
      }
      if (mode === 'mine') {
        // Sparse dissonant score lets positional machinery and enemy cues lead.
        if (beat === 0 && bar % 2 === 0) {
          const root = [30, 30, 29, 26][Math.floor(bar / 2) % 4];
          [0, 7, 13].forEach((n, i) => this._tone(midi(root + n), midi(root + n) * 0.994,
            pulse * 34, i === 0 ? 0.24 : 0.075, i === 0 ? 'sine' : 'triangle',
            (i - 1) * 0.6, t, bus, 0.9, 540));
        }
        if (beat === 10 && bar % 4 === 1) {
          this._machine(92, 54, 2.8, 0.12, -0.5, t,
            { ratio: 1.414, depth: 53, attack: 0.7, cutoff: 860, bus });
        }
        return;
      }
      // Original C-sharp-minor progression with a dark suspended turnaround.
      const roots = [37, 37, 33, 33, 40, 40, 35, 36];
      const root = roots[phrase];
      if (beat === 0) {
        const chord = phrase === 7 ? [0, 5, 7, 12] : [0, 3, 7, 14];
        chord.forEach((n, i) => {
          this._tone(midi(root + 12 + n), midi(root + 12 + n) * 1.0012,
            pulse * 17, space ? 0.082 : 0.059, 'triangle', (i - 1.5) * 0.40,
            t + i * 0.018, bus, pulse * 1.2, space ? 1800 : 950);
        });
      }
      if (space) {
        if ([0, 6, 10, 14].includes(beat)) {
          const notes = [12, 19, 22, 26];
          const n = root + notes[[0, 6, 10, 14].indexOf(beat)];
          this._tone(midi(n), midi(n), 1.15, 0.092, 'sine', Math.sin(step * 1.27) * 0.75, t, bus, 0.02);
          this._tone(midi(n), midi(n), 0.6, 0.029, 'sine', -Math.sin(step * 1.27) * 0.75, t + pulse * 2, bus, 0.025);
        }
        if (beat === 0 || beat === 8) this._tone(80, 38, 0.35, 0.13, 'sine', 0, t, bus);
        if (beat === 12) this._noise(0.15, 0.03, 3100, 1700, 'bandpass', 0.5, t, bus);
        return;
      }
      if (escape) {
        // Relentless sixteenth-note countdown ostinato, with alternating stereo echoes.
        const ostinato = [0, 7, 12, 7, 0, 10, 7, 3];
        const n = midi(root + 12 + ostinato[beat % 8]);
        this._tone(n, n * 0.998, pulse * 1.4, beat % 4 === 0 ? 0.125 : 0.085,
          'sawtooth', beat % 2 ? -0.42 : 0.42, t, bus, 0.005, 1750);
        if (beat === 0 || beat === 8) {
          this._tone(midi(root + 24), midi(root + 25), pulse * 3.5, 0.09,
            'triangle', beat === 0 ? -0.6 : 0.6, t, bus, 0.01, 2200);
        }
      }
      // Bass line leaves rests for the weapons to speak clearly.
      const bassPattern = combat ? [0, 3, 6, 8, 10, 14] : [0, 6, 8, 14];
      if (bassPattern.includes(beat)) {
        const n = root - 12 + (beat === 14 ? 7 : beat === 6 ? 12 : 0);
        this._tone(midi(n), midi(n), pulse * (combat ? 2.3 : 3), combat ? 0.32 : 0.24,
          'sawtooth', 0, t, bus, 0.009, combat ? 410 : 260);
        this._tone(midi(n), midi(n), pulse * 2.6, 0.18, 'sine', 0, t, bus, 0.01);
      }
      if (beat === 0 || beat === 8 || (combat && [6, 11, 14].includes(beat))) {
        this._tone(128, 36, 0.27, 0.60, 'sine', 0, t, bus);
        this._noise(0.032, 0.11, 2400, 700, 'bandpass', 0, t, bus);
      }
      if (beat === 4 || beat === 12) {
        this._noise(0.17, combat ? 0.29 : 0.17, 4700, 1200, 'highpass', 0.15, t, bus);
        this._tone(175, 110, 0.11, 0.12, 'triangle', 0, t, bus);
      }
      if (beat % (combat ? 2 : 4) === 2 || (combat && beat === 15)) {
        this._noise(beat === 14 ? 0.15 : 0.046, combat ? 0.071 : 0.045, 8300, 4700,
          'highpass', beat % 4 ? 0.48 : -0.48, t, bus);
      }
      const motif = [0, null, 7, 12, null, 10, 7, 3, 0, 7, null, 15, 12, null, 7, 2];
      if (!escape && (combat || bar % 2 === 1) && beat % 2 === 0) {
        const n = motif[(beat / 2 + (bar % 2) * 8) % 16];
        if (n !== null) {
          const note = midi(root + 12 + n);
          const pan = Math.sin(step * 0.81) * 0.55;
          this._tone(note, note, pulse * 2.7, combat ? 0.055 : 0.088,
            'triangle', pan, t, bus, 0.009, combat ? 2200 : 1250);
          this._tone(note, note, pulse * 2.8, 0.026, 'sine', -pan, t + pulse * 3, bus, 0.014);
        }
      }
      if (combat && phrase % 2 === 1 && beat === 15) {
        this._noise(0.09, 0.13, 3100, 750, 'bandpass', -0.35, t, bus);
      }
    }

    async dispose() {
      clearInterval(this._timer);
      this._timer = null;
      this.paused = true;
      for (const source of this._sources) { try { source.stop(); } catch (_) {} }
      this._sources.clear();
      for (const source of [this.engineOsc, this.engineSub, this.engineNoise, ...this._ambientSources]) {
        try { if (source) source.stop(); } catch (_) {}
      }
      if (this.ctx) { try { await this.ctx.close(); } catch (_) {} }
      this.ctx = null;
      this.started = false;
      this._ambientSources = [];
      this._lastSound = Object.create(null);
      this._nextBeat = 0;
    }
  }
  global.VoidAudio = VoidAudio;
})(typeof window !== 'undefined' ? window : globalThis);
