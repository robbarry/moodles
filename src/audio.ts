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

// ── Music: multi-section chiptune with percussion ──
//
// Structure: A → A → B → B → C → C → A → bridge → repeat
// Each section has its own melody, bass, and arp patterns.
// Percussion runs throughout. Small random variations keep it fresh.

const BPM = 145;
const SIXTEENTH = 60 / BPM / 4;

// Note helpers — frequency table
const N: Record<string, number> = {
  '_': 0,
  'C3': 131, 'D3': 147, 'E3': 165, 'F3': 175, 'G3': 196, 'A3': 220, 'Bb3': 233, 'B3': 247,
  'C4': 262, 'D4': 294, 'E4': 330, 'F4': 349, 'G4': 392, 'A4': 440, 'Bb4': 466, 'B4': 494,
  'C5': 523, 'D5': 587, 'E5': 659, 'F5': 698, 'G5': 784, 'A5': 880, 'Bb5': 932, 'B5': 988,
  'C6': 1047,
};

type NoteSeq = [number, number][]; // [freq, duration in 16ths]

function notes(str: string): NoteSeq {
  // Parse "C5:2 _:1 E5:1 G5:2" format
  return str.trim().split(/\s+/).map((tok) => {
    const [note, dur] = tok.split(':');
    return [N[note!] ?? 0, parseInt(dur!, 10)] as [number, number];
  });
}

// ── Section A: bouncy main theme (C major) ──
const melodyA: NoteSeq = notes(
  'C5:2 _:1 E5:1 G5:2 E5:1 C5:1 ' +    // bar 1
  'A4:2 C5:1 E5:1 C5:2 _:2 ' +           // bar 2
  'G5:2 _:1 E5:1 C5:2 A4:1 C5:1 ' +      // bar 3
  'E5:2 D5:1 C5:1 C5:2 _:2'               // bar 4
);
const bassA: NoteSeq = notes(
  'C3:2 C3:2 E3:2 E3:2 A3:2 A3:2 C3:2 C3:2 ' +
  'E3:2 E3:2 G3:2 G3:2 A3:2 A3:2 C3:2 G3:2'
);
const arpA: NoteSeq = notes(
  'C4:1 E4:1 G4:1 E4:1 C4:1 E4:1 G4:1 E4:1 ' +
  'A3:1 C4:1 E4:1 C4:1 A3:1 C4:1 E4:1 C4:1 ' +
  'E4:1 G4:1 B4:1 G4:1 E4:1 G4:1 B4:1 G4:1 ' +
  'A3:1 C4:1 E4:1 G4:1 C4:1 E4:1 G4:1 C5:1'
);

// ── Section B: darker, minor feel (A minor → F major) ──
const melodyB: NoteSeq = notes(
  'A4:3 _:1 C5:2 B4:1 A4:1 ' +
  'F4:2 A4:1 C5:1 A4:2 G4:2 ' +
  'E5:2 _:1 D5:1 C5:2 B4:1 A4:1 ' +
  'C5:3 _:1 A4:2 _:2'
);
const bassB: NoteSeq = notes(
  'A3:2 A3:2 E3:2 E3:2 F3:2 F3:2 C3:2 C3:2 ' +
  'A3:2 A3:2 G3:2 G3:2 F3:2 F3:2 E3:2 E3:2'
);
const arpB: NoteSeq = notes(
  'A3:1 C4:1 E4:1 A4:1 C4:1 E4:1 A4:1 E4:1 ' +
  'F3:1 A3:1 C4:1 F4:1 A3:1 C4:1 F4:1 C4:1 ' +
  'E4:1 G4:1 B4:1 E5:1 G4:1 B4:1 E5:1 B4:1 ' +
  'A3:1 C4:1 E4:1 A4:1 E4:1 C4:1 A3:1 E3:1'
);

