// Trophic — Web Audio: generative ambient pad that follows the season, plus short synthesized cues.
window.Trophic = window.Trophic || {};

(function (T) {
  'use strict';
  // Chord roots per season (Hz); minor third when the player's population is falling.
  const SEASON_ROOTS = [196.0, 220.0, 174.6, 146.8];
  const A = {
    ctx: null, master: null, sfx: null, music: null, voices: [],
    musicVol: 0.35, sfxVol: 0.6, last: {}, season: -1, trend: 0,
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain(); A.master.gain.value = 0.8; A.master.connect(ctx.destination);
    A.sfx = ctx.createGain(); A.sfx.gain.value = A.sfxVol; A.sfx.connect(A.master);
    A.music = ctx.createGain(); A.music.gain.value = A.musicVol * 0.25; A.music.connect(A.master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(A.music);
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(); o.type = k === 2 ? 'triangle' : 'sine';
      const g = ctx.createGain(); g.gain.value = 0.0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + k * 0.031;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      o.connect(g); g.connect(lp);
      o.start(); lfo.start();
      g.gain.setTargetAtTime(0.18, ctx.currentTime, 2);
      A.voices.push({ o, g });
    }
    A.setSeason(0);
  };

  A.setVolumes = function (music, sfx) {
    A.musicVol = music; A.sfxVol = sfx;
    if (!A.ctx) return;
    A.music.gain.setTargetAtTime(music * 0.25, A.ctx.currentTime, 0.2);
    A.sfx.gain.setTargetAtTime(sfx, A.ctx.currentTime, 0.1);
  };

  A.setSeason = function (i, trend) {
    if (!A.ctx) return;
    if (trend !== undefined) A.trend = trend;
    if (i === A.season && trend === undefined) return;
    A.season = i;
    const root = SEASON_ROOTS[i] || 196;
    const third = A.trend < 0 ? 1.1892 : 1.2599;
    const ratios = [1, third, 1.4983];
    A.voices.forEach((v, k) => v.o.frequency.setTargetAtTime(root * ratios[k] * (k === 2 ? 0.5 : 1), A.ctx.currentTime, 1.5));
  };

  function tone(freq, dur, type, vol, slideTo) {
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    const ctx = A.ctx, t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(A.sfx);
    src.start(t);
  }

  // Rate-limited cue playback.
  A.cue = function (name, arg) {
    if (!A.ctx || A.ctx.state !== 'running') return;
    const now = A.ctx.currentTime, gap = { bite: 0.12, birth: 0.25, kill: 0.15 }[name] || 0.05;
    if (A.last[name] && now - A.last[name] < gap) return;
    A.last[name] = now;
    switch (name) {
      case 'bite': noise(0.05, 0.25, 1800); break;
      case 'kill': tone(120, 0.25, 'sine', 0.4, 60); noise(0.1, 0.2, 400); break;
      case 'birth': tone(880, 0.08, 'sine', 0.15); setTimeout(() => A.ctx && tone(1320, 0.1, 'sine', 0.12), 70); break;
      case 'starve': tone(160, 0.35, 'square', 0.08, 120); break;
      case 'rival': [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => tone(f, 0.25, 'triangle', 0.18), k * 110)); break;
      case 'extinct': [440, 370, 311, 220].forEach((f, k) => setTimeout(() => tone(f, 0.4, 'sine', 0.2), k * 180)); break;
      case 'click': tone(660, 0.04, 'triangle', 0.08); break;
      case 'buy': tone(520, 0.06, 'triangle', 0.12); setTimeout(() => A.ctx && tone(780, 0.08, 'triangle', 0.1), 50); break;
      case 'call': { // creature call synthesized from body mass
        const m = arg || 3;
        const f = 1100 / Math.sqrt(m);
        tone(f, 0.18 + m * 0.01, 'sawtooth', 0.06, f * 0.7);
        break;
      }
    }
  };

  T.Audio = A;
})(window.Trophic);
