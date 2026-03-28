import {
  COLS, ROWS, TILE, SCALE, CANVAS_W, CANVAS_H,
  CellType, HUD_TOP_H, HUD_BOT_H,
  TowerKind, TOWER_DEFS, GamePhase, WALL_COST,
} from './types';
import {
  spawnSprite, goalSprite, wallSprite,
  TOWER_SPRITES, ENEMY_SPRITES,
} from './sprites';
import { type GameState, type UpgradeStat, upgradeCost, towerRange, towerFireRate, towerDamage, sellValue, MAX_UPGRADE } from './game';

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

  /** Check if mouse clicks an upgrade button when a tower is selected */
  mouseToUpgradeBtn(e: MouseEvent): UpgradeStat | null {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return null;
    const btnW = 90;
    const gap = 6;
    if (x >= gap && x < gap + btnW) return 'range';
    if (x >= gap * 2 + btnW && x < gap * 2 + btnW * 2) return 'speed';
    if (x >= gap * 3 + btnW * 2 && x < gap * 3 + btnW * 3) return 'damage';
    return null;
  }

  /** Check if mouse clicks the sell button */
  mouseToSellBtn(e: MouseEvent): boolean {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return false;
    const btnW = 90;
    const gap = 6;
    const sellX = gap * 4 + btnW * 3;
    return x >= sellX && x < sellX + 70;
  }

  /** Check if mouse clicks the music toggle */
  mouseToMusicBtn(e: MouseEvent): boolean {
    const { x, y } = this.mouseToLogical(e);
    return x >= CANVAS_W - 310 && x <= CANVAS_W - 285 && y >= 10 && y <= 32;
  }

  /** Check if mouse clicks a speed button. Returns the speed (1,2,3) or 0 */
  mouseToSpeedBtn(e: MouseEvent): number {
    const { x, y } = this.mouseToLogical(e);
    if (y < 8 || y > 34) return 0;
    // Speed buttons: 1x, 2x, 3x — positioned left of auto checkbox
    const startX = CANVAS_W - 280;
    const btnW = 24;
    const gap = 4;
    for (let i = 0; i < 3; i++) {
      const bx = startX + i * (btnW + gap);
      if (x >= bx && x < bx + btnW) return i + 1;
    }
    return 0;
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

    // ── Path overlay ──
    if (state.cachedPath && state.cachedPath.length > 1) {
      for (const p of state.cachedPath) {
        const cell = state.grid.getCell(p.col, p.row);
        if (cell === CellType.Spawn || cell === CellType.Goal) continue;
        const locked = state.lockedPathCells.has(`${p.col},${p.row}`);
        ctx.globalAlpha = locked ? 0.25 : 0.15;
        ctx.fillStyle = locked ? '#f44336' : '#ffeb3b';
        ctx.fillRect(p.col * TILE + 4, p.row * TILE + 4, TILE - 8, TILE - 8);
      }
      ctx.globalAlpha = 1;
    }

    // ── Towers ──
    for (const tower of state.towers) {
      const x = tower.col * TILE;
      const y = tower.row * TILE;
      const sprite = TOWER_SPRITES[tower.kind];
      if (sprite) ctx.drawImage(sprite, x, y);

      // Upgrade pips
      const totalLevels = tower.rangeLevel + tower.speedLevel + tower.damageLevel;
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

    // Music toggle
    const mX = CANVAS_W - 308;
    ctx.fillStyle = state.musicOn ? '#283593' : '#1a237e';
    ctx.fillRect(mX, 10, 22, 20);
    ctx.fillStyle = state.musicOn ? '#eee' : '#666';
    ctx.font = '12px monospace';
    ctx.fillText(state.musicOn ? 'M' : 'M', mX + 5, 24);
    if (!state.musicOn) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mX + 2, 28);
      ctx.lineTo(mX + 20, 12);
      ctx.stroke();
    }

    // Speed buttons
    const speedStartX = CANVAS_W - 280;
    const speedBtnW = 24;
    const speedGap = 4;
    for (let i = 0; i < 3; i++) {
      const bx = speedStartX + i * (speedBtnW + speedGap);
      const spd = i + 1;
      ctx.fillStyle = state.gameSpeed === spd ? '#4caf50' : '#283593';
      ctx.fillRect(bx, 10, speedBtnW, 20);
      ctx.fillStyle = state.gameSpeed === spd ? '#fff' : '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(`${spd}x`, bx + 4, 24);
    }

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
      { label: 'Wall', cost: WALL_COST, key: 'wall' as const },
      { label: 'Pea', cost: TOWER_DEFS[TowerKind.PeaShooter].cost, key: TowerKind.PeaShooter },
      { label: 'Slop', cost: TOWER_DEFS[TowerKind.SlopCannon].cost, key: TowerKind.SlopCannon },
      { label: 'Zap', cost: TOWER_DEFS[TowerKind.Zapper].cost, key: TowerKind.Zapper },
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
    const btnW = 90;
    const gap = 6;

    const stats: { label: string; stat: UpgradeStat; level: number; pipColor: string }[] = [
      { label: 'Range', stat: 'range', level: tower.rangeLevel, pipColor: '#4caf50' },
      { label: 'Speed', stat: 'speed', level: tower.speedLevel, pipColor: '#2196f3' },
      { label: 'Damage', stat: 'damage', level: tower.damageLevel, pipColor: '#f44336' },
    ];

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!;
      const x = gap + i * (btnW + gap);
      const cost = upgradeCost(tower, s.stat);
      const maxed = s.level >= MAX_UPGRADE;
      const affordable = state.coins >= cost;

      ctx.fillStyle = maxed ? '#1b5e20' : affordable ? '#283593' : '#1a237e';
      ctx.fillRect(x, barY + 4, btnW, HUD_BOT_H - 8);
      ctx.fillStyle = maxed ? '#81c784' : affordable ? '#eee' : '#666';
      ctx.font = '11px monospace';
      ctx.fillText(maxed ? `${s.label} MAX` : `${s.label} +`, x + 6, barY + 18);
      ctx.font = '10px monospace';
      if (!maxed) ctx.fillText(`$${cost}`, x + 6, barY + 32);
      // Level pips
      for (let j = 0; j < MAX_UPGRADE; j++) {
        ctx.fillStyle = j < s.level ? s.pipColor : '#555';
        ctx.fillRect(x + btnW - 30 + j * 10, barY + 8, 7, 7);
      }
    }

    // Sell button
    const sellX = gap * 4 + btnW * 3;
    const sv = sellValue(tower);
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(sellX, barY + 4, 70, HUD_BOT_H - 8);
    ctx.fillStyle = '#ffcdd2';
    ctx.font = '11px monospace';
    ctx.fillText('Sell', sellX + 6, barY + 18);
    ctx.font = '10px monospace';
    ctx.fillText(`+$${sv}`, sellX + 6, barY + 32);

    // Tower info
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    const range = towerRange(tower).toFixed(1);
    const rate = towerFireRate(tower).toFixed(2);
    const dmg = towerDamage(tower);
    ctx.fillText(`${def.name}  rng:${range}  spd:${rate}s  dmg:${dmg}`, sellX + 80, barY + 26);
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