// ── Section C: triumphant, higher energy (G major → C major) ──
const melodyC: NoteSeq = notes(
  'G5:1 _:1 G5:1 A5:1 B5:2 G5:2 ' +
  'E5:2 D5:1 E5:1 G5:2 _:2 ' +
  'C6:2 _:1 B5:1 A5:2 G5:1 A5:1 ' +
  'B5:2 A5:1 G5:1 G5:2 _:2'
);
const bassC: NoteSeq = notes(
  'G3:2 G3:2 D3:2 D3:2 C3:2 C3:2 G3:2 G3:2 ' +
  'E3:2 E3:2 D3:2 D3:2 C3:2 C3:2 G3:2 D3:2'
);
const arpC: NoteSeq = notes(
  'G4:1 B4:1 D5:1 B4:1 G4:1 B4:1 D5:1 B4:1 ' +
  'C4:1 E4:1 G4:1 E4:1 C4:1 E4:1 G4:1 E4:1 ' +
  'E4:1 G4:1 C5:1 G4:1 E4:1 G4:1 C5:1 G4:1 ' +
  'G4:1 B4:1 D5:1 G5:1 D5:1 B4:1 G4:1 D4:1'
);

// ── Bridge: sparse, breathy, builds tension ──
const melodyBridge: NoteSeq = notes(
  'E5:4 _:4 D5:4 _:4 ' +
  'C5:4 _:4 B4:4 _:4 ' +
  'A4:4 _:2 B4:2 C5:4 _:4 ' +
  'D5:4 _:2 E5:2 C5:4 _:4'
);
const bassBridge: NoteSeq = notes(
  'A3:4 _:4 G3:4 _:4 F3:4 _:4 E3:4 _:4 ' +
  'A3:4 _:4 G3:4 _:4 F3:4 _:4 G3:4 _:4'
);

// Percussion patterns: 1 = kick, 2 = snare, 3 = hihat, 0 = rest
const drumMain =  [1, 3, 0, 3, 2, 3, 0, 3, 1, 3, 1, 3, 2, 3, 0, 3]; // 1 bar of 16ths
const drumBridge = [1, 0, 3, 0, 0, 0, 3, 0, 1, 0, 3, 0, 0, 0, 3, 0];
const drumFill =  [2, 2, 3, 2, 2, 3, 2, 2, 1, 3, 1, 3, 2, 2, 2, 1]; // transition fill

// Song structure: each entry is [melody, bass, arp|null, drumPattern, bars]
interface Section {
  melody: NoteSeq;
  bass: NoteSeq;
  arp: NoteSeq | null;
  drums: number[];
  bars: number;
}

// Sections pool — the song picks from these procedurally
const SECTIONS: Section[] = [
  { melody: melodyA, bass: bassA, arp: arpA, drums: drumMain, bars: 2 },
  { melody: melodyB, bass: bassB, arp: arpB, drums: drumMain, bars: 2 },
  { melody: melodyC, bass: bassC, arp: arpC, drums: drumMain, bars: 2 },
  { melody: melodyBridge, bass: bassBridge, arp: null, drums: drumBridge, bars: 1 },
  // Variations: same melodies with different drums or no arp
  { melody: melodyA, bass: bassA, arp: null, drums: drumFill, bars: 1 },
  { melody: melodyB, bass: bassB, arp: arpA, drums: drumMain, bars: 1 }, // cross-pollinate arp
  { melody: melodyC, bass: bassC, arp: arpB, drums: drumFill, bars: 1 },
  { melody: melodyA, bass: bassC, arp: arpC, drums: drumMain, bars: 2 }, // A melody over C bass
  { melody: melodyC, bass: bassA, arp: null, drums: drumBridge, bars: 1 }, // C melody, sparse
];

/** Generate a procedural song sequence that doesn't repeat the same section back-to-back */
function generateSongOrder(): number[] {
  const order: number[] = [];
  let last = -1;
  for (let i = 0; i < 16; i++) {
    let next: number;
    do {
      next = Math.floor(Math.random() * SECTIONS.length);
    } while (next === last);
    order.push(next);
    last = next;
  }
  return order;
}

let songOrder: number[] = [];

