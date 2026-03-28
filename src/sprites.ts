import { TILE } from './types';

/**
 * Pre-rendered sprite canvases for pixel art.
 * Each sprite is drawn once into an offscreen canvas and reused.
 */

function createSprite(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
}

// ── Terrain ──

export const spawnSprite = createSprite((ctx) => {
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, TILE, TILE);
  // Arrow pointing right/down
  ctx.fillStyle = '#a5d6a7';
  ctx.fillRect(10, 8, 14, 4);
  ctx.fillRect(10, 20, 14, 4);
  ctx.fillRect(18, 8, 4, 16);
});

export const goalSprite = createSprite((ctx) => {
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, 0, TILE, TILE);
  // X marks the spot
  ctx.fillStyle = '#ffcdd2';
  for (let i = 0; i < TILE; i += 2) {
    ctx.fillRect(i, i, 3, 3);
    ctx.fillRect(TILE - i - 3, i, 3, 3);
  }
});

export const wallSprite = createSprite((ctx) => {
  ctx.fillStyle = '#795548';
  ctx.fillRect(0, 0, TILE, TILE);
  // Brick pattern
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(1, 1, 14, 6);
  ctx.fillRect(17, 1, 14, 6);
  ctx.fillRect(8, 9, 14, 6);
  ctx.fillRect(1, 17, 14, 6);
  ctx.fillRect(17, 17, 14, 6);
  ctx.fillRect(8, 25, 14, 6);
});

// ── Towers ──

export const peaShooterSprite = createSprite((ctx) => {
  // Base
  ctx.fillStyle = '#388e3c';
  ctx.fillRect(4, 16, 24, 14);
  // Turret
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(10, 4, 12, 16);
  // Barrel
  ctx.fillStyle = '#66bb6a';
  ctx.fillRect(13, 0, 6, 8);
  // Eye
  ctx.fillStyle = '#fff';
  ctx.fillRect(14, 8, 4, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(16, 9, 2, 2);
});

export const slopCannonSprite = createSprite((ctx) => {
  // Base
  ctx.fillStyle = '#e65100';
  ctx.fillRect(2, 18, 28, 12);
  // Body
  ctx.fillStyle = '#ff9800';
  ctx.fillRect(6, 6, 20, 16);
  // Cannon mouth
  ctx.fillStyle = '#424242';
  ctx.fillRect(10, 2, 12, 8);
  ctx.fillStyle = '#757575';
  ctx.fillRect(12, 0, 8, 4);
  // Drip
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(14, 8, 2, 4);
  ctx.fillRect(18, 10, 2, 2);
});

export const zapperSprite = createSprite((ctx) => {
  // Base
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(4, 20, 24, 10);
  // Antenna tower
  ctx.fillStyle = '#2196f3';
  ctx.fillRect(12, 4, 8, 20);
  // Lightning bolt tip
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(14, 0, 4, 6);
  ctx.fillRect(12, 4, 4, 4);
  ctx.fillRect(16, 6, 4, 4);
  // Spark
  ctx.fillStyle = '#fff';
  ctx.fillRect(15, 1, 2, 2);
});

// ── Enemies ──

export const walkerSprite = createSprite((ctx) => {
  // Body (round blob)
  ctx.fillStyle = '#e53935';
  ctx.fillRect(6, 8, 20, 18);
  ctx.fillRect(8, 6, 16, 22);
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, 12, 5, 5);
  ctx.fillRect(18, 12, 5, 5);
  ctx.fillStyle = '#000';
  ctx.fillRect(12, 14, 2, 2);
  ctx.fillRect(20, 14, 2, 2);
  // Angry mouth
  ctx.fillStyle = '#000';
  ctx.fillRect(12, 22, 8, 2);
  // Feet
  ctx.fillStyle = '#b71c1c';
  ctx.fillRect(8, 28, 6, 4);
  ctx.fillRect(18, 28, 6, 4);
});

export const flyerSprite = createSprite((ctx) => {
  // Body
  ctx.fillStyle = '#ab47bc';
  ctx.fillRect(10, 12, 12, 12);
  // Wings
  ctx.fillStyle = '#ce93d8';
  ctx.fillRect(0, 10, 12, 6);
  ctx.fillRect(20, 10, 12, 6);
  ctx.fillRect(2, 8, 8, 4);
  ctx.fillRect(22, 8, 8, 4);
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(12, 14, 3, 3);
  ctx.fillRect(18, 14, 3, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(13, 15, 1, 1);
  ctx.fillRect(19, 15, 1, 1);
  // Beak
  ctx.fillStyle = '#fdd835';
  ctx.fillRect(14, 20, 4, 3);
});

export const sneakerSprite = createSprite((ctx) => {
  // Body (sleek, lower profile than walker)
  ctx.fillStyle = '#00bcd4';
  ctx.fillRect(8, 10, 16, 16);
  ctx.fillRect(6, 12, 20, 12);
  // Sneaky eyes (narrowed)
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, 14, 5, 3);
  ctx.fillRect(18, 14, 5, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(12, 15, 2, 1);
  ctx.fillRect(20, 15, 2, 1);
  // Smirk
  ctx.fillStyle = '#000';
  ctx.fillRect(13, 22, 2, 1);
  ctx.fillRect(15, 23, 4, 1);
  ctx.fillRect(19, 22, 2, 1);
  // Sneakers (shoes!)
  ctx.fillStyle = '#e0f7fa';
  ctx.fillRect(7, 26, 8, 4);
  ctx.fillRect(17, 26, 8, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(9, 27, 2, 2);
  ctx.fillRect(19, 27, 2, 2);
});

export const wandererSprite = createSprite((ctx) => {
  // Body (big, round, chaotic looking)
  ctx.fillStyle = '#ff5722';
  ctx.fillRect(4, 6, 24, 22);
  ctx.fillRect(6, 4, 20, 26);
  // Dizzy spiral eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(8, 10, 7, 7);
  ctx.fillRect(18, 10, 7, 7);
  ctx.fillStyle = '#000';
  ctx.fillRect(10, 12, 3, 3);
  ctx.fillRect(20, 12, 3, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(11, 13, 1, 1);
  ctx.fillRect(21, 13, 1, 1);
  // Wobbly mouth
  ctx.fillStyle = '#000';
  ctx.fillRect(11, 22, 3, 2);
  ctx.fillRect(14, 23, 4, 2);
  ctx.fillRect(18, 22, 3, 2);
  // Stubby legs
  ctx.fillStyle = '#bf360c';
  ctx.fillRect(8, 28, 6, 4);
  ctx.fillRect(18, 28, 6, 4);
});

/** Map tower/enemy kinds to their sprites */
export const TOWER_SPRITES = [peaShooterSprite, slopCannonSprite, zapperSprite];
export const ENEMY_SPRITES = [walkerSprite, flyerSprite, sneakerSprite, wandererSprite];
