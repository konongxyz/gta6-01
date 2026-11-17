// audio.js — every sound in Solano Heat is synthesized with WebAudio at play time:
// the engine note and police siren are running oscillators whose pitch follows the
// game, the rest are small one-shot envelopes (noise bursts, blips, jingles) and a
// slow tropical pad loop for the city ambience. No audio files exist or load. The
// context starts on the first user gesture, as browsers require.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;
let musicTimer = 0;
let musicStep = 0;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
  return muted;
}

export function isMuted() {
  return muted;
}

function noiseBuffer() {
  const length = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let sharedNoise = null;

function burst({ duration = 0.15, frequency = 1200, type = 'lowpass', gain = 0.4, sweepTo = null }) {
  if (!ctx) return;
  if (!sharedNoise) sharedNoise = noiseBuffer();
  const source = ctx.createBufferSource();
  source.buffer = sharedNoise;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(filter).connect(amp).connect(master);
  source.start();
  source.stop(ctx.currentTime + duration + 0.02);
}

function tone({ frequency = 440, duration = 0.15, type = 'sine', gain = 0.25, sweepTo = null, delay = 0 }) {
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(amp).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  click() { tone({ frequency: 660, duration: 0.06, type: 'square', gain: 0.12 }); },
  punch() { burst({ duration: 0.09, frequency: 500, gain: 0.35 }); },
  swing() { burst({ duration: 0.07, frequency: 1800, type: 'bandpass', gain: 0.1 }); },
  shot() {
    burst({ duration: 0.16, frequency: 3200, sweepTo: 300, gain: 0.5 });
    tone({ frequency: 160, duration: 0.1, type: 'square', gain: 0.2, sweepTo: 60 });
  },
  dryFire() { tone({ frequency: 1400, duration: 0.04, type: 'square', gain: 0.1 }); },
  crash(strength = 0.5) {
    burst({ duration: 0.22, frequency: 700, gain: 0.25 + strength * 0.4 });
    tone({ frequency: 90, duration: 0.2, type: 'sine', gain: 0.3 * strength, sweepTo: 40 });
  },
  door() { tone({ frequency: 220, duration: 0.08, type: 'square', gain: 0.14, sweepTo: 140 }); },
  pickup() {
    tone({ frequency: 880, duration: 0.09, gain: 0.18 });
    tone({ frequency: 1320, duration: 0.14, gain: 0.18, delay: 0.07 });
  },
  cash() {
    tone({ frequency: 1568, duration: 0.09, type: 'triangle', gain: 0.2 });
    tone({ frequency: 2093, duration: 0.16, type: 'triangle', gain: 0.2, delay: 0.08 });
  },
  phone() {
    tone({ frequency: 1046, duration: 0.12, type: 'sine', gain: 0.16 });
    tone({ frequency: 1046, duration: 0.12, type: 'sine', gain: 0.16, delay: 0.18 });
  },
  success() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ frequency: f, duration: 0.22, type: 'triangle', gain: 0.2, delay: i * 0.09 }));
  },
  fail() {
    tone({ frequency: 330, duration: 0.25, type: 'sawtooth', gain: 0.14, sweepTo: 196 });
    tone({ frequency: 196, duration: 0.35, type: 'sawtooth', gain: 0.12, delay: 0.16 });
  },
  busted() {
    [392, 370, 349, 311].forEach((f, i) => tone({ frequency: f, duration: 0.3, type: 'square', gain: 0.1, delay: i * 0.16 }));
  },
  horn() { tone({ frequency: 370, duration: 0.28, type: 'square', gain: 0.12 }); },
};

// The engine: a sawtooth through a lowpass, pitched by the car's speed. Started when
// the player gets into a car, stopped when they get out.
export function setEngine(on, speedRatio = 0, damaged = false) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const amp = ctx.createGain();
    amp.gain.value = 0.0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(amp).connect(master);
    osc.start();
    sub.start();
    engineNodes = { osc, sub, filter, amp };
  }
  if (!on && engineNodes) {
    const nodes = engineNodes;
    engineNodes = null;
    nodes.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => { try { nodes.osc.stop(); nodes.sub.stop(); } catch { /* already stopped */ } }, 200);
    return;
  }
  if (on && engineNodes) {
    const rpm = 55 + speedRatio * 165 + (damaged ? Math.random() * 14 : 0);
    engineNodes.osc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.05);
    engineNodes.sub.frequency.setTargetAtTime(rpm / 2, ctx.currentTime, 0.05);
    engineNodes.filter.frequency.setTargetAtTime(320 + speedRatio * 900, ctx.currentTime, 0.08);
    engineNodes.amp.gain.setTargetAtTime(0.05 + speedRatio * 0.06, ctx.currentTime, 0.09);
  }
}

// The siren: a triangle wave alternating between two pitches, audible when police
// are near. Level is set by the nearest police distance each frame.
export function setSiren(level) {
  if (!ctx) return;
  if (level > 0.01 && !sirenNodes) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.frequency.value = 760;
    const amp = ctx.createGain();
    amp.gain.value = 0;
    osc.connect(amp).connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, amp };
  }
  if (sirenNodes) {
    sirenNodes.amp.gain.setTargetAtTime(level * 0.07, ctx.currentTime, 0.1);
    if (level <= 0.01) {
      const nodes = sirenNodes;
      sirenNodes = null;
      setTimeout(() => { try { nodes.osc.stop(); nodes.lfo.stop(); } catch { /* already stopped */ } }, 300);
    }
  }
}

// The ambience: a slow pad (two detuned triangles through a soft lowpass) cycling a
// warm four-chord loop, with an occasional soft pluck. Called every frame; it
// schedules by its own step clock so it costs nothing between steps.
const PAD_CHORDS = [
  [220.0, 261.63, 329.63], // A minor
  [174.61, 220.0, 261.63], // F major
  [196.0, 246.94, 392.0], // G major
  [164.81, 261.63, 329.63], // C major over E
];

export function updateMusic(dt, active) {
  if (!ctx || !active) return;
  musicTimer -= dt;
  if (musicTimer > 0) return;
  musicTimer = 3.6;
  const chord = PAD_CHORDS[musicStep % PAD_CHORDS.length];
  musicStep += 1;
  for (const frequency of chord) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const amp = ctx.createGain();
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.028, now + 0.8);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
    osc.connect(filter).connect(amp).connect(master);
    osc.start(now);
    osc.stop(now + 3.9);
  }
  if (musicStep % 2 === 0) {
    const note = chord[Math.floor(Math.random() * chord.length)] * 2;
    tone({ frequency: note, duration: 0.5, type: 'sine', gain: 0.035, delay: 1.2 });
  }
}
