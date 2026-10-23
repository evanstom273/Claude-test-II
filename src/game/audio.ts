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
  | 'swing'
  | 'hit'
  | 'hurt'
  | 'kill'
  | 'coin'
  | 'pickup'
  | 'heal'
  | 'bolt'
  | 'dash'
  | 'radiance'
  | 'chest'
  | 'gate'
  | 'blip'
  | 'move'
  | 'select'
  | 'back'
  | 'levelup'
  | 'roar'
  | 'slam'
  | 'shoot'
  | 'burn'
  | 'death'
  | 'save'
  | 'ember'
  | 'fall'
  | 'deny'
  | 'boom';

const lastPlayed = new Map<Sfx, number>();

export function sfx(name: Sfx) {
  const c = ensure();
  if (!c || c.state !== 'running') return;
  // Avoid machine-gunning identical sounds in the same instant.
  const now = performance.now();
  if ((lastPlayed.get(name) ?? 0) > now - 30) return;
  lastPlayed.set(name, now);
  switch (name) {
    case 'swing':
      noise({ dur: 0.09, gain: 0.12, filter: 'bandpass', freq: 3000, to: 900, q: 1.2 });
      break;
    case 'hit':
      tone({ type: 'square', freq: 320, to: 120, dur: 0.08, gain: 0.12 });
      noise({ dur: 0.05, gain: 0.1, freq: 2000 });
      break;
    case 'hurt':
      tone({ type: 'sawtooth', freq: 420, to: 110, dur: 0.22, gain: 0.14, filter: { type: 'lowpass', freq: 1800 } });
      break;
    case 'kill':
      noise({ dur: 0.18, gain: 0.16, filter: 'lowpass', freq: 1600, to: 200 });
      tone({ type: 'triangle', freq: 180, to: 50, dur: 0.18, gain: 0.2 });
      break;
    case 'coin':
      tone({ type: 'square', freq: 988, dur: 0.06, gain: 0.07 });
      tone({ type: 'square', freq: 1319, start: 0.05, dur: 0.12, gain: 0.07 });
      break;
    case 'pickup':
      ['C5', 'E5', 'G5'].forEach((n, i) => tone({ type: 'triangle', freq: noteFreq(n), start: i * 0.05, dur: 0.12, gain: 0.12 }));
      break;
    case 'heal':
      tone({ type: 'sine', freq: 440, to: 880, dur: 0.35, gain: 0.14, attack: 0.05 });
      tone({ type: 'sine', freq: 660, to: 1320, dur: 0.35, gain: 0.06, attack: 0.05, start: 0.05 });
      break;
    case 'bolt':
      noise({ dur: 0.25, gain: 0.12, filter: 'bandpass', freq: 700, to: 2400, q: 2 });
      tone({ type: 'sine', freq: 220, to: 440, dur: 0.18, gain: 0.1 });
      break;
    case 'dash':
      noise({ dur: 0.16, gain: 0.12, filter: 'bandpass', freq: 1500, to: 400, q: 1.5 });
      break;
    case 'radiance':
      ['C4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => tone({ type: 'sine', freq: noteFreq(n), start: i * 0.03, dur: 0.8, gain: 0.08, attack: 0.04 }));
      noise({ dur: 0.6, gain: 0.08, filter: 'highpass', freq: 5000 });
      break;
    case 'chest':
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone({ type: 'square', freq: noteFreq(n), start: i * 0.07, dur: 0.18, gain: 0.07 }));
      break;
    case 'gate':
      tone({ type: 'square', freq: 110, to: 70, dur: 0.25, gain: 0.15, filter: { type: 'lowpass', freq: 600 } });
      noise({ dur: 0.2, gain: 0.1, filter: 'lowpass', freq: 800, start: 0.05 });
      break;
    case 'blip':
      tone({ type: 'square', freq: 700 + Math.random() * 60, dur: 0.025, gain: 0.025 });
      break;
    case 'move':
      tone({ type: 'square', freq: 660, dur: 0.04, gain: 0.05 });
      break;
    case 'select':
      tone({ type: 'square', freq: 880, dur: 0.06, gain: 0.06 });
      tone({ type: 'square', freq: 1320, start: 0.05, dur: 0.08, gain: 0.06 });
      break;
    case 'back':
      tone({ type: 'square', freq: 660, to: 440, dur: 0.08, gain: 0.05 });
      break;
    case 'deny':
      tone({ type: 'square', freq: 180, dur: 0.12, gain: 0.08 });
      tone({ type: 'square', freq: 150, start: 0.1, dur: 0.14, gain: 0.08 });
      break;
    case 'levelup':
      ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => tone({ type: 'square', freq: noteFreq(n), start: i * 0.08, dur: 0.2, gain: 0.07 }));
      break;
    case 'roar':
      tone({ type: 'sawtooth', freq: 90, to: 55, dur: 1.1, gain: 0.18, filter: { type: 'lowpass', freq: 500 }, attack: 0.1 });
      tone({ type: 'sawtooth', freq: 93, to: 50, dur: 1.1, gain: 0.14, filter: { type: 'lowpass', freq: 400 }, attack: 0.1, detune: 20 });
      noise({ dur: 1, gain: 0.08, filter: 'lowpass', freq: 600 });
      break;
    case 'slam':
    case 'boom':
      tone({ type: 'sine', freq: 120, to: 35, dur: 0.5, gain: 0.35 });
      noise({ dur: 0.35, gain: 0.18, filter: 'lowpass', freq: 900, to: 100 });
      break;
    case 'shoot':
      tone({ type: 'square', freq: 520, to: 260, dur: 0.08, gain: 0.05 });
      break;
    case 'burn':
      noise({ dur: 0.4, gain: 0.14, filter: 'bandpass', freq: 1800, q: 0.8 });
      noise({ dur: 0.25, gain: 0.1, filter: 'lowpass', freq: 500, start: 0.05 });
      break;
    case 'death':
      ['G4', 'E4', 'C4', 'G3'].forEach((n, i) => tone({ type: 'triangle', freq: noteFreq(n), start: i * 0.18, dur: 0.3, gain: 0.14 }));
      break;
    case 'save':
      ['E5', 'B5'].forEach((n, i) => tone({ type: 'sine', freq: noteFreq(n), start: i * 0.1, dur: 0.4, gain: 0.1 }));
      break;
    case 'ember':
      ['C5', 'E5', 'G5', 'B5', 'D6', 'G6'].forEach((n, i) => tone({ type: 'sine', freq: noteFreq(n), start: i * 0.06, dur: 1.2, gain: 0.07, attack: 0.03 }));
      break;
    case 'fall':
      tone({ type: 'sine', freq: 600, to: 80, dur: 0.5, gain: 0.12 });
      break;
  }
}

