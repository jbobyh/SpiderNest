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
export const heroHandsFrames = [];  // [row][col] — 3×5 Texture grid
export const heroLegsFrames  = [];  // [row][col] — 3×5 Texture grid
export const shooterFrames  = {};  // { run: Texture[], idle: Texture[], shoot: Texture[] }
export const cocoonFrames   = [];  // Texture[7]
export const batFrames      = [];  // Texture[7]
export let   batHitTexture  = Texture.WHITE; // Texture
export const ghostFrames    = {};  // { idle: Texture[], move: Texture[], death: Texture[], hit: Texture[] }
export const enemyTextures  = {};  // { soldier, bat, bull, buldyga, bloated, tank }
export const corpseTextures = {};  // { soldier, bat, bull, buldyga, bloated, shooter, tank }
export const weaponTextures = {};  // { pistol, shotgun, smg, rifle, revolver, carbine }
export const pistolFrames = [];    // 12 Texture[] (64×32, shoot spritesheet)
export const pistolReloadFrames = []; // 35 Texture[] (80×48, emptying+reload spritesheets)
export const smgFrames = [];         // 7 Texture[] (80×48, shoot spritesheet)
export const smgReloadFrames = [];  // 28 Texture[] (80×48, empty+reload spritesheets)
export const carbineFrames = [];       // 12 Texture[] (128×48, shoot spritesheet: idle + 11 shoot)
export const carbineReloadFrames = []; // 32 Texture[] (96×64, emptying + reload spritesheets)
export const rifleFrames = [];         // 28 Texture[] (160×32, shoot spritesheet: vertical column)
export const rifleReloadFrames = [];   // 46 Texture[] (128×32, reload spritesheet: horizontal row)
export const armTextures = {};    // { upper, forearm, southUpper, southForearm }
let tankTexture = Texture.WHITE;
let tankCorpseTexture = Texture.WHITE;
let wallShooterTexture = Texture.WHITE;
let wallShooterCorpseTexture = Texture.WHITE;

/**
 * Build all texture caches from loaded Assets.
 * Must be called after loadAssets() resolves.
 */
export function initEntityPool() {
  _buildHeroFrames();
  _buildHeroHandsFrames();
  _buildHeroLegsFrames();
  _buildShooterFrames();
  _buildCocoonFrames();
  _buildBatFrames();
  _buildTankTextures();
  _buildWallShooterTextures();
  _buildGhostFrames();
  _buildEnemyTextures();
  _buildWeaponTextures();
  _buildArmTextures();
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

/**
 * Get the ghost texture for a given animState + frame index.
 * @param {string} animState — 'idle' | 'move' | 'death' | 'hit'
 * @param {number} frame
 * @returns {Texture}
 */
export function getGhostFrame(animState, frame) {
  const arr = ghostFrames[animState] ?? ghostFrames.idle;
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
        frame:  new Rectangle((def.col + f) * SPRITE_SHEETS.hero.sw, 0, SPRITE_SHEETS.hero.sw, SPRITE_SHEETS.hero.sh),
      }));
    }
  }
}

function _buildHeroHandsFrames() {
  const tex = Assets.get('hero-hands');
  if (!tex) return;
  const { sw, sh, rows, cols } = SPRITE_SHEETS.heroHands;
  for (let r = 0; r < rows; r++) {
    heroHandsFrames[r] = [];
    for (let c = 0; c < cols; c++) {
      heroHandsFrames[r][c] = new Texture({
        source: tex.source,
        frame:  new Rectangle(c * sw, r * sh, sw, sh),
      });
    }
  }
}

