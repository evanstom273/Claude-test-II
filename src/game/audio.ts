import { settingsStore } from '../db/settings';

/*
 * Everything audible is synthesised with WebAudio: no sound files.
 * SFX are short recipes; music is a tiny step sequencer.
 */

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  applyVolumes();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function applyVolumes() {
  const s = settingsStore.getState();
  if (sfxBus) sfxBus.gain.value = s.sfxVolume * 0.9;
  if (musicBus) musicBus.gain.value = s.musicVolume * 0.32;
}

settingsStore.subscribe(applyVolumes);

/** Browsers only allow audio after a user gesture. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

if (typeof window !== 'undefined') {
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

// ---- Note helpers --------------------------------------------------------------

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  let n = NOTE_INDEX[m[1]];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  const midi = (Number(m[3]) + 1) * 12 + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  to?: number;
  start?: number;
  dur: number;
  gain?: number;
  attack?: number;
  bus?: GainNode | null;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  detune?: number;
}

function tone(o: ToneOpts) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = c.createGain();
  const peak = o.gain ?? 0.2;
  const atk = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.value = o.filter.freq;
    f.Q.value = o.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(o.bus ?? sfxBus!);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

function noise(o: { start?: number; dur: number; gain?: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number; bus?: GainNode | null }) {
  const c = ensure();
  if (!c || !noiseBuf) return;
  const t = c.currentTime + (o.start ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'highpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(o.bus ?? sfxBus!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.05);
}

// ---- Sound effects ---------------------------------------------------------------

export type Sfx =
  | 'punch'
  | 'swing'
  | 'pistol'
  | 'smg'
  | 'shotgun'
  | 'empty'
  | 'crash'
  | 'bump'
  | 'explosion'
  | 'horn'
  | 'door'
  | 'cash'
  | 'pickup'
  | 'ring'
  | 'job'
  | 'fail'
  | 'wasted'
  | 'busted'
  | 'deny'
  | 'select'
  | 'back'
  | 'move'
  | 'blip'
  | 'hurt'
  | 'death'
  | 'carjack'
  | 'buy'
  | 'save'
  | 'star'
  | 'eat'
  | 'spray'
  | 'ricochet';

const lastPlayed = new Map<Sfx, number>();

/** Play a sound effect; `vol` scales it, e.g. by distance. */
export function sfx(name: Sfx, vol = 1) {
  const c = ensure();
  if (!c || c.state !== 'running' || vol <= 0.02) return;
  const now = performance.now();
  if ((lastPlayed.get(name) ?? 0) > now - (name === 'smg' ? 55 : 30)) return;
  lastPlayed.set(name, now);
  const g = (x: number) => x * vol;
  switch (name) {
    case 'punch':
      noise({ dur: 0.06, gain: g(0.16), filter: 'lowpass', freq: 1400, to: 400 });
      tone({ type: 'sine', freq: 160, to: 70, dur: 0.08, gain: g(0.22) });
      break;
    case 'swing':
      noise({ dur: 0.09, gain: g(0.1), filter: 'bandpass', freq: 2600, to: 800, q: 1.2 });
      break;
    case 'pistol':
      noise({ dur: 0.12, gain: g(0.3), filter: 'lowpass', freq: 4000, to: 600 });
      tone({ type: 'square', freq: 220, to: 60, dur: 0.07, gain: g(0.12) });
      break;
    case 'smg':
      noise({ dur: 0.07, gain: g(0.22), filter: 'lowpass', freq: 3200, to: 700 });
      tone({ type: 'square', freq: 180, to: 70, dur: 0.05, gain: g(0.08) });
      break;
    case 'shotgun':
      noise({ dur: 0.28, gain: g(0.4), filter: 'lowpass', freq: 2400, to: 200 });
      tone({ type: 'sine', freq: 120, to: 40, dur: 0.2, gain: g(0.3) });
      break;
    case 'empty':
      tone({ type: 'square', freq: 1600, dur: 0.02, gain: g(0.05) });
      break;
    case 'crash':
      noise({ dur: 0.35, gain: g(0.3), filter: 'lowpass', freq: 2200, to: 300 });
      noise({ dur: 0.2, gain: g(0.12), filter: 'highpass', freq: 3000, start: 0.02 });
      tone({ type: 'sine', freq: 90, to: 40, dur: 0.25, gain: g(0.25) });
      break;
    case 'bump':
      noise({ dur: 0.12, gain: g(0.14), filter: 'lowpass', freq: 900, to: 300 });
      break;
    case 'explosion':
      tone({ type: 'sine', freq: 110, to: 28, dur: 0.9, gain: g(0.45) });
      noise({ dur: 0.8, gain: g(0.35), filter: 'lowpass', freq: 1400, to: 90 });
      noise({ dur: 0.3, gain: g(0.15), filter: 'highpass', freq: 2500 });
      break;
    case 'horn':
      tone({ type: 'square', freq: 392, dur: 0.32, gain: g(0.06), filter: { type: 'lowpass', freq: 1600 } });
      tone({ type: 'square', freq: 494, dur: 0.32, gain: g(0.05), filter: { type: 'lowpass', freq: 1600 } });
      break;
    case 'door':
      tone({ type: 'triangle', freq: 300, to: 220, dur: 0.06, gain: g(0.06) });
      break;
    case 'cash':
      tone({ type: 'square', freq: 1319, dur: 0.05, gain: g(0.06) });
      tone({ type: 'square', freq: 1760, start: 0.05, dur: 0.1, gain: g(0.06) });
      noise({ dur: 0.08, gain: g(0.05), filter: 'highpass', freq: 6000, start: 0.02 });
      break;
    case 'pickup':
      ['C5', 'E5', 'G5'].forEach((n, i) => tone({ type: 'triangle', freq: noteFreq(n), start: i * 0.05, dur: 0.12, gain: g(0.12) }));
      break;
    case 'ring':
      for (let i = 0; i < 2; i++) {
        tone({ type: 'square', freq: 880, start: i * 0.32, dur: 0.12, gain: g(0.05) });
        tone({ type: 'square', freq: 1100, start: i * 0.32 + 0.12, dur: 0.12, gain: g(0.05) });
      }
      break;
    case 'job':
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => tone({ type: 'square', freq: noteFreq(n), start: i * 0.08, dur: 0.22, gain: g(0.07) }));
      break;
    case 'fail':
      ['E4', 'D#4', 'D4', 'C#4'].forEach((n, i) => tone({ type: 'triangle', freq: noteFreq(n), start: i * 0.16, dur: 0.24, gain: g(0.12) }));
      break;
    case 'wasted':
      ['G3', 'F#3', 'F3', 'E3'].forEach((n, i) => tone({ type: 'sawtooth', freq: noteFreq(n), start: i * 0.22, dur: 0.4, gain: g(0.1), filter: { type: 'lowpass', freq: 900 } }));
      break;
    case 'busted':
      for (let i = 0; i < 3; i++) {
        tone({ type: 'square', freq: 760, start: i * 0.36, dur: 0.18, gain: g(0.06) });
        tone({ type: 'square', freq: 940, start: i * 0.36 + 0.18, dur: 0.18, gain: g(0.06) });
      }
      break;
    case 'deny':
      tone({ type: 'square', freq: 180, dur: 0.12, gain: g(0.08) });
      tone({ type: 'square', freq: 150, start: 0.1, dur: 0.14, gain: g(0.08) });
      break;
    case 'select':
      tone({ type: 'square', freq: 880, dur: 0.05, gain: g(0.05) });
      tone({ type: 'square', freq: 1320, start: 0.045, dur: 0.07, gain: g(0.05) });
      break;
    case 'back':
      tone({ type: 'square', freq: 660, to: 440, dur: 0.08, gain: g(0.05) });
      break;
    case 'move':
      tone({ type: 'square', freq: 660, dur: 0.035, gain: g(0.04) });
      break;
    case 'blip':
      tone({ type: 'square', freq: 700 + Math.random() * 60, dur: 0.025, gain: g(0.025) });
      break;
    case 'hurt':
      tone({ type: 'sawtooth', freq: 380, to: 120, dur: 0.18, gain: g(0.12), filter: { type: 'lowpass', freq: 1800 } });
      break;
    case 'death':
      tone({ type: 'sawtooth', freq: 300, to: 60, dur: 0.4, gain: g(0.1), filter: { type: 'lowpass', freq: 1200 } });
      break;
    case 'carjack':
      noise({ dur: 0.1, gain: g(0.12), filter: 'bandpass', freq: 1200 });
      tone({ type: 'triangle', freq: 200, to: 300, dur: 0.1, gain: g(0.08), start: 0.06 });
      break;
    case 'buy':
      ['E5', 'A5'].forEach((n, i) => tone({ type: 'square', freq: noteFreq(n), start: i * 0.07, dur: 0.12, gain: g(0.06) }));
      break;
    case 'save':
      ['E5', 'B5'].forEach((n, i) => tone({ type: 'sine', freq: noteFreq(n), start: i * 0.1, dur: 0.4, gain: g(0.1) }));
      break;
    case 'star':
      tone({ type: 'square', freq: 523, dur: 0.08, gain: g(0.06) });
      tone({ type: 'square', freq: 392, start: 0.08, dur: 0.12, gain: g(0.06) });
      break;
    case 'eat':
      noise({ dur: 0.05, gain: g(0.08), filter: 'bandpass', freq: 900, start: 0 });
      noise({ dur: 0.05, gain: g(0.08), filter: 'bandpass', freq: 800, start: 0.12 });
      tone({ type: 'sine', freq: 440, to: 660, dur: 0.2, gain: g(0.08), start: 0.25 });
      break;
    case 'spray':
      noise({ dur: 0.9, gain: g(0.12), filter: 'highpass', freq: 4000 });
      break;
    case 'ricochet':
      tone({ type: 'sine', freq: 2400, to: 900, dur: 0.12, gain: g(0.04) });
      break;
  }
}

