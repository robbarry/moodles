import {
  COLS, ROWS, TILE, SCALE, CANVAS_W, CANVAS_H,
  CellType, HUD_TOP_H, HUD_BOT_H,
  TowerKind, TOWER_DEFS, GamePhase,
} from './types';
import {
  spawnSprite, goalSprite, wallSprite,
  TOWER_SPRITES, ENEMY_SPRITES,
} from './sprites';
import { type GameState, upgradeCost, towerRange, towerFireRate, MAX_UPGRADE } from './game';

const TOTAL_H = CANVAS_H + HUD_TOP_H + HUD_BOT_H;

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    canvas.width = CANVAS_W * SCALE;
    canvas.height = TOTAL_H * SCALE;
    // Let CSS handle display sizing (max-width/max-height in HTML)
    // Don't set explicit style dimensions so the canvas can shrink to fit

    this.ctx.imageSmoothingEnabled = false;
  }

  /** Actual display-to-logical scale (accounts for CSS shrinking) */
  private displayScale(): number {
    return this.canvas.getBoundingClientRect().width / (CANVAS_W * SCALE);
  }

  /** Convert mouse event to logical coordinates */
  private mouseToLogical(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const ds = this.displayScale();
    return {
      x: (e.clientX - rect.left) / (SCALE * ds),
      y: (e.clientY - rect.top) / (SCALE * ds),
    };
  }

  /** Convert mouse event to logical grid coordinates */
  mouseToGrid(e: MouseEvent): { col: number; row: number; inGrid: boolean } {
    const { x, y: rawY } = this.mouseToLogical(e);
    const y = rawY - HUD_TOP_H;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    const inGrid = col >= 0 && col < COLS && row >= 0 && row < ROWS && y >= 0;
    return { col, row, inGrid };
  }

  /** Check if mouse is clicking a build-bar button, return index or -1 */
  mouseToButton(e: MouseEvent): number {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return -1;
    const btnW = 80;
    const idx = Math.floor(x / btnW);
    return idx >= 0 && idx < 4 ? idx : -1;
  }

  /** Check if mouse clicks the Start Wave button */
  mouseToStartBtn(e: MouseEvent): boolean {
    const { x, y } = this.mouseToLogical(e);
    // Start button is in the top bar, right side
    return x >= CANVAS_W - 90 && x <= CANVAS_W - 10 && y >= 8 && y <= 34;
  }

  /** Check if mouse clicks an upgrade button when a tower is selected. Returns 'range' | 'speed' | null */
  mouseToUpgradeBtn(e: MouseEvent): 'range' | 'speed' | null {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return null;
    const btnW = 120;
    if (x >= 10 && x < 10 + btnW) return 'range';
    if (x >= 20 + btnW && x < 20 + btnW * 2) return 'speed';
    return null;
  }

  /** Check if mouse clicks the auto-start checkbox */
  mouseToAutoStart(e: MouseEvent): boolean {
    const { x, y } = this.mouseToLogical(e);
    return x >= CANVAS_W - 180 && x <= CANVAS_W - 95 && y >= 8 && y <= 34;
  }

  draw(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(SCALE, SCALE);

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_W, TOTAL_H);

    // ── Top HUD ──
    this.drawHud(state);

    // Translate for grid area
    ctx.save();
    ctx.translate(0, HUD_TOP_H);

    // ── Grid background ──
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = state.grid.getCell(c, r);

        // Background tile
        ctx.fillStyle = (c + r) % 2 === 0 ? '#2d2d44' : '#252540';
        ctx.fillRect(x, y, TILE, TILE);

        // Cell contents
        if (cell === CellType.Spawn) {
          ctx.drawImage(spawnSprite, x, y);
        } else if (cell === CellType.Goal) {
          ctx.drawImage(goalSprite, x, y);
        } else if (cell === CellType.Wall) {
          ctx.drawImage(wallSprite, x, y);
        }
      }
    }

    // ── Walls with HP bars ──
    for (const wall of state.walls) {
      const x = wall.col * TILE;
      const y = wall.row * TILE;
      if (wall.hp < wall.maxHp) {
        const pct = wall.hp / wall.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 2, y - 4, TILE - 4, 3);
        ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(x + 2, y - 4, (TILE - 4) * pct, 3);
      }
    }

    // ── Towers ──
    for (const tower of state.towers) {
      const x = tower.col * TILE;
      const y = tower.row * TILE;
      const sprite = TOWER_SPRITES[tower.kind];
      if (sprite) ctx.drawImage(sprite, x, y);

      // Upgrade pips
      const totalLevels = tower.rangeLevel + tower.speedLevel;
      if (totalLevels > 0) {
        for (let i = 0; i < totalLevels; i++) {
          ctx.fillStyle = '#ffeb3b';
          ctx.fillRect(x + 2 + i * 4, y + TILE - 4, 3, 3);
        }
      }
    }

    // ── Selected tower highlight ──
    if (state.selectedTower) {
      const t = state.selectedTower;
      const x = t.col * TILE;
      const y = t.row * TILE;
      ctx.strokeStyle = '#7c4dff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, TILE, TILE);
      // Range circle
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      ctx.strokeStyle = 'rgba(124,77,255,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, towerRange(t) * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Hover / selection preview ──
    if (state.hoverCol >= 0 && state.hoverRow >= 0 && state.selectedBuild !== null) {
      const x = state.hoverCol * TILE;
      const y = state.hoverRow * TILE;
      const canPlace = state.grid.canPlace(state.hoverCol, state.hoverRow);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = canPlace ? '#4caf50' : '#f44336';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.globalAlpha = 1;

      // Range preview for towers
      if (state.selectedBuild !== 'wall' && canPlace) {
        const def = TOWER_DEFS[state.selectedBuild];
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, def.range * TILE, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── Enemies ──
    for (const enemy of state.enemies) {
      const x = enemy.x - TILE / 2;
      const y = enemy.y - TILE / 2;
      const sprite = ENEMY_SPRITES[enemy.kind];
      if (sprite) ctx.drawImage(sprite, x, y);

      // Health bar
      const pct = enemy.hp / enemy.maxHp;
      const barW = TILE - 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 2, y - 5, barW, 3);
      ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillRect(x + 2, y - 5, barW * pct, 3);
    }

    // ── Projectiles ──
    for (const proj of state.projectiles) {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Floating damage numbers ──
    for (const dmg of state.floatingDamage) {
      ctx.globalAlpha = Math.max(0, 1 - dmg.age / dmg.lifetime);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`-${dmg.amount}`, dmg.x, dmg.y - dmg.age * 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // un-translate grid

    // ── Bottom build bar ──
    this.drawBuildBar(state);

    // ── Overlays ──
    if (state.phase === GamePhase.Won || state.phase === GamePhase.Lost) {
      this.drawOverlay(state);
    } else if (state.waveCountdown > 0) {
      this.drawCountdown(state);
    }

    ctx.restore(); // un-scale
  }

  private drawHud(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, CANVAS_W, HUD_TOP_H);

    ctx.fillStyle = '#eee';
    ctx.font = '14px monospace';
    ctx.fillText(`Lives: ${state.lives}`, 12, 26);
    ctx.fillText(`Coins: ${state.coins}`, 120, 26);
    ctx.fillText(`Wave: ${state.currentWave}/${state.totalWaves}`, 240, 26);

    // Auto-start checkbox
    const cbX = CANVAS_W - 178;
    const cbY = 14;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX, cbY, 12, 12);
    if (state.autoStart) {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(cbX + 2, cbY + 2, 8, 8);
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.fillText('Auto', cbX + 16, cbY + 10);

    // Start wave button
    if (state.phase === GamePhase.Build) {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(CANVAS_W - 90, 8, 80, 26);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText('Start', CANVAS_W - 72, 26);
    }
  }

  private drawBuildBar(state: GameState): void {
    const ctx = this.ctx;
    const barY = HUD_TOP_H + CANVAS_H;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, barY, CANVAS_W, HUD_BOT_H);

    // If a tower is selected, show upgrade UI instead
    if (state.selectedTower) {
      this.drawUpgradeBar(state, barY);
      return;
    }

    const items: { label: string; cost: number; key: 'wall' | TowerKind }[] = [
      { label: 'Wall', cost: 5, key: 'wall' },
      { label: 'Pea', cost: 15, key: TowerKind.PeaShooter },
      { label: 'Slop', cost: 30, key: TowerKind.SlopCannon },
      { label: 'Zap', cost: 40, key: TowerKind.Zapper },
    ];

    const btnW = 80;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const x = i * btnW;
      const selected = state.selectedBuild === item.key;
      const affordable = state.coins >= item.cost;

      ctx.fillStyle = selected ? '#3949ab' : affordable ? '#283593' : '#1a237e';
      ctx.fillRect(x + 2, barY + 4, btnW - 4, HUD_BOT_H - 8);

      ctx.fillStyle = affordable ? '#eee' : '#666';
      ctx.font = '11px monospace';
      ctx.fillText(item.label, x + 8, barY + 20);
      ctx.font = '10px monospace';
      ctx.fillText(`$${item.cost}`, x + 8, barY + 34);

      if (selected) {
        ctx.strokeStyle = '#7c4dff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, barY + 4, btnW - 4, HUD_BOT_H - 8);
      }
    }
  }

  private drawUpgradeBar(state: GameState, barY: number): void {
    const ctx = this.ctx;
    const tower = state.selectedTower!;
    const def = TOWER_DEFS[tower.kind];
    const btnW = 120;

    // Tower name
    ctx.fillStyle = '#eee';
    ctx.font = '11px monospace';

    // Range upgrade button
    const rangeCost = upgradeCost(tower, 'range');
    const rangeMaxed = tower.rangeLevel >= MAX_UPGRADE;
    const rangeAffordable = state.coins >= rangeCost;
    ctx.fillStyle = rangeMaxed ? '#1b5e20' : rangeAffordable ? '#283593' : '#1a237e';
    ctx.fillRect(10, barY + 4, btnW, HUD_BOT_H - 8);
    ctx.fillStyle = rangeMaxed ? '#81c784' : rangeAffordable ? '#eee' : '#666';
    ctx.font = '11px monospace';
    ctx.fillText(rangeMaxed ? 'Range MAX' : 'Range +', 18, barY + 18);
    ctx.font = '10px monospace';
    if (!rangeMaxed) ctx.fillText(`$${rangeCost}`, 18, barY + 32);
    // Level pips
    for (let i = 0; i < MAX_UPGRADE; i++) {
      ctx.fillStyle = i < tower.rangeLevel ? '#4caf50' : '#555';
      ctx.fillRect(90 + i * 10, barY + 10, 7, 7);
    }

    // Speed upgrade button
    const speedCost = upgradeCost(tower, 'speed');
    const speedMaxed = tower.speedLevel >= MAX_UPGRADE;
    const speedAffordable = state.coins >= speedCost;
    ctx.fillStyle = speedMaxed ? '#1b5e20' : speedAffordable ? '#283593' : '#1a237e';
    ctx.fillRect(20 + btnW, barY + 4, btnW, HUD_BOT_H - 8);
    ctx.fillStyle = speedMaxed ? '#81c784' : speedAffordable ? '#eee' : '#666';
    ctx.font = '11px monospace';
    ctx.fillText(speedMaxed ? 'Speed MAX' : 'Speed +', 28 + btnW, barY + 18);
    ctx.font = '10px monospace';
    if (!speedMaxed) ctx.fillText(`$${speedCost}`, 28 + btnW, barY + 32);
    for (let i = 0; i < MAX_UPGRADE; i++) {
      ctx.fillStyle = i < tower.speedLevel ? '#2196f3' : '#555';
      ctx.fillRect(100 + btnW + i * 10, barY + 10, 7, 7);
    }

    // Tower info
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    const range = towerRange(tower).toFixed(1);
    const rate = towerFireRate(tower).toFixed(2);
    ctx.fillText(`${def.name}  rng:${range}  spd:${rate}s  dmg:${def.damage}`, 270, barY + 26);
  }

  private drawOverlay(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, TOTAL_H);

    ctx.fillStyle = state.phase === GamePhase.Won ? '#4caf50' : '#f44336';
    ctx.font = 'bold 32px monospace';
    const text = state.phase === GamePhase.Won ? 'YOU WIN!' : 'GAME OVER';
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (CANVAS_W - tw) / 2, TOTAL_H / 2 - 10);

    ctx.fillStyle = '#eee';
    ctx.font = '14px monospace';
    const sub = 'Click to restart';
    const sw = ctx.measureText(sub).width;
    ctx.fillText(sub, (CANVAS_W - sw) / 2, TOTAL_H / 2 + 20);
  }

  private drawCountdown(state: GameState): void {
    const ctx = this.ctx;
    const cy = HUD_TOP_H + CANVAS_H / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(CANVAS_W / 2 - 100, cy - 30, 200, 50);

    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 20px monospace';
    const text = `Wave ${state.currentWave} in ${Math.ceil(state.waveCountdown)}`;
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (CANVAS_W - tw) / 2, cy + 5);
  }
}