function _buildHeroLegsFrames() {
  const tex = Assets.get('hero-legs');
  if (!tex) return;
  const { sw, sh, rows, cols } = SPRITE_SHEETS.heroLegs;
  for (let r = 0; r < rows; r++) {
    heroLegsFrames[r] = [];
    for (let c = 0; c < cols; c++) {
      heroLegsFrames[r][c] = new Texture({
        source: tex.source,
        frame:  new Rectangle(c * sw, r * sh, sw, sh),
      });
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

function _buildGhostFrames() {
  const ghostTex = Assets.get('ghost');
  if (!ghostTex) return;
  const cols = SPRITE_SHEETS.ghost.cols;
  for (const [key, def] of Object.entries(SPRITE_SHEETS.ghost.anims)) {
    ghostFrames[key] = [];
    for (const flatIdx of def.frames) {
      const col = flatIdx % cols;
      const row = Math.floor(flatIdx / cols);
      ghostFrames[key].push(new Texture({
        source: ghostTex.source,
        frame:  new Rectangle(col * SPRITE_SHEETS.ghost.sw, row * SPRITE_SHEETS.ghost.sh, SPRITE_SHEETS.ghost.sw, SPRITE_SHEETS.ghost.sh),
      }));
    }
  }
}

function _buildEnemyTextures() {
  enemyTextures.soldier = Assets.get('soldier');
  enemyTextures.bull     = Assets.get('bull');
  enemyTextures.buldyga  = Assets.get('buldyga');
  enemyTextures.bloated  = Assets.get('bloated');
  enemyTextures.tank     = tankTexture;
  enemyTextures.wallshooter = wallShooterTexture;
  enemyTextures.ghost = ghostFrames.idle?.[0] ?? Texture.WHITE;

  corpseTextures.soldier = Assets.get('soldier-dead');
  corpseTextures.shooter = Assets.get('shooter-dead');
  corpseTextures.bull    = Assets.get('bull-dead');
  corpseTextures.buldyga = Assets.get('buldyga-dead');
  corpseTextures.bloated = Assets.get('bloated-dead');
  corpseTextures.tank    = tankCorpseTexture;
  corpseTextures.wallshooter = wallShooterCorpseTexture;
  corpseTextures.ghost = ghostFrames.death?.[0] ?? Texture.WHITE;
}

function _buildWeaponTextures() {
  // Pistol: slice shoot spritesheet (768×32, 12 frames × 64×32)
  const pistolTex = Assets.get('weapon-pistol');
  if (pistolTex) {
    for (let i = 0; i < 12; i++) {
      pistolFrames.push(new Texture({
        source: pistolTex.source,
        frame:  new Rectangle(i * 64, 0, 64, 32),
      }));
    }
    weaponTextures.pistol = pistolFrames[0];
  }

  // Pistol reload: EMPTYING frames 2-18 (indices 1-17) + RELOAD frames 6-23 (indices 5-22)
  const emptyingTex = Assets.get('weapon-pistol-emptying');
  if (emptyingTex) {
    for (let i = 1; i <= 17; i++) {
      pistolReloadFrames.push(new Texture({
        source: emptyingTex.source,
        frame:  new Rectangle(i * 80, 0, 80, 48),
      }));
    }
  }
  const reloadTex = Assets.get('weapon-pistol-reload');
  if (reloadTex) {
    for (let i = 5; i <= 22; i++) {
      pistolReloadFrames.push(new Texture({
        source: reloadTex.source,
        frame:  new Rectangle(i * 80, 0, 80, 48),
      }));
    }
  }

  // SMG: slice shoot spritesheet (7 frames × 80×48)
  const smgTex = Assets.get('weapon-smg');
  if (smgTex) {
    for (let i = 0; i < 7; i++) {
      smgFrames.push(new Texture({
        source: smgTex.source,
        frame:  new Rectangle(i * 80, 0, 80, 48),
      }));
    }
    weaponTextures.smg = smgFrames[0];
  }

  // SMG reload: EMPTY frames 0-11 + RELOAD frames 0-15 = 28 frames
  const smgEmptyTex = Assets.get('weapon-smg-empty');
  if (smgEmptyTex) {
    for (let i = 0; i < 12; i++) {
      smgReloadFrames.push(new Texture({
        source: smgEmptyTex.source,
        frame:  new Rectangle(i * 80, 0, 80, 48),
      }));
    }
  }
  const smgReloadTex = Assets.get('weapon-smg-reload');
  if (smgReloadTex) {
    for (let i = 0; i < 16; i++) {
      smgReloadFrames.push(new Texture({
        source: smgReloadTex.source,
        frame:  new Rectangle(i * 80, 0, 80, 48),
      }));
    }
  }

  // Carbine: slice shoot spritesheet (2048×48, 16 frames × 128×48; use first 12: idle + 11 shoot)
  const carbineTex = Assets.get('weapon-carbine');
  if (carbineTex) {
    for (let i = 0; i < 12; i++) {
      carbineFrames.push(new Texture({
        source: carbineTex.source,
        frame:  new Rectangle(i * 128, 0, 128, 48),
      }));
    }
    weaponTextures.carbine = carbineFrames[0];
  }

  // Carbine reload: EMPTYING 16 frames + RELOAD 16 frames = 32 total (96×64 each)
  const carbineEmptyTex = Assets.get('weapon-carbine-emptying');
  if (carbineEmptyTex) {
    for (let i = 0; i < 16; i++) {
      carbineReloadFrames.push(new Texture({
        source: carbineEmptyTex.source,
        frame:  new Rectangle(i * 96, 0, 96, 64),
      }));
    }
  }
  const carbineReloadTex = Assets.get('weapon-carbine-reload');
  if (carbineReloadTex) {
    for (let i = 0; i < 16; i++) {
      carbineReloadFrames.push(new Texture({
        source: carbineReloadTex.source,
        frame:  new Rectangle(i * 96, 0, 96, 64),
      }));
    }
  }

  // Rifle: slice shoot spritesheet (160×896, 28 frames × 160×32, vertical column)
  const rifleShootTex = Assets.get('weapon-rifle-shoot');
  if (rifleShootTex) {
    for (let i = 0; i < 28; i++) {
      rifleFrames.push(new Texture({
        source: rifleShootTex.source,
        frame:  new Rectangle(0, i * 32, 160, 32),
      }));
    }
    weaponTextures.rifle = rifleFrames[0];
  }

  // Rifle reload: slice reload spritesheet (5888×32, 46 frames × 128×32, horizontal row)
  const rifleReloadTex = Assets.get('weapon-rifle-reload');
  if (rifleReloadTex) {
    for (let i = 0; i < 46; i++) {
      rifleReloadFrames.push(new Texture({
        source: rifleReloadTex.source,
        frame:  new Rectangle(i * 128, 0, 128, 32),
      }));
    }
  }

  // Other weapons: single texture
  for (const id of ['shotgun', 'revolver']) {
    weaponTextures[id] = Assets.get('weapon-' + id);
  }
}

function _enemyTexForType(type) {
  if (type === 'shooter') return shooterFrames.idle?.[0] ?? Texture.WHITE;
  if (type === 'cocoon')                         return cocoonFrames[0]         ?? Texture.WHITE;
  if (type === 'bat')                            return batFrames[0]            ?? Texture.WHITE;
  if (type === 'tank')                           return enemyTextures.tank       ?? Texture.WHITE;
  if (type === 'wallshooter')                    return enemyTextures.wallshooter ?? Texture.WHITE;
  if (type === 'ghost')                           return ghostFrames.idle?.[0]    ?? Texture.WHITE;
  return enemyTextures[type] ?? enemyTextures.soldier ?? Texture.WHITE;
}

function _buildArmTextures() {
  armTextures.upper = Assets.get('arm-upper');
  armTextures.forearm = Assets.get('arm-forearm');
  armTextures.southUpper = Assets.get('arm-south-upper');
  armTextures.southForearm = Assets.get('arm-south-forearm');
}