// ---- Engine and siren loops -------------------------------------------------------

class Loop {
  private nodes: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;
  constructor(private build: (c: AudioContext, out: GainNode) => { osc: OscillatorNode[]; filter: BiquadFilterNode }) {}
  private ensureNodes() {
    const c = ensure();
    if (!c || !sfxBus) return null;
    if (!this.nodes) {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(sfxBus);
      const { osc, filter } = this.build(c, gain);
      this.nodes = { osc, gain, filter };
    }
    return this.nodes;
  }
  set(vol: number, apply?: (osc: OscillatorNode[], filter: BiquadFilterNode, t: number) => void) {
    const c = ctx;
    if (!c || c.state !== 'running') return;
    const n = vol > 0.001 || this.nodes ? this.ensureNodes() : null;
    if (!n) return;
    n.gain.gain.setTargetAtTime(vol, c.currentTime, 0.05);
    apply?.(n.osc, n.filter, c.currentTime);
  }
}

const engine = new Loop((c, out) => {
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.connect(out);
  const a = c.createOscillator();
  a.type = 'sawtooth';
  const b = c.createOscillator();
  b.type = 'square';
  a.connect(filter);
  b.connect(filter);
  a.start();
  b.start();
  return { osc: [a, b], filter };
});

/** Engine note for the car you're driving: ratio is speed/top speed. */
export function engineSound(on: boolean, ratio: number) {
  engine.set(on ? 0.05 + ratio * 0.04 : 0, (osc, filter, t) => {
    const f = 42 + Math.abs(ratio) * 95;
    osc[0].frequency.setTargetAtTime(f, t, 0.08);
    osc[1].frequency.setTargetAtTime(f * 0.5, t, 0.08);
    filter.frequency.setTargetAtTime(300 + Math.abs(ratio) * 900, t, 0.1);
  });
}

