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
export const batFrames      = [];  // Texture[7]
export let   batHitTexture  = Texture.WHITE; // Texture
export const enemyTextures  = {};  // { soldier, bat, bull, buldyga, bloated, tank }
export const corpseTextures = {};  // { soldier, bat, bull, buldyga, bloated, plevaka, tank }
export const weaponTextures = {};  // { pistol, shotgun, smg, rifle, revolver, carbine }
let tankTexture = Texture.WHITE;
let tankCorpseTexture = Texture.WHITE;

/**
 * Build all texture caches from loaded Assets.
 * Must be called after loadAssets() resolves.
 */
export function initEntityPool() {
  _buildHeroFrames();
  _buildPlevakaFrames();
  _buildCocoonFrames();
  _buildBatFrames();
  _buildTankTextures();
  _buildEnemyTextures();
  _buildWeaponTextures();
}

// ── Sprite factories ──────────────────────────────────────────

/**
 * Create a Sprite for a live enemy of the given type.
 * Caller is responsible for adding it to a layer and destroying it later.
 * @param {string} type — 'soldier' | 'bat' | 'bull' | 'buldyga' | 'bloated' | 'plevaka' | 'shooter' | 'cocoon'
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
  if (type === 'bat') {
    const spr = new Sprite(batHitTexture);
    spr.anchor.set(0.5);
    return spr;
  }
  if (type === 'tank') {
    const spr = new Sprite(tankCorpseTexture);
    spr.anchor.set(0.5);
    return spr;
  }
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

function _buildBatFrames() {
  const batTex = Assets.get('bat');
  if (!batTex) return;
  for (let f = 0; f < BAT_ANIM.frames; f++) {
    batFrames.push(new Texture({
      source: batTex.source,
      frame:  new Rectangle(f * BAT_SW, 0, BAT_SW, BAT_SH),
    }));
  }
  batHitTexture = new Texture({
    source: batTex.source,
    frame:  new Rectangle(BAT_ANIM.hitFrame * BAT_SW, 0, BAT_SW, BAT_SH),
  });
}

function _buildTankTextures() {
  // Создаем текстуру для танка с помощью Canvas API
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(50, 50, 50, 0, Math.PI * 2);
  ctx.fill();
  tankTexture = Texture.from(canvas);

  // Создаем текстуру для трупа танка
  const canvas2 = document.createElement('canvas');
  canvas2.width = 100;
  canvas2.height = 100;
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = '#aa0000';
  ctx2.beginPath();
  ctx2.arc(50, 50, 50, 0, Math.PI * 2);
  ctx2.fill();
  tankCorpseTexture = Texture.from(canvas2);
}

function _buildEnemyTextures() {
  enemyTextures.soldier = Assets.get('soldier');
  enemyTextures.bull     = Assets.get('bull');
  enemyTextures.buldyga  = Assets.get('buldyga');
  enemyTextures.bloated  = Assets.get('bloated');
  enemyTextures.tank     = tankTexture;

  corpseTextures.soldier = Assets.get('soldier-dead');
  corpseTextures.plevaka = Assets.get('plevaka-dead');
  corpseTextures.bull    = Assets.get('bull-dead');
  corpseTextures.buldyga = Assets.get('buldyga-dead');
  corpseTextures.bloated = Assets.get('bloated-dead');
  corpseTextures.tank    = tankCorpseTexture;
}

function _buildWeaponTextures() {
  for (const id of ['pistol', 'shotgun', 'smg', 'rifle', 'revolver', 'carbine']) {
    weaponTextures[id] = Assets.get('weapon-' + id);
  }
}

function _enemyTexForType(type) {
  if (type === 'plevaka' || type === 'shooter') return plevakaFrames.idle?.[0] ?? Texture.WHITE;
  if (type === 'cocoon')                         return cocoonFrames[0]         ?? Texture.WHITE;
  if (type === 'bat')                            return batFrames[0]            ?? Texture.WHITE;
  if (type === 'tank')                           return enemyTextures.tank       ?? Texture.WHITE;
  return enemyTextures[type] ?? enemyTextures.soldier ?? Texture.WHITE;
}
