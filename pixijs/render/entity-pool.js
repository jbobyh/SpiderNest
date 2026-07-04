// ============================================================
// ENTITY POOL — texture caches + sprite factories
//
// Call initEntityPool() once after Assets are loaded.
// Then use make*() factories to create display objects.
//
// SPRITE_SHEETS (hero, shooter, cocoon, bat) — from config.js (global)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';

// Cached frame arrays — populated by initEntityPool()
export const heroFrames     = {};  // { idle_forward: Texture[], ... }
export const shooterFrames  = {};  // { run: Texture[], idle: Texture[], shoot: Texture[] }
export const cocoonFrames   = [];  // Texture[7]
export const batFrames      = [];  // Texture[7]
export let   batHitTexture  = Texture.WHITE; // Texture
export const enemyTextures  = {};  // { soldier, bat, bull, buldyga, bloated, tank }
export const corpseTextures = {};  // { soldier, bat, bull, buldyga, bloated, shooter, tank }
export const weaponTextures = {};  // { pistol, shotgun, smg, rifle, revolver, carbine }
let tankTexture = Texture.WHITE;
let tankCorpseTexture = Texture.WHITE;
let wallShooterTexture = Texture.WHITE;
let wallShooterCorpseTexture = Texture.WHITE;
let ghostTexture = Texture.WHITE;
let ghostCorpseTexture = Texture.WHITE;

/**
 * Build all texture caches from loaded Assets.
 * Must be called after loadAssets() resolves.
 */
export function initEntityPool() {
  _buildHeroFrames();
  _buildShooterFrames();
  _buildCocoonFrames();
  _buildBatFrames();
  _buildTankTextures();
  _buildWallShooterTextures();
  _buildGhostTextures();
  _buildEnemyTextures();
  _buildWeaponTextures();
}

// ── Sprite factories ──────────────────────────────────────────

/**
 * Create a Sprite for a live enemy of the given type.
 * Caller is responsible for adding it to a layer and destroying it later.
 * @param {string} type — 'soldier' | 'bat' | 'bull' | 'buldyga' | 'bloated' | 'shooter' | 'cocoon'
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
  if (type === 'wallshooter') {
    const spr = new Sprite(wallShooterCorpseTexture);
    spr.anchor.set(0.5);
    return spr;
  }
  const tex = corpseTextures[type] ?? corpseTextures.soldier;
  const spr = new Sprite(tex);
  spr.anchor.set(0.5);
  return spr;
}

/**
 * Get the shooter texture for a given animState + frame index.
 * @param {string} animState — 'run' | 'idle' | 'shoot'
 * @param {number} frame
 * @returns {Texture}
 */
export function getShooterFrame(animState, frame) {
  const arr = shooterFrames[animState] ?? shooterFrames.idle;
  return arr[Math.min(frame, arr.length - 1)];
}

// ── Private builders ─────────────────────────────────────────

function _buildHeroFrames() {
  const heroTex = Assets.get('hero');
  for (const [key, def] of Object.entries(SPRITE_SHEETS.hero.anims)) {
    heroFrames[key] = [];
    for (let f = 0; f < def.frames; f++) {
      heroFrames[key].push(new Texture({
        source: heroTex.source,
        frame:  new Rectangle(f * SPRITE_SHEETS.hero.sw, def.row * SPRITE_SHEETS.hero.sh, SPRITE_SHEETS.hero.sw, SPRITE_SHEETS.hero.sh),
      }));
    }
  }
}

function _buildShooterFrames() {
  const shooterTex = Assets.get('shooter-anim');
  for (const [key, def] of Object.entries(SPRITE_SHEETS.shooter.anims)) {
    shooterFrames[key] = [];
    for (let f = 0; f < def.frames; f++) {
      shooterFrames[key].push(new Texture({
        source: shooterTex.source,
        frame:  new Rectangle(f * SPRITE_SHEETS.shooter.sw, def.row * SPRITE_SHEETS.shooter.sh, SPRITE_SHEETS.shooter.sw, SPRITE_SHEETS.shooter.sh),
      }));
    }
  }
}

