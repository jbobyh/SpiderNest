// ============================================================
// ENTITY POOL — texture caches + sprite factories
//
// Call initEntityPool() once after Assets are loaded.
// Then use make*() factories to create display objects.
//
// HERO_ANIMS, PLEVAKA_ANIMS, COCOON_ANIM, HERO_SW, HERO_SH,
// PLEVAKA_SW, PLEVAKA_SH, COCOON_SW, COCOON_SH — from config.js (global)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';

// Cached frame arrays — populated by initEntityPool()
export const heroFrames     = {};  // { idle_forward: Texture[], ... }
export const plevakaFrames  = {};  // { run: Texture[], idle: Texture[], shoot: Texture[] }
export const cocoonFrames   = [];  // Texture[7]
export const enemyTextures  = {};  // { soldier, bull, buldyga, bloated }
export const corpseTextures = {};  // { soldier, bull, buldyga, bloated, plevaka }
export const weaponTextures = {};  // { pistol, shotgun, smg, rifle, revolver, carbine }

/**
 * Build all texture caches from loaded Assets.
 * Must be called after loadAssets() resolves.
 */
export function initEntityPool() {
  _buildHeroFrames();
  _buildPlevakaFrames();
  _buildCocoonFrames();
  _buildEnemyTextures();
  _buildWeaponTextures();
}

// ── Sprite factories ──────────────────────────────────────────

/**
 * Create a Sprite for a live enemy of the given type.
 * Caller is responsible for adding it to a layer and destroying it later.
 * @param {string} type — 'soldier' | 'bull' | 'buldyga' | 'bloated' | 'plevaka' | 'shooter' | 'cocoon'
 * @returns {Sprite}
 */
export function makeEnemySprite(type) {
  const tex = _enemyTexForType(type);
  const spr = new Sprite(tex);
  spr.anchor.set(0.5);
  return spr;
}

/**
 * Create a Sprite for a death corpse of the given type.
 * @param {string} type
 * @returns {Sprite}
 */
export function makeCorpseSprite(type) {
  const key = (type === 'shooter') ? 'plevaka' : type;
  const tex = corpseTextures[key] ?? corpseTextures.soldier;
  const spr = new Sprite(tex);
  spr.anchor.set(0.5);
  return spr;
}

/**
 * Get the plevaka texture for a given animState + frame index.
 * @param {string} animState — 'run' | 'idle' | 'shoot'
 * @param {number} frame
 * @returns {Texture}
 */
export function getPlevakaFrame(animState, frame) {
  const arr = plevakaFrames[animState] ?? plevakaFrames.idle;
  return arr[Math.min(frame, arr.length - 1)];
}

// ── Private builders ─────────────────────────────────────────

function _buildHeroFrames() {
  const heroTex = Assets.get('hero');
  for (const [key, def] of Object.entries(HERO_ANIMS)) {
    heroFrames[key] = [];
    for (let f = 0; f < def.frames; f++) {
      heroFrames[key].push(new Texture({
        source: heroTex.source,
        frame:  new Rectangle(f * HERO_SW, def.row * HERO_SH, HERO_SW, HERO_SH),
      }));
    }
  }
}

function _buildPlevakaFrames() {
  const plevakaTex = Assets.get('plevaka-anim');
  for (const [key, def] of Object.entries(PLEVAKA_ANIMS)) {
    plevakaFrames[key] = [];
    for (let f = 0; f < def.frames; f++) {
      plevakaFrames[key].push(new Texture({
        source: plevakaTex.source,
        frame:  new Rectangle(f * PLEVAKA_SW, def.row * PLEVAKA_SH, PLEVAKA_SW, PLEVAKA_SH),
      }));
    }
  }
}

function _buildCocoonFrames() {
  const cocoonTex = Assets.get('cocoon');
  for (let f = 0; f < COCOON_ANIM.frames; f++) {
    cocoonFrames.push(new Texture({
      source: cocoonTex.source,
      frame:  new Rectangle(f * COCOON_SW, 0, COCOON_SW, COCOON_SH),
    }));
  }
}

function _buildEnemyTextures() {
  enemyTextures.soldier = Assets.get('soldier');
  enemyTextures.bull     = Assets.get('bull');
  enemyTextures.buldyga  = Assets.get('buldyga');
  enemyTextures.bloated  = Assets.get('bloated');

  corpseTextures.soldier = Assets.get('soldier-dead');
  corpseTextures.plevaka = Assets.get('plevaka-dead');
  corpseTextures.bull    = Assets.get('bull-dead');
  corpseTextures.buldyga = Assets.get('buldyga-dead');
  corpseTextures.bloated = Assets.get('bloated-dead');
}

function _buildWeaponTextures() {
  for (const id of ['pistol', 'shotgun', 'smg', 'rifle', 'revolver', 'carbine']) {
    weaponTextures[id] = Assets.get('weapon-' + id);
  }
}

function _enemyTexForType(type) {
  if (type === 'plevaka' || type === 'shooter') return plevakaFrames.idle?.[0] ?? Texture.WHITE;
  if (type === 'cocoon')                         return cocoonFrames[0]         ?? Texture.WHITE;
  return enemyTextures[type] ?? enemyTextures.soldier ?? Texture.WHITE;
}