function playMusicNote(freq: number, duration: number, type: OscillatorType, volume: number) {
  if (!ctx || !musicGain) return;
  if (freq === 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const durSec = duration * SIXTEENTH;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime + durSec * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec * 0.9);
  osc.connect(gain);
  gain.connect(musicGain!);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + durSec);
}

function playDrum(kind: number) {
  if (!ctx || !musicGain) return;
  const t = ctx.currentTime;

  if (kind === 1) {
    // Kick: low sine thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(musicGain!);
    osc.start(t);
    osc.stop(t + 0.12);
  } else if (kind === 2) {
    // Snare: noise burst + tone
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(gain);
    gain.connect(musicGain!);
    src.start(t);
    // Tone body
    const osc = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    g2.gain.setValueAtTime(0.15, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g2);
    g2.connect(musicGain!);
    osc.start(t);
    osc.stop(t + 0.05);
  } else if (kind === 3) {
    // Hi-hat: short high noise
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(musicGain!);
    src.start(t);
  }
}

export function startMusic() {
  if (musicPlaying) return;
  getCtx();
  musicPlaying = true;

  // Generate a fresh procedural song order each time
  songOrder = generateSongOrder();

  // Start at a random section so it doesn't always open the same way
  let orderIdx = Math.floor(Math.random() * songOrder.length);
  let barInSection = 0;
  let melodyIdx = 0;
  let bassIdx = 0;
  let arpIdx = 0;
  let melodyCountdown = 0;
  let bassCountdown = 0;
  let tickInBar = 0;

  function currentSection(): Section {
    const idx = songOrder[orderIdx % songOrder.length]!;
    return SECTIONS[idx]!;
  }

  const tick = () => {
    if (!musicPlaying) return;
    const section = currentSection();

    // Melody — with random octave shifts and note skips for variety
    if (melodyCountdown <= 0) {
      const note = section.melody[melodyIdx % section.melody.length]!;
      let freq = note[0];
      // ~10% chance to play an octave up
      if (freq > 0 && Math.random() < 0.1) freq *= 2;
      // ~5% chance to skip a note (replace with rest)
      if (Math.random() < 0.05) freq = 0;
      const wobble = 1 + (Math.random() - 0.5) * 0.008;
      playMusicNote(freq * wobble, note[1], 'square', 0.3);
      melodyCountdown = note[1];
      melodyIdx++;
    }
    melodyCountdown--;

    // Bass — occasional octave drop for variety
    if (bassCountdown <= 0) {
      const note = section.bass[bassIdx % section.bass.length]!;
      let freq = note[0];
      if (freq > 0 && Math.random() < 0.08) freq *= 0.5;
      playMusicNote(freq, note[1], 'triangle', 0.4);
      bassCountdown = note[1];
      bassIdx++;
    }
    bassCountdown--;

    // Arp (not all sections have it) — random velocity variation
    if (section.arp) {
      const arpNote = section.arp[arpIdx % section.arp.length]!;
      if (arpNote[0] > 0) {
        const vol = 0.06 + Math.random() * 0.06;
        playMusicNote(arpNote[0], 1, 'square', vol);
      }
      arpIdx++;
    }

    // Drums — occasional ghost notes and dropped hits
    let drumHit = section.drums[tickInBar % section.drums.length] ?? 0;
    // ~8% chance to drop a hit (humanize)
    if (drumHit > 0 && Math.random() < 0.08) drumHit = 0;
    // ~5% chance to add a ghost hi-hat
    if (drumHit === 0 && Math.random() < 0.05) drumHit = 3;
    if (drumHit > 0) {
      playDrum(drumHit);
    }

    tickInBar++;
    if (tickInBar >= 16) {
      tickInBar = 0;
      barInSection++;
      if (barInSection >= section.bars) {
        barInSection = 0;
        orderIdx++;
        // When we exhaust the current song order, generate a new one
        if (orderIdx >= songOrder.length) {
          songOrder = generateSongOrder();
          orderIdx = 0;
        }
        melodyIdx = 0;
        bassIdx = 0;
        arpIdx = 0;
        melodyCountdown = 0;
        bassCountdown = 0;
      }
    }
  };

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