const siren = new Loop((c, out) => {
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.connect(out);
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = 850;
  // Two-tone, British style: a square-wave LFO flips the pitch.
  const lfo = c.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 1.25;
  const depth = c.createGain();
  depth.gain.value = 95;
  lfo.connect(depth).connect(o.frequency);
  o.connect(filter);
  o.start();
  lfo.start();
  return { osc: [o, lfo], filter };
});

/** Siren loudness from the nearest police car (0 = off). */
export function sirenSound(vol: number) {
  siren.set(vol * 0.035);
}

// ---- Music and radio -------------------------------------------------------------

interface Voice {
  wave: OscillatorType | 'noise' | 'kick' | 'snare';
  /** Space separated notes, one per step. '.' rests, '-' holds the previous note. */
  notes: string;
  gain: number;
  filter?: number;
}

interface Track {
  bpm: number;
  /** Steps per beat (2 = eighth notes, 4 = sixteenths). */
  div: number;
  voices: Voice[];
}

const bars = (...b: string[]) => b.join(' ');
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 92,
    div: 2,
    voices: [
      { wave: 'sawtooth', gain: 0.1, filter: 650, notes: bars('A1 A2 A1 A2 A1 A2 A1 A2', 'F1 F2 F1 F2 F1 F2 F1 F2', 'C2 C3 C2 C3 C2 C3 C2 C3', 'G1 G2 G1 G2 G1 G2 G1 G2') },
      { wave: 'triangle', gain: 0.07, notes: bars('A3 - - - - - - -', 'F3 - - - - - - -', 'C4 - - - - - - -', 'G3 - - - - - - -') },
      { wave: 'triangle', gain: 0.06, notes: bars('E4 - - - - - - -', 'C4 - - - - - - -', 'G4 - - - - - - -', 'D4 - - - - - - -') },
      { wave: 'square', gain: 0.045, filter: 1800, notes: bars('E5 - - - D5 - C5 -', 'A4 - - - - - . .', 'G4 - A4 - C5 - E5 -', 'D5 - - - - - . .') },
      { wave: 'kick', gain: 0.32, notes: rep('x . . . x . . .', 4) },
      { wave: 'snare', gain: 0.1, notes: rep('. . x . . . x .', 4) },
      { wave: 'noise', gain: 0.025, notes: rep('. x . x . x . x', 4) },
    ],
  },
  neon: {
    bpm: 108,
    div: 2,
    voices: [
      { wave: 'sawtooth', gain: 0.1, filter: 600, notes: bars('D2 D2 D3 D2 D2 D3 D2 D3', 'A#1 A#1 A#2 A#1 A#1 A#2 A#1 A#2', 'F1 F1 F2 F1 F1 F2 F1 F2', 'C2 C2 C3 C2 C2 C3 C2 C3') },
      { wave: 'square', gain: 0.04, filter: 2400, notes: bars('D4 F4 A4 D5 A4 F4 D4 F4', 'A#3 D4 F4 A#4 F4 D4 A#3 D4', 'F3 A3 C4 F4 C4 A3 F3 A3', 'C4 E4 G4 C5 G4 E4 C4 E4') },
      { wave: 'sawtooth', gain: 0.07, filter: 2200, notes: bars('A4 - - - G4 - F4 -', 'F4 - - - D4 - - -', 'C5 - - - A4 - G4 -', 'E4 - - - - - . .', 'A4 - - - C5 - D5 -', 'D5 - - - A#4 - - -', 'C5 - - - F5 - E5 -', 'E5 - - - - - . .') },
      { wave: 'kick', gain: 0.34, notes: rep('x . . . x . . .', 4) },
      { wave: 'snare', gain: 0.12, notes: rep('. . x . . . x .', 4) },
      { wave: 'noise', gain: 0.03, notes: rep('. x . x . x . x', 4) },
    ],
  },
  grime: {
    bpm: 140,
    div: 4,
    voices: [
      { wave: 'square', gain: 0.13, filter: 320, notes: bars('E1 - - - . . E1 - G1 - - - . . . .', 'E1 - - - . . E1 - D1 - - - C1 - - -') },
      { wave: 'triangle', gain: 0.07, notes: bars('. . . . E4 . . . . . . . G4 . . .', '. . . . E4 . . . . . . . A#4 . G4 .') },
      { wave: 'square', gain: 0.03, filter: 3000, notes: bars('. . . . . . . . . . B5 . . . . .', '. . . . . . . . . . . . . . E6 .') },
      { wave: 'kick', gain: 0.4, notes: bars('x . . . . . . . . . x . . . . .', 'x . . . . . . x . . x . . . . .') },
      { wave: 'snare', gain: 0.16, notes: bars('. . . . . . . . x . . . . . . .', '. . . . . . . . x . . . . . x .') },
      { wave: 'noise', gain: 0.03, notes: bars('x . x . x . x x x . x . x . x .', 'x . x . x . x . x . x x x . x .') },
    ],
  },
  cuppa: {
    bpm: 88,
    div: 2,
    voices: [
      { wave: 'triangle', gain: 0.13, notes: bars('C2 . E2 . G2 . A2 .', 'A1 . C2 . E2 . G2 .', 'D2 . F2 . A2 . C3 .', 'G1 . B1 . D2 . F2 .') },
      { wave: 'sine', gain: 0.05, notes: bars('E4 - - - - - - -', 'C4 - - - - - - -', 'F4 - - - - - - -', 'F4 - - - - - - -') },
      { wave: 'sine', gain: 0.05, notes: bars('B4 - - - - - - -', 'G4 - - - - - - -', 'C5 - - - - - - -', 'B4 - - - - - - -') },
      { wave: 'triangle', gain: 0.1, notes: bars('E5 - D5 - C5 - B4 -', 'C5 - - - A4 - - -', 'F5 - E5 - D5 - C5 -', 'B4 - - - G4 - . .', 'G5 - F5 - E5 - D5 -', 'E5 - - - C5 - - -', 'A5 - G5 - F5 - D5 -', 'C5 - - - - - . .') },
      { wave: 'noise', gain: 0.018, notes: rep('. x . x . x . x', 4) },
    ],
  },
  riot: {
    bpm: 176,
    div: 2,
    voices: [
      { wave: 'square', gain: 0.07, filter: 1500, notes: bars('E3 E3 E3 E3 E3 E3 E3 E3', 'C3 C3 C3 C3 C3 C3 C3 C3', 'G2 G2 G2 G2 G2 G2 G2 G2', 'D3 D3 D3 D3 D3 D3 D3 D3') },
      { wave: 'square', gain: 0.06, filter: 1500, notes: bars('B3 B3 B3 B3 B3 B3 B3 B3', 'G3 G3 G3 G3 G3 G3 G3 G3', 'D3 D3 D3 D3 D3 D3 D3 D3', 'A3 A3 A3 A3 A3 A3 A3 A3') },
      { wave: 'sawtooth', gain: 0.08, filter: 700, notes: bars('E2 E2 E2 E2 E2 E2 E2 E2', 'C2 C2 C2 C2 C2 C2 C2 C2', 'G1 G1 G1 G1 G1 G1 G1 G1', 'D2 D2 D2 D2 D2 D2 D2 D2') },
      { wave: 'kick', gain: 0.34, notes: rep('x . x . x . x .', 4) },
      { wave: 'snare', gain: 0.14, notes: rep('. . x . . . x .', 4) },
      { wave: 'noise', gain: 0.035, notes: rep('x x x x x x x x', 4) },
    ],
  },
};

