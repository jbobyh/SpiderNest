// ============================================================
// ROOM BONUS VFX — ambient floating emoji particles in bonus rooms
//
// initRoomBonusVfx(layer)   — create container on given layer
// updateRoomBonusVfx(state) — spawn + animate emoji per frame
// clearRoomBonusVfx()       — destroy all, clear pool
//
// Globals: CONFIG, ROOM_BONUS_TYPES (from config.js)
// ============================================================

import { Container, Text } from 'pixi.js';
import { CELL_PX } from '../world/constants.js';

const POOL_SIZE = 30;
const SPAWN_INTERVAL = 0.4;
const LIFE_MIN = 2.0;
const LIFE_MAX = 3.0;
const FONT_SIZE = 12;

let _container = null;
const _pool = [];   // idle Text objects
const _active = []; // { spr, vx, vy, life, maxLife, baseX, wobblePhase, wobbleAmp }

// ── Public API ────────────────────────────────────────────────

export function initRoomBonusVfx(layer) {
  _container = new Container();
  layer.addChild(_container);
  for (let i = 0; i < POOL_SIZE; i++) _pool.push(_makeText());
}

export function clearRoomBonusVfx() {
  if (!_container) return;
  for (const a of _active) {
    a.spr.visible = false;
    _pool.push(a.spr);
  }
  _active.length = 0;
  _container.removeChildren();
}

let _timer = 0;

export function updateRoomBonusVfx(state, dt) {
  if (!_container) return;
  if (state.phase !== 'play') {
    // hide all active when not in play
    for (const a of _active) {
      a.spr.visible = false;
      _pool.push(a.spr);
    }
    _active.length = 0;
    _container.removeChildren();
    return;
  }

  // Spawn
  _timer += dt;
  if (_timer >= SPAWN_INTERVAL) {
    _timer = 0;
    _spawn(state);
  }

  // Update active
  for (let i = _active.length - 1; i >= 0; i--) {
    const a = _active[i];
    a.life -= dt;
    if (a.life <= 0) {
      a.spr.visible = false;
      _pool.push(a.spr);
      _active.splice(i, 1);
      _container.removeChild(a.spr);
      continue;
    }
    a.baseX += a.vx * dt;
    a.spr.y += a.vy * dt;
    a.wobblePhase += dt * 2;
    a.spr.x = a.baseX + Math.sin(a.wobblePhase) * a.wobbleAmp;

    // kill if drifted outside the cell bounds
    const cellMinX = a.cellX * CELL_PX;
    const cellMaxX = (a.cellX + 1) * CELL_PX;
    const cellMinY = a.cellY * CELL_PX;
    const cellMaxY = (a.cellY + 1) * CELL_PX;
    if (a.spr.x < cellMinX || a.spr.x > cellMaxX ||
        a.spr.y < cellMinY || a.spr.y > cellMaxY) {
      a.life = 0;
    }

    // alpha fade: fade in first 20%, fade out last 30%
    const t = 1 - a.life / a.maxLife;
    let alpha;
    if (t < 0.2) alpha = t / 0.2;
    else if (t > 0.7) alpha = (1 - t) / 0.3;
    else alpha = 1;
    a.spr.alpha = alpha;

    // gentle scale pulse
    const scale = 1 + Math.sin(a.wobblePhase * 1.5) * 0.1;
    a.spr.scale.set(scale);
  }
}

// ── Internal ──────────────────────────────────────────────────

function _spawn(state) {
  const bonuses = state.roomBonuses;
  if (!bonuses || bonuses.length === 0) return;
  const rooms = state.rooms;
  if (!rooms) return;
  const everRevealed = state.everRevealedCells;
  if (!everRevealed) return;

  for (const rb of bonuses) {
    const room = rooms[rb.roomIdx];
    if (!room || !room.cells || room.cells.length === 0) continue;

    // pick a random cell that's been revealed
    const revealedCells = room.cells.filter(c => everRevealed.has(c.k));
    if (revealedCells.length === 0) continue;
    const cell = revealedCells[Math.floor(Math.random() * revealedCells.length)];

    const bonusDef = (typeof ROOM_BONUS_TYPES !== 'undefined')
      ? ROOM_BONUS_TYPES.find(bt => bt.id === rb.bonusType)
      : null;
    if (!bonusDef || !bonusDef.icon) continue;

    const spr = _pool.pop() ?? _makeText();
    spr.text = bonusDef.icon;
    spr.style.fontSize = FONT_SIZE;
    spr.anchor.set(0.5);

    // random position within the cell (with some margin)
    const margin = CELL_PX * 0.2;
    const px = (cell.x + 0.5) * CELL_PX + (Math.random() - 0.5) * (CELL_PX - margin * 2);
    const py = (cell.y + 0.5) * CELL_PX + (Math.random() - 0.5) * (CELL_PX - margin * 2);
    spr.x = px;
    spr.y = py;
    spr.alpha = 0;
    spr.visible = true;
    _container.addChild(spr);

    const life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
    _active.push({
      spr,
      vx: (Math.random() - 0.5) * 10,
      vy: -5 - Math.random() * 8,
      life,
      maxLife: life,
      baseX: px,
      cellX: cell.x,
      cellY: cell.y,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 3 + Math.random() * 4,
    });
  }
}

function _makeText() {
  return new Text({
    text: '',
    style: { fontSize: FONT_SIZE, fontFamily: 'sans-serif' },
  });
}
