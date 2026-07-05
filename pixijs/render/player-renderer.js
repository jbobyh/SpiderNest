// ============================================================
// PLAYER RENDERER
//
// initPlayerRenderer(entitiesLayer) — create hero + weapon sprites
// updatePlayerSprite(state, dt)     — sync to game state each frame
// destroyPlayerRenderer()           — cleanup
//
// Globals used: CONFIG, SPRITE_SHEETS.hero (from config.js)
// ============================================================

import { Sprite } from 'pixi.js';
import { heroFrames, heroHandsFrames, weaponTextures } from './entity-pool.js';
import { getMovementDir } from '../core/input.js';

let _heroSprite   = null;
let _handsSprite  = null;
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

  _handsSprite = new Sprite();
  _handsSprite.anchor.set(0.5);

  _weaponSprite = new Sprite();
  _weaponSprite.anchor.set(0.5);
  _weaponSprite.visible = false;

  entitiesLayer.addChild(_heroSprite, _handsSprite, _weaponSprite);
}

/**
 * Sync hero + weapon sprites to current game state.
 * @param {object} state  — game state (player, keys, mouse, weaponSlots, activeSlot)
 * @param {number} dt     — delta time in seconds
 */
export function updatePlayerSprite(state, dt) {
  if (!_heroSprite) return;
  const p = state.player;

  // ── Determine movement direction ────────────────────────
  let { mvx, mvy } = getMovementDir();

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

  const animDef  = SPRITE_SHEETS.hero.anims[key];
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
  const s = drawSize / SPRITE_SHEETS.hero.sw;
  _heroSprite.scale.x  = (flip ? -1 : 1) * s;
  _heroSprite.scale.y  = s;
  _heroSprite.x = p.x;
  _heroSprite.y = p.y;

  // Blink during invulnerability
  _heroSprite.visible =
    p.invulnerable <= 0 || Math.floor(p.invulnerable * 10) % 2 === 0;

  // ── Hands overlay ─────────────────────────────────────────
  _updateHands(p, mouseDx, mouseDy, drawSize, _heroSprite.visible, _anim.key, _anim.flip);

  // ── Weapon ────────────────────────────────────────────────
  _updateWeapon(state, p, mouseDx, mouseDy, drawSize);
}

/**
 * Remove and destroy player sprites.
 */
export function destroyPlayerRenderer() {
  _heroSprite?.destroy();
  _handsSprite?.destroy();
  _weaponSprite?.destroy();
  _heroSprite   = null;
  _handsSprite  = null;
  _weaponSprite = null;
  _anim.key   = 'idle_forward';
  _anim.frame = 0;
  _anim.timer = 0;
  _anim.flip  = false;
}

// ── Private helpers ───────────────────────────────────────────

function _updateWeapon(state, p, mouseDx, mouseDy, heroDrawSize) {
  if (!CONFIG.DEBUG.showWeapon) {
    _weaponSprite.visible = false;
    return;
  }
  const weaponId = state.weaponSlots?.[state.activeSlot];
  if (!weaponId || !weaponTextures[weaponId]) {
    _weaponSprite.visible = false;
    return;
  }

  const wDef       = WEAPON_DEFS[weaponId];
  const spriteAngle = wDef?.spriteAngle ?? 0;
  const aimAngle    = Math.atan2(mouseDy, mouseDx);
  const wDrawSize   = heroDrawSize * 0.3;
  const ws          = wDrawSize / _weaponSprite.texture.width;

  // Weapon texture
  if (_weaponSprite.texture !== weaponTextures[weaponId]) {
    _weaponSprite.texture = weaponTextures[weaponId];
  }

  // Position: offset from player centre in aim direction
  const offsetDist   = heroDrawSize * 0.3;
  _weaponSprite.x    = p.x + Math.cos(aimAngle) * offsetDist;
  _weaponSprite.y    = p.y + Math.sin(aimAngle) * offsetDist;

  // Flip vertically when aiming left half
  const flipY = aimAngle > Math.PI / 2 || aimAngle < -Math.PI / 2;
  _weaponSprite.rotation = aimAngle + (flipY ? -spriteAngle : spriteAngle);
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

// ── Hands overlay ─────────────────────────────────────────────

// Row 0 = South, Row 1 = North, Row 2 = West (flipped for East)
// Columns within each row: 0=center, 1=+22.5°, 2=+45°, 3=-22.5°, 4=-45°

function _updateHands(p, mouseDx, mouseDy, drawSize, visible, bodyKey, bodyFlip) {
  if (!_handsSprite) return;

  if (mouseDx === 0 && mouseDy === 0) {
    _handsSprite.visible = false;
    return;
  }

  // Determine hands row + flip from body facing
  let row, baseFlip, centerAngle;
  if (bodyKey.includes('forward')) {
    row = 0; baseFlip = false; centerAngle = Math.PI / 2;        // South
  } else if (bodyKey.includes('back')) {
    row = 1; baseFlip = false; centerAngle = -Math.PI / 2;       // North
  } else {
    row = 2; baseFlip = bodyFlip; centerAngle = bodyFlip ? 0 : Math.PI; // East : West
  }

  // Cursor angle relative to body facing center
  const cursorAngle = Math.atan2(mouseDy, mouseDx);
  let offset = cursorAngle - centerAngle;
  while (offset > Math.PI)  offset -= 2 * Math.PI;
  while (offset < -Math.PI) offset += 2 * Math.PI;

  // Mirror offset for flipped (East) row
  if (baseFlip) offset = -offset;

  // Select column: 0=center, 1=+22.5°, 2=+45°, 3=-22.5°, 4=-45°
  const half       = Math.PI / 16;        // 11.25°
  const threeQuart = 3 * Math.PI / 16;    // 33.75°
  let col;
  if      (offset >  threeQuart) col = 2;
  else if (offset >  half)       col = 1;
  else if (offset < -threeQuart) col = 4;
  else if (offset < -half)       col = 3;
  else                           col = 0;

  const tex = heroHandsFrames[row]?.[col];
  if (!tex) {
    _handsSprite.visible = false;
    return;
  }

  if (_handsSprite.texture !== tex) _handsSprite.texture = tex;

  const s = drawSize / SPRITE_SHEETS.heroHands.sw;
  _handsSprite.scale.x = (baseFlip ? -1 : 1) * s;
  _handsSprite.scale.y = s;
  _handsSprite.x = p.x;
  _handsSprite.y = p.y;
  _handsSprite.visible = visible;
}
