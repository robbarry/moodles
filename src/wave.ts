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
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.2 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 4: wanderers appear
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.3 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1.1 },
      { kind: EnemyKind.Wanderer, count: 2, hpMultiplier: 1 },
    ],
  },
  // Wave 5: sprinters!
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 4, hpMultiplier: 1.2 },
      { kind: EnemyKind.Sprinter, count: 5, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 2, hpMultiplier: 1.2 },
    ],
  },
  // Wave 6: first tank
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1.3 },
      { kind: EnemyKind.Tank, count: 1, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 3, hpMultiplier: 1.3 },
    ],
  },
  // Wave 7: mixed pressure
  {
    entries: [
      { kind: EnemyKind.Walker, count: 8, hpMultiplier: 2.0 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1.8 },
      { kind: EnemyKind.Sprinter, count: 6, hpMultiplier: 1.5 },
      { kind: EnemyKind.Wanderer, count: 4, hpMultiplier: 1.5 },
    ],
  },
  // Wave 8: healer appears
  {
    entries: [
      { kind: EnemyKind.Walker, count: 10, hpMultiplier: 2.2 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 2.0 },
      { kind: EnemyKind.Tank, count: 2, hpMultiplier: 1.5 },
      { kind: EnemyKind.Healer, count: 1, hpMultiplier: 1 },
      { kind: EnemyKind.Wanderer, count: 4, hpMultiplier: 1.8 },
    ],
  },
  // Wave 9: everything ramps
  {
    entries: [
      { kind: EnemyKind.Walker, count: 12, hpMultiplier: 2.5 },
      { kind: EnemyKind.Sneaker, count: 8, hpMultiplier: 2.2 },
      { kind: EnemyKind.Sprinter, count: 8, hpMultiplier: 2.0 },
      { kind: EnemyKind.Tank, count: 2, hpMultiplier: 2.0 },
      { kind: EnemyKind.Healer, count: 1, hpMultiplier: 1.5 },
      { kind: EnemyKind.Wanderer, count: 5, hpMultiplier: 2.0 },
    ],
  },
  // Wave 10: gauntlet
  {
    entries: [
      { kind: EnemyKind.Walker, count: 15, hpMultiplier: 3.0 },
      { kind: EnemyKind.Sneaker, count: 10, hpMultiplier: 2.8 },
      { kind: EnemyKind.Sprinter, count: 10, hpMultiplier: 2.5 },
      { kind: EnemyKind.Tank, count: 3, hpMultiplier: 2.5 },
      { kind: EnemyKind.Healer, count: 2, hpMultiplier: 2.0 },
      { kind: EnemyKind.Wanderer, count: 6, hpMultiplier: 2.5 },
    ],
  },
];

/** Generate an endless-mode wave for waveNum > 10 */
export function generateEndlessWave(waveNum: number): WaveDef {
  const n = waveNum - 10;
  const hpMult = 3.0 * Math.pow(1.12, n);
  const baseCount = 15 + Math.floor(n * 1.5);

  const entries: WaveEntry[] = [
    { kind: EnemyKind.Walker, count: baseCount, hpMultiplier: hpMult },
  ];

  if (n >= 1) entries.push({ kind: EnemyKind.Sneaker, count: Math.floor(baseCount * 0.6), hpMultiplier: hpMult * 0.9 });
  if (n >= 2) entries.push({ kind: EnemyKind.Wanderer, count: Math.floor(baseCount * 0.4), hpMultiplier: hpMult * 0.8 });
  if (n >= 2 && n % 2 === 0) entries.push({ kind: EnemyKind.Sprinter, count: Math.floor(baseCount * 0.5), hpMultiplier: hpMult * 0.5 });
  if (n >= 3 && n % 3 === 0) entries.push({ kind: EnemyKind.Tank, count: 1 + Math.floor(n / 5), hpMultiplier: hpMult });
  if (n >= 5 && n % 5 === 0) entries.push({ kind: EnemyKind.Healer, count: 1 + Math.floor(n / 10), hpMultiplier: hpMult * 0.7 });

  return { entries };
}
