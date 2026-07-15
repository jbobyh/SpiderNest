// ============================================================
// COLLECTIBLE RENDERER — world-space sprites for
// upgrade chests, spatial chests, room bonus altars.
//
// initCollectibleRenderer(entitiesLayer)
// syncCollectibles(state)   — call each frame
// clearCollectibles()       — call on level teardown
// ============================================================

import { Sprite, Texture, Graphics, Text, Assets } from 'pixi.js';
import { cellOf, cellKey } from '../world/constants.js';

let _layer = null;

const _chests        = new Map(); // key → Sprite
const _upgradeChests = new Map(); // key → Sprite
const _altars        = new Map(); // cellKey → Sprite
const _roomBonusAltars = new Map(); // cellKey → Sprite

// ── Public API ────────────────────────────────────────────────

export function initCollectibleRenderer(entitiesLayer) {
  _layer = entitiesLayer;
}

export function clearCollectibles() {
  for (const s of _chests.values())         s.destroy({ children: true });
  for (const s of _upgradeChests.values()) s.destroy({ children: true });
  for (const e of _altars.values())        { e.spr.destroy(); e.label?.destroy(); }
  for (const s of _roomBonusAltars.values()) s.destroy({ children: true });
  _chests.clear();
  _upgradeChests.clear();
  _altars.clear();
  _roomBonusAltars.clear();
}

/**
 * Sync collectible sprites to current state.
 * @param {object} state — full game state (reads state.battle when in battle)
 */
export function syncCollectibles(state) {
  if (!_layer) return;

  const inBattle = state.phase === 'battle' || state.phase === 'zoom_out';

  const openCells       = inBattle ? state.battle?.battleCells : state.openCells;
  const everRevealedCells = (!inBattle) ? state.everRevealedCells : new Set();

  _syncSpatialChests(state.spatialChests  || [], openCells, everRevealedCells);
  _syncUpgradeChests(state.upgradeChests  || [], openCells, everRevealedCells);
  if (!inBattle) {
    _syncAltars(state.roomAltars || [], state.openCells, state.cellContents, everRevealedCells);
    _syncRoomBonusAltars(state.roomBonusAltars || [], state.openCells, everRevealedCells);
  } else {
    _syncAltars([], null, null, null);
    _syncRoomBonusAltars([], null, null);
  }
}

// ── Spatial Chests ───────────────────────────────────────────

const SPATIAL_CHEST_SIZE = 30;

function _syncSpatialChests(chests, openCells, everRevealedCells) {
  const alive = new Set();
  for (const c of chests) {
    if (c.collected || c.spawned === false) continue;
    // Show in open cells OR revealed rooms
    const cc = cellOf(c.x, c.y);
    const ck = cellKey(cc.x, cc.y);
    const isVisible = openCells?.has(ck) || everRevealedCells?.has(ck);
    if (!isVisible) continue;
    const k = c.cellKey ?? c.originalCellKey ?? `sc:${Math.round(c.x)},${Math.round(c.y)}`;
    alive.add(k);
    if (!_chests.has(k)) {
      const tex = Assets.get('cursed-chest');
      const spr = new Sprite(tex ?? Texture.WHITE);
      spr.anchor.set(0.5);
      spr.width = spr.height = SPATIAL_CHEST_SIZE;
      // No tint - use natural cursed chest texture
      _layer.addChild(spr);
      _chests.set(k, spr);
    }
    _chests.get(k).position.set(c.x, c.y);
  }
  for (const [k, s] of _chests) {
    if (!alive.has(k)) { s.destroy(); _chests.delete(k); }
  }
}

// ── Upgrade Chests ────────────────────────────────────────────

const UPGRADE_CHEST_SIZE = 28;

function _syncUpgradeChests(chests, openCells, everRevealedCells) {
  const alive = new Set();
  for (const c of chests) {
    if (c.collected || c.spawned === false) continue;
    // Show in open cells OR revealed rooms
    const cc = cellOf(c.x, c.y);
    const ck = cellKey(cc.x, cc.y);
    const isVisible = openCells?.has(ck) || everRevealedCells?.has(ck);
    if (!isVisible) continue;
    const k = c.cellKey ?? `uc:${Math.round(c.x)},${Math.round(c.y)}`;
    alive.add(k);
    if (!_upgradeChests.has(k)) {
      const tex = Assets.get('chest');
      const spr = new Sprite(tex ?? Texture.WHITE);
      spr.anchor.set(0.5);
      spr.width = spr.height = UPGRADE_CHEST_SIZE;
      // No tint - use natural chest color
      _layer.addChild(spr);
      _upgradeChests.set(k, spr);
    }
    _upgradeChests.get(k).position.set(c.x, c.y);
  }
  for (const [k, s] of _upgradeChests) {
    if (!alive.has(k)) { s.destroy(); _upgradeChests.delete(k); }
  }
}

// ── Altars ────────────────────────────────────────────────────

const ALTAR_SIZE = 24;

function _syncAltars(altars, openCells, cellContents, everRevealedCells) {
  const alive = new Set();
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.006);
  for (const altar of altars) {
    if (altar.activated) continue;
    // Show in open cells OR revealed rooms
    const isVisible = openCells?.has(altar.cellKey) || everRevealedCells?.has(altar.cellKey);
    if (!isVisible) continue;
    const content = cellContents ? cellContents.get(altar.cellKey) : null;
    if (!content || !content.enemyCount || content.enemyCount <= 0 || content.enemiesReleased) continue;
    const k = altar.cellKey;
    alive.add(k);
    if (!_altars.has(k)) {
      const spr = _makeSprite('altar', ALTAR_SIZE);
      _layer.addChild(spr);
      _altars.set(k, { spr });
    }
    const { spr } = _altars.get(k);
    spr.position.set(altar.x, altar.y);
    spr.alpha = pulse;
  }
  for (const [k, e] of _altars) {
    if (!alive.has(k)) { e.spr.destroy(); _altars.delete(k); }
  }
}

// ── Room Bonus Altars ───────────────────────────────────────────

const ROOM_BONUS_ALTAR_SIZE = 28;

function _syncRoomBonusAltars(altars, openCells, everRevealedCells) {
  const alive = new Set();
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
  for (const altar of altars) {
    if (altar.activated) continue;
    // Show in open cells OR revealed rooms
    const isVisible = openCells?.has(altar.cellKey) || everRevealedCells?.has(altar.cellKey);
    if (!isVisible) continue;
    const k = altar.cellKey;
    alive.add(k);
    if (!_roomBonusAltars.has(k)) {
      const tex = Assets.get('room_altar');
      const spr = new Sprite(tex ?? Texture.WHITE);
      spr.anchor.set(0.5);
      spr.width = spr.height = ROOM_BONUS_ALTAR_SIZE;
      spr.tint = 0x44ff88;
      _layer.addChild(spr);
      _roomBonusAltars.set(k, spr);
    }
    const spr = _roomBonusAltars.get(k);
    spr.position.set(altar.x, altar.y);
    spr.alpha = pulse;
  }
  for (const [k, spr] of _roomBonusAltars) {
    if (!alive.has(k)) { spr.destroy(); _roomBonusAltars.delete(k); }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _makeSprite(alias, size) {
  const spr = new Sprite(Texture.from(alias));
  spr.anchor.set(0.5);
  spr.width = spr.height = size;
  return spr;
}

function _hexToNum(str) {
  if (!str) return 0xffffff;
  return parseInt(str.replace('#', ''), 16);
}
