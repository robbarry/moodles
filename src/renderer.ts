import {
  COLS, ROWS, TILE, SCALE, CANVAS_W, CANVAS_H,
  CellType, HUD_TOP_H, HUD_BOT_H,
  TowerKind, TOWER_DEFS, EnemyKind, ENEMY_DEFS, GamePhase, WALL_COST,
  BATTLE_COLS, BATTLE_SEND_COSTS, BATTLE_MAX_QUEUE, BATTLE_TIERS,
} from './types';
import {
  spawnSprite, goalSprite, wallSprite,
  TOWER_SPRITES, ENEMY_SPRITES,
} from './sprites';
import { type GameState, type UpgradeStat, upgradeCost, towerRange, towerFireRate, towerDamage, sellValue, getCoins, MAX_UPGRADE, effects, canPlaceAt, globalToLocal } from './game';

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
  mouseToButton(e: MouseEvent, count = 7): number {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return -1;
    for (let i = 0; i < count; i++) {
      const left = Math.floor(i * CANVAS_W / count);
      const right = Math.floor((i + 1) * CANVAS_W / count);
      if (x >= left && x < right) return i;
    }
    return -1;
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
  mouseToSellBtn(e: MouseEvent, isWall = false): boolean {
    const { x, y } = this.mouseToLogical(e);
    const barY = HUD_TOP_H + CANVAS_H;
    if (y < barY || y > barY + HUD_BOT_H) return false;
    if (isWall) {
      return x >= 10 && x < 90;
    }
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

    // Translate for grid area (with screen shake)
    ctx.save();
    const shake = effects.getShakeOffset();
    ctx.translate(shake.x, HUD_TOP_H + shake.y);

    // ── Grid background ──
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE;
        const y = r * TILE;

        // In battle mode, look up cells from the correct half-grid
        let cell: CellType | undefined;
        if (state.battleMode) {
          const { localCol, side } = globalToLocal(c);
          const grid = side === 'host' ? state.hostGrid : state.guestGrid;
          cell = grid?.getCell(localCol, r);
        } else {
          cell = state.grid.getCell(c, r);
        }

        // Background tile
        ctx.fillStyle = (c + r) % 2 === 0 ? '#2d2d44' : '#252540';
        ctx.fillRect(x, y, TILE, TILE);

        // Cell contents
        if (cell === CellType.Spawn) {
          ctx.drawImage(spawnSprite, x, y);
          ctx.globalAlpha = 0.15 + 0.1 * Math.sin(state.gameTime * 4);
          ctx.fillStyle = '#a5d6a7';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.globalAlpha = 1;
        } else if (cell === CellType.Goal) {
          ctx.drawImage(goalSprite, x, y);
          ctx.globalAlpha = 0.15 + 0.1 * Math.sin(state.gameTime * 4);
          ctx.fillStyle = '#ef9a9a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.globalAlpha = 1;
        } else if (cell === CellType.Wall) {
          ctx.drawImage(wallSprite, x, y);
        }
      }
    }

    // ── Battle mode: dividing line ──
    if (state.battleMode) {
      const seamX = BATTLE_COLS * TILE;
      ctx.strokeStyle = '#ff5722';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(seamX, 0);
      ctx.lineTo(seamX, ROWS * TILE);
      ctx.stroke();

      // Side labels
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px monospace';
      ctx.fillText('HOST', 4, 12);
      ctx.fillText('GUEST', seamX + 4, 12);
    }

    // ── Path overlay ──
    if (state.battleMode) {
      // Draw paths for both halves
      this.drawBattlePath(state, 'host');
      this.drawBattlePath(state, 'guest');
    } else if (state.cachedPath && state.cachedPath.length > 1) {
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
      if (sprite) {
        if (tower.recoilTimer > 0) {
          const s = 1 + 0.15 * (tower.recoilTimer / 0.08);
          ctx.save();
          ctx.translate(x + TILE / 2, y + TILE / 2);
          ctx.scale(s, s);
          ctx.drawImage(sprite, -TILE / 2, -TILE / 2);
          ctx.restore();
        } else {
          ctx.drawImage(sprite, x, y);
        }
      }

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
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      ctx.strokeStyle = 'rgba(124,77,255,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, towerRange(t) * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Selected wall highlight ──
    if (state.selectedWall) {
      const w = state.selectedWall;
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.col * TILE, w.row * TILE, TILE, TILE);
    }

    // ── Hover / selection preview ──
    if (state.hoverCol >= 0 && state.hoverRow >= 0 && state.selectedBuild !== null) {
      const x = state.hoverCol * TILE;
      const y = state.hoverRow * TILE;
      const canPlace = canPlaceAt(state, state.hoverCol, state.hoverRow);
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

    // ── Peer cursor ──
    if (state.peerCursorCol >= 0 && state.peerCursorRow >= 0) {
      const px = state.peerCursorCol * TILE;
      const py = state.peerCursorRow * TILE;
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      // Small "P2" label
      ctx.fillStyle = '#ffeb3b';
      ctx.font = '8px monospace';
      ctx.fillText('P2', px + 2, py - 2);
    }

    // ── Enemies ──
    for (const enemy of state.enemies) {
      const x = enemy.x - TILE / 2;
      const y = enemy.y - TILE / 2;
      const sprite = ENEMY_SPRITES[enemy.kind];
      if (sprite) ctx.drawImage(sprite, x, y);

      // Hit flash (white overlay)
      if (enemy.hitFlashTimer > 0) {
        ctx.globalAlpha = enemy.hitFlashTimer / 0.1;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.globalAlpha = 1;
      }

      // Slow tint (cyan overlay)
      if (enemy.slowTimer > 0) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#80deea';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.globalAlpha = 1;
      }

      // Health bar (clamped inside grid area)
      const pct = enemy.hp / enemy.maxHp;
      const barW = TILE - 4;
      const barY = Math.max(1, y - 5);
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 2, barY, barW, 3);
      ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillRect(x + 2, barY, barW * pct, 3);
    }

    // ── Projectile trails ──
    for (const proj of state.projectiles) {
      for (let i = 0; i < proj.trail.length; i++) {
        const t = proj.trail[i]!;
        ctx.globalAlpha = (i + 1) / (proj.trail.length + 1) * 0.4;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── Projectiles ──
    for (const proj of state.projectiles) {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Chain arcs ──
    for (const arc of effects.chainArcs) {
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = arc.life / 0.15;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      // Jagged lightning effect
      const mx = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 10;
      const my = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 10;
      ctx.lineTo(mx, my);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Particles ──
    for (const p of effects.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // ── Rings ──
    for (const r of effects.rings) {
      ctx.globalAlpha = r.life / r.maxLife * 0.6;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

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
    if (state.phase === GamePhase.Lost) {
      this.drawOverlay(state);
    } else if (state.waveCountdown > 0) {
      this.drawCountdown(state);
    }

    // ── Notifications ──
    for (let i = 0; i < state.notifications.length; i++) {
      const n = state.notifications[i]!;
      ctx.globalAlpha = Math.min(1, n.timer);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const ny = HUD_TOP_H + 40 + i * 30;
      ctx.fillRect(CANVAS_W / 2 - 120, ny, 240, 24);
      ctx.fillStyle = '#ffeb3b';
      ctx.font = 'bold 12px monospace';
      const nw = ctx.measureText(n.text).width;
      ctx.fillText(n.text, (CANVAS_W - nw) / 2, ny + 16);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // un-scale
  }

  private drawHud(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, CANVAS_W, HUD_TOP_H);

    if (state.battleMode) {
      this.drawBattleHud(state);
      return;
    }

    ctx.font = '11px monospace';
    ctx.fillStyle = Math.round(state.displayLives) < state.lives ? '#4caf50' : Math.round(state.displayLives) > state.lives ? '#f44336' : '#eee';
    ctx.fillText(`HP:${Math.round(state.displayLives)}`, 8, 26);
    ctx.fillStyle = Math.round(state.displayCoins) < state.coins ? '#4caf50' : Math.round(state.displayCoins) > state.coins ? '#f44336' : '#eee';
    ctx.fillText(`$${Math.round(state.displayCoins)}`, 60, 26);
    ctx.fillStyle = '#eee';
    ctx.fillText(`W${state.currentWave}`, 120, 26);
    ctx.fillText(`${state.score}pts`, 160, 26);

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

    // If a tower is selected, show upgrade UI
    if (state.selectedTower) {
      this.drawUpgradeBar(state, barY);
      return;
    }

    // If a wall is selected, show sell UI
    if (state.selectedWall) {
      this.drawWallSellBar(state, barY);
      return;
    }

    // Battle mode: offense bar
    if (state.battleMode && state.offenseMode) {
      this.drawOffenseBar(state, barY);
      return;
    }

    // Defense bar (normal or battle)
    const allTowerKinds: TowerKind[] = state.battleMode
      ? [TowerKind.PeaShooter, TowerKind.SlopCannon, TowerKind.Zapper, TowerKind.Frost, TowerKind.Chain]
      : [TowerKind.PeaShooter, TowerKind.SlopCannon, TowerKind.Zapper, TowerKind.Frost, TowerKind.Chain, TowerKind.CoinTree];
    const items: { label: string; cost: number; key: 'wall' | TowerKind }[] = [
      { label: 'Wall', cost: WALL_COST, key: 'wall' as const },
      ...allTowerKinds.map((k) => ({
        label: TOWER_DEFS[k].shortName,
        cost: TOWER_DEFS[k].cost,
        key: k,
      })),
    ];

    const count = items.length;
    for (let i = 0; i < count; i++) {
      const item = items[i]!;
      const x = Math.floor(i * CANVAS_W / count);
      const w = Math.floor((i + 1) * CANVAS_W / count) - x;
      const selected = state.selectedBuild === item.key;
      const affordable = state.coins >= item.cost;

      ctx.fillStyle = selected ? '#3949ab' : affordable ? '#283593' : '#1a237e';
      ctx.fillRect(x + 1, barY + 4, w - 2, HUD_BOT_H - 8);

      ctx.fillStyle = affordable ? '#eee' : '#666';
      ctx.font = '11px monospace';
      ctx.fillText(item.label, x + 6, barY + 20);
      ctx.font = '10px monospace';
      ctx.fillText(`$${item.cost}`, x + 6, barY + 34);

      if (selected) {
        ctx.strokeStyle = '#7c4dff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, barY + 4, w - 2, HUD_BOT_H - 8);
      }
    }

    // Tab hint for battle mode
    if (state.battleMode) {
      ctx.fillStyle = '#666';
      ctx.font = '9px monospace';
      ctx.fillText('[Tab] Offense', CANVAS_W - 90, barY + 42);
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
      const affordable = getCoins(state, tower.owner) >= cost;

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

  private drawWallSellBar(_state: GameState, barY: number): void {
    const ctx = this.ctx;
    const sv = Math.floor(WALL_COST * 0.6);
    // Sell button
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(10, barY + 4, 80, HUD_BOT_H - 8);
    ctx.fillStyle = '#ffcdd2';
    ctx.font = '11px monospace';
    ctx.fillText('Sell Wall', 18, barY + 18);
    ctx.font = '10px monospace';
    ctx.fillText(`+$${sv}`, 18, barY + 32);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.fillText('Wall  (click to sell, ESC to deselect)', 100, barY + 26);
  }

  private drawOverlay(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, TOTAL_H);

    const cy = TOTAL_H / 2;

    if (state.battleMode) {
      // Battle mode: show winner/loser
      const hostWon = state.guestLives <= 0;
      ctx.fillStyle = '#ffeb3b';
      ctx.font = 'bold 28px monospace';
      const text = hostWon ? 'HOST WINS!' : 'GUEST WINS!';
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, (CANVAS_W - tw) / 2, cy - 30);

      ctx.fillStyle = '#eee';
      ctx.font = '14px monospace';
      const clock = formatClock(state.matchClock);
      const detail = `Match time: ${clock}`;
      const dw = ctx.measureText(detail).width;
      ctx.fillText(detail, (CANVAS_W - dw) / 2, cy - 4);
    } else {
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 32px monospace';
      const text = 'GAME OVER';
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, (CANVAS_W - tw) / 2, cy - 40);

      ctx.fillStyle = '#eee';
      ctx.font = '14px monospace';
      const waveTxt = `Wave ${state.currentWave}  Score: ${state.score}`;
      const ww = ctx.measureText(waveTxt).width;
      ctx.fillText(waveTxt, (CANVAS_W - ww) / 2, cy - 12);

      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      const hiTxt = `High Score: ${state.highScore}`;
      const hw = ctx.measureText(hiTxt).width;
      ctx.fillText(hiTxt, (CANVAS_W - hw) / 2, cy + 6);
    }

    // Restart button
    const btnW = 140;
    const btnH = 32;
    const btnX = (CANVAS_W - btnW) / 2;
    const btnY = cy + 22;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    const btnTxt = 'Play Again';
    const btw = ctx.measureText(btnTxt).width;
    ctx.fillText(btnTxt, (CANVAS_W - btw) / 2, btnY + 21);
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

  // ── Battle mode rendering helpers ──

  private drawBattleHud(state: GameState): void {
    const ctx = this.ctx;
    const isHost = state.viewSide === 'host';
    const myLives = isHost ? state.hostLives : state.guestLives;
    const oppLives = isHost ? state.guestLives : state.hostLives;
    const myOffense = isHost ? state.hostOffense : state.guestOffense;
    const myQueue = isHost ? state.hostSendQueue : state.guestSendQueue;

    ctx.font = '11px monospace';

    // Left: player's lives + coins
    ctx.fillStyle = '#eee';
    ctx.fillText(`HP:${myLives}`, 8, 26);
    ctx.fillStyle = Math.round(state.displayCoins) < state.coins ? '#4caf50' : Math.round(state.displayCoins) > state.coins ? '#f44336' : '#eee';
    ctx.fillText(`$${Math.round(state.displayCoins)}`, 60, 26);

    // Offense meter
    const meterX = 130;
    const meterW = 120;
    ctx.fillStyle = '#333';
    ctx.fillRect(meterX, 14, meterW, 12);
    const fillPct = Math.min(1, myOffense / 50);
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(meterX, 14, meterW * fillPct, 12);
    ctx.fillStyle = '#eee';
    ctx.font = '9px monospace';
    ctx.fillText(`ATK:${Math.floor(myOffense)}`, meterX + 4, 24);
    ctx.fillText(`+${state.offenseDrip.toFixed(1)}/s`, meterX + meterW + 4, 24);

    // Center: match clock + next unlock
    const clock = formatClock(state.matchClock);
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 12px monospace';
    const cw = ctx.measureText(clock).width;
    ctx.fillText(clock, (CANVAS_W - cw) / 2, 18);

    // Next tier unlock hint
    let nextUnlock = '';
    for (const [time, kinds] of BATTLE_TIERS) {
      if (state.matchClock < time) {
        const remaining = Math.ceil(time - state.matchClock);
        const names = kinds.map(k => ENEMY_DEFS[k].name).join(', ');
        nextUnlock = `${names} in ${formatClock(remaining)}`;
        break;
      }
    }
    if (nextUnlock) {
      ctx.fillStyle = '#aaa';
      ctx.font = '9px monospace';
      const nw = ctx.measureText(nextUnlock).width;
      ctx.fillText(nextUnlock, (CANVAS_W - nw) / 2, 32);
    }

    // Right: opponent lives + send queue
    ctx.fillStyle = '#ef5350';
    ctx.font = '11px monospace';
    ctx.fillText(`Opp HP:${oppLives}`, CANVAS_W - 120, 26);

    // Send queue indicator
    const queueSize = myQueue.length;
    for (let i = 0; i < BATTLE_MAX_QUEUE; i++) {
      const qx = CANVAS_W - 160 + i * 12;
      ctx.fillStyle = i < queueSize ? '#ff9800' : '#333';
      ctx.fillRect(qx, 14, 10, 10);
    }

    // Music toggle (compact)
    const mX = CANVAS_W - 24;
    ctx.fillStyle = state.musicOn ? '#283593' : '#1a237e';
    ctx.fillRect(mX, 10, 18, 18);
    ctx.fillStyle = state.musicOn ? '#eee' : '#666';
    ctx.font = '10px monospace';
    ctx.fillText('M', mX + 3, 22);
  }

  private drawOffenseBar(state: GameState, barY: number): void {
    const ctx = this.ctx;
    const sendableKinds: EnemyKind[] = [EnemyKind.Walker, EnemyKind.Sprinter, EnemyKind.Sneaker, EnemyKind.Tank, EnemyKind.Healer];
    const count = sendableKinds.length;
    const isHost = state.viewSide === 'host';
    const offense = isHost ? state.hostOffense : state.guestOffense;

    for (let i = 0; i < count; i++) {
      const kind = sendableKinds[i]!;
      const def = ENEMY_DEFS[kind];
      const cost = BATTLE_SEND_COSTS[kind] ?? 0;
      const unlocked = state.unlockedTiers.includes(kind);
      const affordable = offense >= cost;
      const myQueue = isHost ? state.hostSendQueue : state.guestSendQueue;
      const queueFull = myQueue.length >= BATTLE_MAX_QUEUE;

      const x = Math.floor(i * CANVAS_W / count);
      const w = Math.floor((i + 1) * CANVAS_W / count) - x;

      const canSend = unlocked && affordable && !queueFull;
      ctx.fillStyle = !unlocked ? '#111' : canSend ? '#4a1a00' : '#2a1000';
      ctx.fillRect(x + 1, barY + 4, w - 2, HUD_BOT_H - 8);

      // Enemy name
      ctx.fillStyle = unlocked ? (canSend ? '#ff9800' : '#888') : '#444';
      ctx.font = '11px monospace';
      ctx.fillText(def.name, x + 6, barY + 20);

      // Cost or lock time
      ctx.font = '10px monospace';
      if (unlocked) {
        ctx.fillText(`${cost}pts`, x + 6, barY + 34);
      } else {
        // Find unlock time
        for (const [time, kinds] of BATTLE_TIERS) {
          if (kinds.includes(kind)) {
            ctx.fillText(`@${formatClock(time)}`, x + 6, barY + 34);
            break;
          }
        }
      }

      // Sprite preview
      const sprite = ENEMY_SPRITES[kind];
      if (sprite) {
        ctx.globalAlpha = unlocked ? 0.8 : 0.3;
        ctx.drawImage(sprite, x + w - 36, barY + 8, 28, 28);
        ctx.globalAlpha = 1;
      }
    }

    // Tab hint
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.fillText('[Tab] Defense', CANVAS_W - 90, barY + 42);
  }

  /** Draw path overlay for one side of the battle board */
  private drawBattlePath(state: GameState, side: 'host' | 'guest'): void {
    const ctx = this.ctx;
    const path = side === 'host' ? state.hostCachedPath : state.guestCachedPath;
    const locked = side === 'host' ? state.hostLockedCells : state.guestLockedCells;
    const grid = side === 'host' ? state.hostGrid : state.guestGrid;
    if (!path || !grid || path.length <= 1) return;

    for (const p of path) {
      const cell = grid.getCell(p.col, p.row);
      if (cell === CellType.Spawn || cell === CellType.Goal) continue;
      const isLocked = locked.has(`${p.col},${p.row}`);
      // Convert local col to global for rendering
      const globalCol = side === 'host' ? p.col : p.col + BATTLE_COLS;
      ctx.globalAlpha = isLocked ? 0.25 : 0.15;
      ctx.fillStyle = isLocked ? '#f44336' : '#ffeb3b';
      ctx.fillRect(globalCol * TILE + 4, p.row * TILE + 4, TILE - 8, TILE - 8);
    }
    ctx.globalAlpha = 1;
  }
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