function _buildCocoonFrames() {
  const cocoonTex = Assets.get('cocoon');
  for (let f = 0; f < SPRITE_SHEETS.cocoon.anim.frames; f++) {
    cocoonFrames.push(new Texture({
      source: cocoonTex.source,
      frame:  new Rectangle(f * SPRITE_SHEETS.cocoon.sw, 0, SPRITE_SHEETS.cocoon.sw, SPRITE_SHEETS.cocoon.sh),
    }));
  }
}

function _buildBatFrames() {
  const batTex = Assets.get('bat');
  if (!batTex) return;
  for (let f = 0; f < SPRITE_SHEETS.bat.anim.frames; f++) {
    batFrames.push(new Texture({
      source: batTex.source,
      frame:  new Rectangle(f * SPRITE_SHEETS.bat.sw, 0, SPRITE_SHEETS.bat.sw, SPRITE_SHEETS.bat.sh),
    }));
  }
  batHitTexture = new Texture({
    source: batTex.source,
    frame:  new Rectangle(SPRITE_SHEETS.bat.anim.hitFrame * SPRITE_SHEETS.bat.sw, 0, SPRITE_SHEETS.bat.sw, SPRITE_SHEETS.bat.sh),
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

function _buildWallShooterTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(50, 50, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#cc4400';
  ctx.lineWidth = 6;
  ctx.stroke();
  wallShooterTexture = Texture.from(canvas);

  const canvas2 = document.createElement('canvas');
  canvas2.width = 100;
  canvas2.height = 100;
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = '#aa4400';
  ctx2.beginPath();
  ctx2.arc(50, 50, 45, 0, Math.PI * 2);
  ctx2.fill();
  wallShooterCorpseTexture = Texture.from(canvas2);
}

function _buildGhostTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3399ff';
  ctx.beginPath();
  ctx.arc(50, 50, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1166cc';
  ctx.lineWidth = 6;
  ctx.stroke();
  ghostTexture = Texture.from(canvas);

  const canvas2 = document.createElement('canvas');
  canvas2.width = 100;
  canvas2.height = 100;
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = '#2266aa';
  ctx2.beginPath();
  ctx2.arc(50, 50, 45, 0, Math.PI * 2);
  ctx2.fill();
  ghostCorpseTexture = Texture.from(canvas2);
}

function _buildEnemyTextures() {
  enemyTextures.soldier = Assets.get('soldier');
  enemyTextures.bull     = Assets.get('bull');
  enemyTextures.buldyga  = Assets.get('buldyga');
  enemyTextures.bloated  = Assets.get('bloated');
  enemyTextures.tank     = tankTexture;
  enemyTextures.wallshooter = wallShooterTexture;
  enemyTextures.ghost = ghostTexture;

  corpseTextures.soldier = Assets.get('soldier-dead');
  corpseTextures.shooter = Assets.get('shooter-dead');
  corpseTextures.bull    = Assets.get('bull-dead');
  corpseTextures.buldyga = Assets.get('buldyga-dead');
  corpseTextures.bloated = Assets.get('bloated-dead');
  corpseTextures.tank    = tankCorpseTexture;
  corpseTextures.wallshooter = wallShooterCorpseTexture;
  corpseTextures.ghost = ghostCorpseTexture;
}

function _buildWeaponTextures() {
  for (const id of ['pistol', 'shotgun', 'smg', 'rifle', 'revolver', 'carbine']) {
    weaponTextures[id] = Assets.get('weapon-' + id);
  }
}

function _enemyTexForType(type) {
  if (type === 'shooter') return shooterFrames.idle?.[0] ?? Texture.WHITE;
  if (type === 'cocoon')                         return cocoonFrames[0]         ?? Texture.WHITE;
  if (type === 'bat')                            return batFrames[0]            ?? Texture.WHITE;
  if (type === 'tank')                           return enemyTextures.tank       ?? Texture.WHITE;
  if (type === 'wallshooter')                    return enemyTextures.wallshooter ?? Texture.WHITE;
  if (type === 'ghost')                           return enemyTextures.ghost       ?? Texture.WHITE;
  return enemyTextures[type] ?? enemyTextures.soldier ?? Texture.WHITE;
}
