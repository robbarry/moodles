import { EnemyKind } from './types';

export interface WaveEntry {
  kind: EnemyKind;
  count: number;
  hpMultiplier: number;
}

export interface WaveDef {
  entries: WaveEntry[];
}

export const WAVES: WaveDef[] = [
  // Wave 1: gentle intro
  { entries: [{ kind: EnemyKind.Walker, count: 5, hpMultiplier: 1 }] },
  // Wave 2: more walkers
  { entries: [{ kind: EnemyKind.Walker, count: 8, hpMultiplier: 1 }] },
  // Wave 3: sneakers appear
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 4: wanderers appear
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 2, hpMultiplier: 1 },
    ],
  },
  // Wave 5: sprinters!
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 4, hpMultiplier: 1 },
      { kind: EnemyKind.Sprinter, count: 5, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 2, hpMultiplier: 1 },
    ],
  },
  // Wave 6: first tank
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1 },
      { kind: EnemyKind.Tank, count: 1, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 7: mixed pressure
  {
    entries: [
      { kind: EnemyKind.Walker, count: 8, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1 },
      { kind: EnemyKind.Sprinter, count: 6, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 4, hpMultiplier: 1 },
    ],
  },
  // Wave 8: healer appears
  {
    entries: [
      { kind: EnemyKind.Walker, count: 10, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1 },
      { kind: EnemyKind.Tank, count: 2, hpMultiplier: 1 },
      { kind: EnemyKind.Healer, count: 1, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 4, hpMultiplier: 1 },
    ],
  },
  // Wave 9: everything ramps
  {
    entries: [
      { kind: EnemyKind.Walker, count: 12, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 8, hpMultiplier: 1 },
      { kind: EnemyKind.Sprinter, count: 8, hpMultiplier: 1 },
      { kind: EnemyKind.Tank, count: 2, hpMultiplier: 1 },
      { kind: EnemyKind.Healer, count: 1, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 5, hpMultiplier: 1 },
    ],
  },
  // Wave 10: gauntlet
  {
    entries: [
      { kind: EnemyKind.Walker, count: 15, hpMultiplier: 1 },
      { kind: EnemyKind.Sneaker, count: 10, hpMultiplier: 1 },
      { kind: EnemyKind.Sprinter, count: 10, hpMultiplier: 1 },
      { kind: EnemyKind.Tank, count: 3, hpMultiplier: 1 },
      { kind: EnemyKind.Healer, count: 2, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 6, hpMultiplier: 1 },
    ],
  },
];

/** Generate an endless-mode wave for waveNum > 10.
 *  Difficulty scales primarily via enemy counts and type mix.
 *  Gentle HP scaling: +5% every 5 endless waves to prevent runaway wealth. */
export function generateEndlessWave(waveNum: number): WaveDef {
  const n = waveNum - 10;
  const baseCount = 15 + Math.floor(n * 2);
  // Gentle HP scaling: +5% per 5 endless waves (1.0 → 1.05 → 1.10 → ...)
  const hpMult = 1 + Math.floor(n / 5) * 0.05;

  const entries: WaveEntry[] = [
    { kind: EnemyKind.Walker, count: baseCount, hpMultiplier: hpMult },
  ];

  if (n >= 1) entries.push({ kind: EnemyKind.Sneaker, count: Math.floor(baseCount * 0.6), hpMultiplier: hpMult });
  if (n >= 2) entries.push({ kind: EnemyKind.Wanderer, count: Math.floor(baseCount * 0.4), hpMultiplier: hpMult });
  if (n >= 2 && n % 2 === 0) entries.push({ kind: EnemyKind.Sprinter, count: Math.floor(baseCount * 0.5), hpMultiplier: hpMult });
  if (n >= 3 && n % 3 === 0) entries.push({ kind: EnemyKind.Tank, count: 1 + Math.floor(n / 3), hpMultiplier: hpMult });
  if (n >= 5 && n % 5 === 0) entries.push({ kind: EnemyKind.Healer, count: 1 + Math.floor(n / 5), hpMultiplier: hpMult });

  return { entries };
}