export const STATIONS = [
  { track: 'neon', name: 'Neon 88.4', tag: 'Synths for the night shift' },
  { track: 'grime', name: 'Grime Time FM', tag: 'Straight from the estate' },
  { track: 'cuppa', name: 'Cuppa FM', tag: 'Easy listening. Put the kettle on.' },
  { track: 'riot', name: 'Riot Radio', tag: 'Loud, fast, rude' },
];

class Sequencer {
  private track: Track | null = null;
  private name: string | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private gain: GainNode | null = null;
  private parsed: string[][] = [];

  play(name: string) {
    if (this.name === name) return;
    const c = ensure();
    this.stop(0.8);
    this.name = name;
    const track = TRACKS[name];
    if (!track || !c) return;
    this.track = track;
    this.parsed = track.voices.map((v) => v.notes.split(/\s+/).filter(Boolean));
    this.gain = c.createGain();
    this.gain.gain.setValueAtTime(0.0001, c.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.2);
    this.gain.connect(musicBus!);
    this.step = 0;
    this.nextTime = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop(fade = 0.5) {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const g = this.gain;
    if (g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
      window.setTimeout(() => g.disconnect(), fade * 1000 + 100);
    }
    this.gain = null;
    this.track = null;
    this.name = null;
  }

  private schedule() {
    const c = ctx;
    const t = this.track;
    if (!c || !t || !this.gain) return;
    if (c.state !== 'running') {
      this.nextTime = c.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / t.bpm / t.div;
    while (this.nextTime < c.currentTime + 0.15) {
      t.voices.forEach((v, vi) => {
        const notes = this.parsed[vi];
        const tok = notes[this.step % notes.length];
        if (tok === '.' || tok === '-') return;
        let len = 1;
        while (notes[(this.step + len) % notes.length] === '-' && len < notes.length) len++;
        this.voice(v, tok, this.nextTime, len * stepDur);
      });
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private voice(v: Voice, tok: string, when: number, dur: number) {
    const c = ctx!;
    const out = this.gain!;
    const g = c.createGain();
    g.connect(out);
    if (v.wave === 'noise') {
      if (!noiseBuf) return;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      g.gain.setValueAtTime(v.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      src.connect(f).connect(g);
      src.start(when, Math.random() * 0.5);
      src.stop(when + 0.08);
      return;
    }
    if (v.wave === 'snare') {
      if (!noiseBuf) return;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.6;
      g.gain.setValueAtTime(v.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
      src.connect(f).connect(g);
      src.start(when, Math.random() * 0.5);
      src.stop(when + 0.16);
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, when);
      o.frequency.exponentialRampToValueAtTime(120, when + 0.08);
      const og = c.createGain();
      og.gain.setValueAtTime(v.gain * 0.8, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
      o.connect(og).connect(out);
      o.start(when);
      o.stop(when + 0.1);
      return;
    }
    if (v.wave === 'kick') {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(140, when);
      o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(v.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      o.connect(g);
      o.start(when);
      o.stop(when + 0.2);
      return;
    }
    const o = c.createOscillator();
    o.type = v.wave;
    o.frequency.value = noteFreq(tok);
    let node: AudioNode = o;
    if (v.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = v.filter;
      o.connect(f);
      node = f;
    }
    const rel = Math.min(0.25, dur * 0.4);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v.gain, when + 0.015);
    g.gain.setValueAtTime(v.gain * 0.8, when + Math.max(0.02, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    node.connect(g);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  get current() {
    return this.name;
  }
}

const sequencer = new Sequencer();

export function playMusic(name: string | null) {
  if (!name) sequencer.stop();
  else sequencer.play(name);
}

export function currentMusic() {
  return sequencer.current;
}
