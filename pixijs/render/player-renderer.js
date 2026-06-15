// ============================================================
// PLAYER RENDERER
//
// initPlayerRenderer(entitiesLayer) — create hero + weapon sprites
// updatePlayerSprite(state, dt)     — sync to game state each frame
// destroyPlayerRenderer()           — cleanup
//
// Globals used: CONFIG, HERO_ANIMS, WEAPON_DEFS, HERO_SW (from config.js)
// ============================================================

import { Sprite } from 'pixi.js';
import { heroFrames, weaponTextures } from './entity-pool.js';

let _heroSprite   = null;
let _weaponSprite = null;

const _anim = {
  key:   'idle_forward',
  frame: 0,
  timer: 0,
  flip:  false,
};

// ── Public API ────────────────────────────────────────────────

/**
 * Create hero and weapon Sprites and add them to entitiesLayer.
 * @param {import('pixi.js').Container} entitiesLayer
 */
export function initPlayerRenderer(entitiesLayer) {
  _heroSprite = new Sprite(heroFrames.idle_forward[0]);
  _heroSprite.anchor.set(0.5);

  _weaponSprite = new Sprite();
  _weaponSprite.anchor.set(0.5);
  _weaponSprite.visible = false;

  entitiesLayer.addChild(_heroSprite, _weaponSprite);
}

/**
 * Sync hero + weapon sprites to current game state.
 * @param {object} state  — game state (player, keys, mouse, weaponSlots, activeSlot)
 * @param {number} dt     — delta time in seconds
 */
export function updatePlayerSprite(state, dt) {
  if (!_heroSprite) return;
  const p = state.player;

  // ── Determine movement direction from keys ────────────────
  const k = state.keys || {};
  let mvx = 0, mvy = 0;
  if (k['w'] || k['W'] || k['ц'] || k['Ц'] || k['ArrowUp'])    mvy = -1;
  if (k['s'] || k['S'] || k['ы'] || k['Ы'] || k['ArrowDown'])  mvy =  1;
  if (k['a'] || k['A'] || k['ф'] || k['Ф'] || k['ArrowLeft'])  mvx = -1;
  if (k['d'] || k['D'] || k['в'] || k['В'] || k['ArrowRight']) mvx =  1;

  if (p.isDashing) {
    mvx = p.dashDirX;
    mvy = p.dashDirY;
  }

  const mouseDx = state.mouse.x - p.x;
  const mouseDy = state.mouse.y - p.y;

  // ── Advance animation ─────────────────────────────────────
  const { key, flip } = _getAnimKey(mvx, mvy, mouseDx, mouseDy);

  if (key !== _anim.key) {
    _anim.key   = key;
    _anim.frame = 0;
    _anim.timer = 0;
  }
  _anim.flip = flip;

  const animDef  = HERO_ANIMS[key];
  _anim.timer   += dt;
  const frameDur  = 1 / animDef.fps;
  while (_anim.timer >= frameDur) {
    _anim.timer -= frameDur;
    _anim.frame  = (_anim.frame + 1) % animDef.frames;
  }

  // ── Apply to sprite ───────────────────────────────────────
  const tex = heroFrames[key]?.[_anim.frame];
  if (tex && _heroSprite.texture !== tex) _heroSprite.texture = tex;

  const drawSize = CONFIG.PLAYER_SPRITE_RADIUS * 2;
  const s = drawSize / HERO_SW;
  _heroSprite.scale.x  = (flip ? -1 : 1) * s;
  _heroSprite.scale.y  = s;
  _heroSprite.x = p.x;
  _heroSprite.y = p.y;

  // Blink during invulnerability
  _heroSprite.visible =
    p.invulnerable <= 0 || Math.floor(p.invulnerable * 10) % 2 === 0;

  // ── Weapon ────────────────────────────────────────────────
  _updateWeapon(state, p, mouseDx, mouseDy, drawSize);
}

/**
 * Remove and destroy player sprites.
 */
export function destroyPlayerRenderer() {
  _heroSprite?.destroy();
  _weaponSprite?.destroy();
  _heroSprite   = null;
  _weaponSprite = null;
  _anim.key   = 'idle_forward';
  _anim.frame = 0;
  _anim.timer = 0;
  _anim.flip  = false;
}

// ── Private helpers ───────────────────────────────────────────

function _updateWeapon(state, p, mouseDx, mouseDy, heroDrawSize) {
  const weaponId = state.weaponSlots?.[state.activeSlot];
  if (!weaponId || !weaponTextures[weaponId]) {
    _weaponSprite.visible = false;
    return;
  }

  const wDef       = WEAPON_DEFS[weaponId];
  const spriteAngle = wDef?.spriteAngle ?? 0;
  const aimAngle    = Math.atan2(mouseDy, mouseDx);
  const wDrawSize   = heroDrawSize * 0.6;
  const ws          = wDrawSize / _weaponSprite.texture.width;

  // Weapon texture
  if (_weaponSprite.texture !== weaponTextures[weaponId]) {
    _weaponSprite.texture = weaponTextures[weaponId];
  }

  // Position: offset from player centre in aim direction
  const offsetDist   = heroDrawSize * 0.3;
  _weaponSprite.x    = p.x + Math.cos(aimAngle) * offsetDist;
  _weaponSprite.y    = p.y + Math.sin(aimAngle) * offsetDist;
  _weaponSprite.rotation = aimAngle + spriteAngle;

  // Flip vertically when aiming left half
  const flipY = aimAngle > Math.PI / 2 || aimAngle < -Math.PI / 2;
  _weaponSprite.scale.set(ws, flipY ? -ws : ws);
  _weaponSprite.visible = _heroSprite.visible;
}

/**
 * Determine animation key + horizontal flip from movement + aim direction.
 * Mirrors original getPlayerAnimKey() from game-state.js.
 */
function _getAnimKey(mvx, mvy, mouseDx, mouseDy) {
  const moving = (mvx !== 0 || mvy !== 0);
  const a      = Math.atan2(mouseDy, mouseDx);

  let dir;
  if      (a > -Math.PI / 4 && a <=  Math.PI / 4)           dir = 'right';
  else if (a >  Math.PI / 4 && a <=  3 * Math.PI / 4)       dir = 'down';
  else if (a > -3 * Math.PI / 4 && a <= -Math.PI / 4)       dir = 'up';
  else                                                        dir = 'left';

  let key, flip = false;
  if (moving) {
    if      (dir === 'right') { key = 'run_left';    flip = true;  }
    else if (dir === 'left')  { key = 'run_left';    flip = false; }
    else if (dir === 'up')    { key = 'run_back';    flip = false; }
    else                      { key = 'run_forward'; flip = false; }
  } else {
    if      (dir === 'right') { key = 'idle_left';    flip = true;  }
    else if (dir === 'left')  { key = 'idle_left';    flip = false; }
    else if (dir === 'up')    { key = 'idle_back';    flip = false; }
    else                      { key = 'idle_forward'; flip = false; }
  }
  return { key, flip };
}
