// ============================================================
// BULLET RENDERER
//
// syncBullets(bullets, enemyBullets, entitiesLayer)
//   — keeps Graphics circles in sync with bullet state arrays.
//   — player bullets  : colored circle (b.weaponColor if present, else cyan)
//   — enemy bullets   : orange circle
//
// clearBullets() — destroy all tracked bullet graphics (level reset)
//
// Globals: CONFIG (from config.js)
// ============================================================

import { Graphics } from 'pixi.js';

// Map from state bullet object → Graphics circle
const _playerMap = new Map();
const _enemyMap  = new Map();

// Small free-list pool to avoid GC churn
const _pool = [];

const PLAYER_BULLET_COLOR = 0xffff00; // yellow fallback (weapon color overrides)
const ENEMY_BULLET_COLOR  = 0xff4400;
const BULLET_R = CONFIG.BULLET_RADIUS;

// ── Public API ────────────────────────────────────────────────

/**
 * Sync player and enemy bullet Graphics to state arrays.
 * @param {object[]} bullets       — state.bullets / state.battle.bullets
 * @param {object[]} enemyBullets  — state.enemyBullets / state.battle.enemyBullets
 * @param {import('pixi.js').Container} entitiesLayer
 */
export function syncBullets(bullets, enemyBullets, entitiesLayer) {
  _sync(bullets,      _playerMap, entitiesLayer, false);
  _sync(enemyBullets, _enemyMap,  entitiesLayer, true);
}

/**
 * Destroy all tracked bullet graphics and clear maps.
 */
export function clearBullets() {
  for (const g of _playerMap.values()) { g.destroy(); }
  for (const g of _enemyMap.values())  { g.destroy(); }
  _playerMap.clear();
  _enemyMap.clear();
  for (const g of _pool) g.destroy();
  _pool.length = 0;
}

// ── Internal ──────────────────────────────────────────────────

function _sync(stateArr, map, layer, isEnemy) {
  // Remove Graphics for bullets that left the state array
  for (const [b, g] of map) {
    if (!stateArr.includes(b)) {
      layer.removeChild(g);
      _release(g);
      map.delete(b);
    }
  }

  // Add Graphics for new bullets; update position for existing ones
  for (const b of stateArr) {
    if (!map.has(b)) {
      const g = _acquire(isEnemy ? ENEMY_BULLET_COLOR : (b.weaponColor ?? PLAYER_BULLET_COLOR));
      layer.addChild(g);
      map.set(b, g);
    }
    const g = map.get(b);
    g.x = b.x;
    g.y = b.y;
  }
}

function _acquire(color) {
  const g = _pool.pop() ?? new Graphics();
  g.clear();
  g.circle(0, 0, BULLET_R).fill({ color });
  g.visible = true;
  return g;
}

function _release(g) {
  g.visible = false;
  _pool.push(g);
}