// ---- Music -----------------------------------------------------------------------

interface Voice {
  wave: OscillatorType | 'noise' | 'kick';
  /** Space separated notes, one per step. '.' rests, '-' holds the previous note. */
  notes: string;
  gain: number;
  filter?: number;
}

interface Track {
  bpm: number;
  /** Steps per beat (2 = eighth notes). */
  div: number;
  voices: Voice[];
}

const bars = (...b: string[]) => b.join(' ');

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 70,
    div: 2,
    voices: [
      { wave: 'sine', gain: 0.22, notes: bars('A4 - - - C5 - - -', 'B4 - - - G4 - - -', 'A4 - - - E5 - - -', 'D5 - C5 - B4 - - -') },
      { wave: 'triangle', gain: 0.16, notes: bars('A2 - - - - - - -', 'F2 - - - - - - -', 'C3 - - - - - - -', 'G2 - - - - - - -') },
      { wave: 'triangle', gain: 0.06, notes: bars('A3 C4 E4 C4 A3 C4 E4 C4', 'F3 A3 C4 A3 F3 A3 C4 A3', 'C4 E4 G4 E4 C4 E4 G4 E4', 'G3 B3 D4 B3 G3 B3 D4 B3') },
    ],
  },
  village: {
    bpm: 100,
    div: 2,
    voices: [
      {
        wave: 'triangle',
        gain: 0.2,
        notes: bars('E5 - D5 C5 D5 - E5 -', 'G5 - - - E5 - . .', 'A5 - G5 E5 D5 - C5 -', 'D5 - - - . . . .', 'E5 - D5 C5 D5 - E5 G5', 'A5 - - G5 E5 - D5 -', 'C5 - D5 E5 D5 - B4 -', 'C5 - - - . . . .'),
      },
      { wave: 'triangle', gain: 0.18, notes: bars('C3 . G2 . C3 . G2 .', 'A2 . E3 . A2 . E3 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . D3 .', 'C3 . G2 . C3 . G2 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . B2 .', 'C3 . G2 . C3 - - .') },
      { wave: 'sine', gain: 0.05, notes: bars('C4 E4 G4 E4 C4 E4 G4 E4', 'A3 C4 E4 C4 A3 C4 E4 C4', 'F3 A3 C4 A3 F3 A3 C4 A3', 'G3 B3 D4 B3 G3 B3 D4 B3', 'C4 E4 G4 E4 C4 E4 G4 E4', 'F3 A3 C4 A3 F3 A3 C4 A3', 'G3 B3 D4 B3 G3 B3 D4 B3', 'C4 E4 G4 E4 C4 - - .') },
      { wave: 'noise', gain: 0.03, notes: bars('. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . . x .') },
    ],
  },
  forest: {
    bpm: 88,
    div: 2,
    voices: [
      { wave: 'sine', gain: 0.22, notes: bars('A4 - - B4 C5 - B4 A4', 'G4 - - - A4 - - -', 'F4 - G4 A4 C5 - B4 G4', 'A4 - - - - - . .', 'D5 - - C5 B4 - A4 G4', 'A4 - - - F4 - G4 -', 'E4 - F4 G4 A4 - G4 E4', 'D4 - - - - - . .') },
      { wave: 'triangle', gain: 0.17, notes: bars('D3 . A2 . D3 . A2 .', 'C3 . G2 . C3 . G2 .', 'F2 . C3 . F2 . C3 .', 'A2 . E3 . A2 . E3 .', 'D3 . A2 . D3 . A2 .', 'G2 . D3 . G2 . D3 .', 'C3 . G2 . C3 . G2 .', 'D3 . A2 . D3 - - .') },
      { wave: 'triangle', gain: 0.05, notes: bars('D4 F4 A4 F4 D4 F4 A4 F4', 'C4 E4 G4 E4 C4 E4 G4 E4', 'F4 A4 C5 A4 F4 A4 C5 A4', 'A3 C4 E4 C4 A3 C4 E4 C4', 'D4 F4 A4 F4 D4 F4 A4 F4', 'G3 B3 D4 B3 G3 B3 D4 B3', 'C4 E4 G4 E4 C4 E4 G4 E4', 'D4 F4 A4 F4 D4 - - .') },
    ],
  },
  mine: {
    bpm: 66,
    div: 2,
    voices: [
      { wave: 'sine', gain: 0.3, notes: bars('E2 - - - - - - -', '. . . . G2 - - -', 'E2 - - - - - - -', '. . . . B1 - D2 -') },
      { wave: 'triangle', gain: 0.1, notes: bars('. . B4 . . . . .', '. . . . E5 . D5 .', '. G4 . . . . . .', 'F#4 . . . . . . .') },
      { wave: 'sine', gain: 0.04, notes: bars('. . . . . . . E6', '. . . . . . . .', '. . . B5 . . . .', '. . . . . . G6 .') },
    ],
  },
  marsh: {
    bpm: 84,
    div: 2,
    voices: [
      { wave: 'sine', gain: 0.22, notes: bars('E5 - - D5 C5 - - B4', 'A4 - - - - - . .', 'C5 - - B4 A4 - - G4', 'E4 - - - - - . .', 'A4 - B4 C5 D5 - E5 -', 'F5 - - E5 D5 - - -', 'C5 - B4 - A4 - G#4 -', 'A4 - - - - - . .') },
      { wave: 'triangle', gain: 0.17, notes: bars('A2 . E3 . A2 . E3 .', 'A2 . E3 . A2 . E3 .', 'F2 . C3 . F2 . C3 .', 'E2 . B2 . E2 . B2 .', 'A2 . E3 . A2 . E3 .', 'D2 . A2 . D2 . A2 .', 'E2 . B2 . E2 . G#2 .', 'A2 . E3 . A2 - - .') },
    ],
  },
  rift: {
    bpm: 72,
    div: 2,
    voices: [
      { wave: 'sawtooth', gain: 0.1, filter: 500, notes: bars('C2 - - - - - - -', 'C#2 - - - - - - -', 'C2 - - - - - - -', 'G1 - - - G#1 - - -') },
      { wave: 'square', gain: 0.05, filter: 1400, notes: bars('. . G4 . . G#4 . .', 'G4 - - - . . . .', '. . D#4 . . D4 . .', 'C4 - - - B3 - - -') },
      { wave: 'sine', gain: 0.06, notes: bars('C5 - - - - - - -', '. . . . . . . .', 'G4 - - - - - - -', '. . . . . . . .') },
    ],
  },
  boss: {
    bpm: 144,
    div: 2,
    voices: [
      { wave: 'square', gain: 0.1, filter: 900, notes: bars('E2 E2 E3 E2 E2 E3 E2 G2', 'E2 E2 E3 E2 D2 D3 D2 D3', 'C2 C2 C3 C2 C2 C3 C2 D2', 'B1 B1 B2 B1 B1 B2 D2 D#2') },
      { wave: 'sawtooth', gain: 0.07, filter: 2200, notes: bars('E4 - G4 - B4 - A4 G4', 'F#4 - - - D4 - - -', 'E4 - G4 - C5 - B4 A4', 'B4 - - - D#5 - - -') },
      { wave: 'kick', gain: 0.4, notes: bars('x . . . x . . .', 'x . . . x . x .', 'x . . . x . . .', 'x . . . x . x x') },
      { wave: 'noise', gain: 0.05, notes: bars('. . x . . . x .', '. . x . . . x .', '. . x . . . x .', '. . x . . x x x') },
    ],
  },
  victory: {
    bpm: 76,
    div: 2,
    voices: [
      { wave: 'triangle', gain: 0.2, notes: bars('C5 - E5 - G5 - - -', 'F5 - E5 - D5 - - -', 'E5 - G5 - C6 - - -', 'B5 - - - C6 - - -') },
      { wave: 'triangle', gain: 0.16, notes: bars('C3 - - - - - - -', 'F2 - - - - - - -', 'A2 - - - - - - -', 'G2 - - - C3 - - -') },
      { wave: 'sine', gain: 0.05, notes: bars('C4 E4 G4 E4 C4 E4 G4 E4', 'F3 A3 C4 A3 F3 A3 C4 A3', 'A3 C4 E4 C4 A3 C4 E4 C4', 'G3 B3 D4 B3 C4 E4 G4 E4') },
    ],
  },
};

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
