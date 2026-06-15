// ============================================================
// ENEMY RENDERER
//
// syncEnemySprites(activeSpiders, deathCorpses, entitiesLayer, gameTime, playerX)
//   — keeps PixiJS sprites in sync with game-state enemy arrays.
//   — hit flash  : ColorMatrixFilter brightness burst
//   — death fade : corpse sprite alpha = life / maxLife
//
// clearEnemySprites() — destroy all tracked sprites (level reset)
//
// Globals: CONFIG, PLEVAKA_ANIMS, COCOON_ANIM (from config.js)
// ============================================================

import { Sprite, ColorMatrixFilter } from 'pixi.js';
import {
  makeEnemySprite,
  makeCorpseSprite,
  getPlevakaFrame,
  cocoonFrames,
  enemyTextures,
} from './entity-pool.js';

// Maps enemy/corpse object reference → { sprite, filter? }
const _enemyMap  = new Map();
const _corpseMap = new Map();

// Reusable filter — one per tracked enemy (created on first use)
const _FLASH_BRIGHTNESS = 6; // how bright the white flash is

// ── Public API ────────────────────────────────────────────────

/**
 * Sync live enemy sprites + corpse sprites to state arrays.
 *
 * @param {object[]} activeSpiders  — state.activeSpiders
 * @param {object[]} deathCorpses   — state.deathCorpses
 * @param {import('pixi.js').Container} entitiesLayer
 * @param {number}   gameTime       — state.time, used for cocoon frame
 * @param {number}   playerX        — player x in world coords (for horizontal flip)
 */
export function syncEnemySprites(
  activeSpiders, deathCorpses, entitiesLayer,
  gameTime, playerX,
) {
  _syncCorpses(deathCorpses, entitiesLayer);
  _syncActive(activeSpiders, entitiesLayer, gameTime, playerX);
}

/**
 * Destroy all tracked sprites and clear internal maps.
 * Call when changing levels or resetting the game.
 */
export function clearEnemySprites() {
  for (const { sprite } of _enemyMap.values())  sprite.destroy();
  for (const spr of _corpseMap.values())         spr.destroy();
  _enemyMap.clear();
  _corpseMap.clear();
}

// ── Corpse sync ───────────────────────────────────────────────

function _syncCorpses(deathCorpses, layer) {
  // Remove sprites for corpses no longer in state
  for (const [c, spr] of _corpseMap) {
    if (!deathCorpses.includes(c)) {
      spr.destroy();
      _corpseMap.delete(c);
    }
  }

  for (const c of deathCorpses) {
    if (!_corpseMap.has(c)) {
      const spr = makeCorpseSprite(c.type);
      layer.addChildAt(spr, 0); // render behind active enemies
      _corpseMap.set(c, spr);
    }
    const spr = _corpseMap.get(c);
    spr.x     = c.x;
    spr.y     = c.y;
    spr.alpha = Math.max(0, c.life / c.maxLife);
    _applyEnemyScale(spr, c.radius, c.visualScale);
  }
}

// ── Active enemy sync ─────────────────────────────────────────

function _syncActive(activeSpiders, layer, gameTime, playerX) {
  // Remove sprites for enemies no longer in state
  for (const [g, entry] of _enemyMap) {
    if (!activeSpiders.includes(g)) {
      entry.sprite.destroy();
      _enemyMap.delete(g);
    }
  }

  for (const g of activeSpiders) {
    if (!_enemyMap.has(g)) {
      const sprite = makeEnemySprite(g.type);
      const filter = new ColorMatrixFilter();
      layer.addChild(sprite);
      _enemyMap.set(g, { sprite, filter });
    }

    const { sprite, filter } = _enemyMap.get(g);

    // Position + scale
    sprite.x = g.x;
    sprite.y = g.y;
    _applyEnemyScale(sprite, g.radius, g.visualScale);

    // Horizontal flip: player left of enemy → face left
    sprite.scale.x = (playerX < g.x) ? -Math.abs(sprite.scale.x) : Math.abs(sprite.scale.x);

    // Hit flash via ColorMatrixFilter
    if (g.hitFlash > 0) {
      const t = Math.min(1, g.hitFlash / CONFIG.ENEMY_HIT_FLASH_DURATION);
      filter.brightness(1 + (_FLASH_BRIGHTNESS - 1) * t, false);
      sprite.filters = [filter];
    } else {
      sprite.filters = null;
    }

    // Per-type texture updates
    _updateEnemyTexture(g, sprite, gameTime);
  }
}

// ── Per-type texture logic ────────────────────────────────────

function _updateEnemyTexture(g, sprite, gameTime) {
  const isPlevaka = g.type === 'plevaka' || g.type === 'shooter';
  const isCocoon  = g.type === 'cocoon';
  const isBoss    = g.isBoss;

  if (isPlevaka && g.animState !== null) {
    const tex = getPlevakaFrame(g.animState, g.animFrame ?? 0);
    if (sprite.texture !== tex) sprite.texture = tex;
  } else if (isCocoon) {
    const fps   = COCOON_ANIM.fps;
    const total = COCOON_ANIM.frames;
    const frame = Math.floor((gameTime * fps) % total);
    const tex   = cocoonFrames[frame];
    if (sprite.texture !== tex) sprite.texture = tex;
  } else if (isBoss) {
    // Boss uses its current phase type sprite; phase selection handled externally
    // For now, use the base enemy texture determined at spawn time — no change needed
  }
  // soldier / bull / buldyga / bloated: static textures, nothing to update
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Scale a 500×500 sprite so its displayed size = radius * visualScale px.
 * Camera zoom handles battle-mode magnification — no extra multiplier needed here.
 */
function _applyEnemyScale(sprite, radius, visualScale) {
  const drawSize = (radius ?? CONFIG.SPIDER_RADIUS) * (visualScale ?? CONFIG.SPIDER_VISUAL_SCALE);
  const s        = drawSize / 500;
  // Preserve x-sign (flip) while updating magnitude
  const signX    = sprite.scale.x < 0 ? -1 : 1;
  sprite.scale.set(signX * s, s);
}
