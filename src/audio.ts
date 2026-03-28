// ── Programmatic audio: sound effects + chiptune music ──

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicPlaying = false;
let musicInterval: number | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.15;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.25;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Sound effects ──

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 1,
  freqEnd?: number,
) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  }
  gain.gain.setValueAtTime(volume * 0.3, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain!);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

function playNoise(duration: number, volume = 1) {
  const c = getCtx();
  const bufferSize = Math.round(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume * 0.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  source.connect(gain);
  gain.connect(sfxGain!);
  source.start(c.currentTime);
}

export function sfxShoot() {
  playTone(800, 0.08, 'square', 0.5, 1200);
}

export function sfxSlopShoot() {
  playTone(200, 0.15, 'sawtooth', 0.6, 100);
  playNoise(0.1, 0.3);
}

export function sfxZapShoot() {
  playTone(1500, 0.12, 'sawtooth', 0.4, 2500);
  playTone(2000, 0.08, 'square', 0.2, 3000);
}

export function sfxEnemyDeath() {
  playTone(400, 0.1, 'square', 0.6, 200);
  playNoise(0.08, 0.4);
  playTone(300, 0.15, 'square', 0.3, 100);
}

export function sfxWallBreak() {
  playNoise(0.25, 0.8);
  playTone(100, 0.2, 'sawtooth', 0.4, 50);
}

export function sfxPlace() {
  playTone(600, 0.06, 'square', 0.4, 800);
  playTone(800, 0.06, 'square', 0.3, 1000);
}

export function sfxSell() {
  playTone(800, 0.06, 'triangle', 0.5, 400);
  playTone(600, 0.08, 'triangle', 0.3, 300);
}

export function sfxUpgrade() {
  playTone(500, 0.08, 'square', 0.4, 700);
  playTone(700, 0.08, 'square', 0.3, 900);
  playTone(900, 0.1, 'square', 0.3, 1100);
}

export function sfxWaveStart() {
  playTone(440, 0.12, 'triangle', 0.5);
  setTimeout(() => playTone(550, 0.12, 'triangle', 0.5), 120);
  setTimeout(() => playTone(660, 0.15, 'triangle', 0.6), 240);
}

export function sfxLifeLost() {
  playTone(300, 0.15, 'sawtooth', 0.6, 150);
  setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.5, 100), 150);
}

export function sfxWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.2, 'square', 0.5), i * 150);
  });
}

export function sfxLose() {
  const notes = [400, 350, 300, 200];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.25, 'sawtooth', 0.5, n * 0.5), i * 200);
  });
}

// ── Music: simple chiptune loop ──

// A quirky, bouncy 8-bit melody in C major
// Each row: [note frequency (0=rest), duration in 16th notes]
const MELODY: [number, number][] = [
  // Bar 1: bouncy theme
  [523, 2], [0, 1], [659, 1], [784, 2], [659, 1], [523, 1],
  // Bar 2
  [440, 2], [523, 1], [659, 1], [523, 2], [0, 2],
  // Bar 3: variation
  [784, 2], [0, 1], [659, 1], [523, 2], [440, 1], [523, 1],
  // Bar 4: resolution
  [659, 2], [523, 1], [440, 1], [523, 3], [0, 1],
];

const BASS: [number, number][] = [
  // Bar 1
  [131, 4], [165, 4],
  // Bar 2
  [110, 4], [131, 4],
  // Bar 3
  [165, 4], [131, 4],
  // Bar 4
  [110, 4], [131, 4],
];

const BPM = 140;
const SIXTEENTH = 60 / BPM / 4; // seconds per 16th note

function playMusicNote(freq: number, duration: number, type: OscillatorType, volume: number) {
  if (!ctx || !musicGain) return;
  if (freq === 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const durSec = duration * SIXTEENTH;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime + durSec * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec * 0.95);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + durSec);
}

export function startMusic() {
  if (musicPlaying) return;
  getCtx();
  musicPlaying = true;

  let melodyIdx = 0;
  let bassIdx = 0;
  let melodyCountdown = 0;
  let bassCountdown = 0;

  // Tick every 16th note
  const tick = () => {
    if (!musicPlaying) return;

    if (melodyCountdown <= 0) {
      const note = MELODY[melodyIdx % MELODY.length]!;
      playMusicNote(note[0], note[1], 'square', 0.35);
      melodyCountdown = note[1];
      melodyIdx++;
    }
    melodyCountdown--;

    if (bassCountdown <= 0) {
      const note = BASS[bassIdx % BASS.length]!;
      playMusicNote(note[0], note[1], 'triangle', 0.5);
      bassCountdown = note[1];
      bassIdx++;
    }
    bassCountdown--;
  };

  // Run first tick immediately
  tick();
  musicInterval = window.setInterval(tick, SIXTEENTH * 1000);
}

export function stopMusic() {
  musicPlaying = false;
  if (musicInterval !== null) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

export function toggleMusic(): boolean {
  if (musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
  return musicPlaying;
}

export function isMusicPlaying(): boolean {
  return musicPlaying;
}
