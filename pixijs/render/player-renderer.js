// ============================================================
// PLAYER RENDERER
//
// initPlayerRenderer(entitiesLayer) — create hero + weapon sprites
// updatePlayerSprite(state, dt)     — sync to game state each frame
// destroyPlayerRenderer()           — cleanup
//
// Globals used: CONFIG, SPRITE_SHEETS.hero (from config.js)
// ============================================================

import { Sprite, Container, Graphics } from 'pixi.js';
import { heroFrames, heroHandsFrames, weaponTextures, pistolFrames, pistolReloadFrames } from './entity-pool.js';
import { getMovementDir } from '../core/input.js';

let _playerContainer = null;
let _armsBackGfx     = null;
let _armsFrontGfx    = null;
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
  _playerContainer = new Container({ sortableChildren: true });

  _armsBackGfx = new Graphics();
  _armsBackGfx.zIndex = 0;

  _heroSprite = new Sprite(heroFrames.idle_forward[0]);
  _heroSprite.anchor.set(0.5);
  _heroSprite.zIndex = 1;

  _handsSprite = new Sprite();
  _handsSprite.anchor.set(0.5);
  _handsSprite.zIndex = 2;

  _weaponSprite = new Sprite();
  _weaponSprite.anchor.set(0.5);
  _weaponSprite.visible = false;
  _weaponSprite.zIndex = 3;

  _armsFrontGfx = new Graphics();
  _armsFrontGfx.zIndex = 4;

  _playerContainer.addChild(_armsBackGfx, _heroSprite, _handsSprite, _weaponSprite, _armsFrontGfx);
  entitiesLayer.addChild(_playerContainer);
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

  // ── Hands overlay (old system, debug toggle) ─────────────
  if (CONFIG.DEBUG.showOldHands) {
    _updateHands(p, mouseDx, mouseDy, drawSize, _heroSprite.visible, _anim.key, _anim.flip);
  } else {
    _handsSprite.visible = false;
  }

  // ── Weapon ────────────────────────────────────────────────
  _updateWeapon(state, p, mouseDx, mouseDy, drawSize);

  // ── IK arms ───────────────────────────────────────────────
  _updateIKArms(state, p, mouseDx, mouseDy, drawSize, _anim.key, _anim.flip);
}

/**
 * Remove and destroy player sprites.
 */
export function destroyPlayerRenderer() {
  _armsBackGfx?.destroy();
  _armsFrontGfx?.destroy();
  _heroSprite?.destroy();
  _handsSprite?.destroy();
  _weaponSprite?.destroy();
  _playerContainer?.destroy();
  _armsBackGfx   = null;
  _armsFrontGfx  = null;
  _heroSprite   = null;
  _handsSprite  = null;
  _weaponSprite = null;
  _playerContainer = null;
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
  const wDrawSize   = heroDrawSize * (wDef?.spriteScale ?? 0.3);

  // ── Pistol: animated sprite selection ─────────────────────
  let tex;
  let isReloadAnim = false;
  if (weaponId === 'pistol') {
    if (state.weaponReloadAnim > 0 && pistolReloadFrames.length > 0) {
      isReloadAnim = true;
      const progress = 1 - state.weaponReloadAnim / (state.weaponReloadAnimMax || 1);
      const frame = Math.min(34, Math.floor(progress * 35));
      tex = pistolReloadFrames[frame];
    } else if (state.weaponShootAnim > 0 && pistolFrames.length > 0) {
      const progress = 1 - state.weaponShootAnim / (state.weaponShootAnimMax || 1);
      const frame = 1 + Math.min(5, Math.floor(progress * 6));
      tex = pistolFrames[frame];
    } else {
      tex = pistolFrames[0];
    }
  } else {
    tex = weaponTextures[weaponId];
  }

  if (tex && _weaponSprite.texture !== tex) {
    _weaponSprite.texture = tex;
  }

  // Scale: always based on 64px (shoot sprite width)
  const ws = wDrawSize / 64;

  // Reload offset: anchor.x = 0.7 shifts 80px sprite 16px left in local space
  _weaponSprite.anchor.x = isReloadAnim ? 0.58 : 0.5;
  _weaponSprite.anchor.y = isReloadAnim ? 0.35 : 0.5;

  // Position: offset from player centre in aim direction
  const offsetDist   = heroDrawSize * (wDef?.spriteOffset ?? 0.3);
  const pivotY       = wDef?.spritePivotY ?? 0;
  _weaponSprite.x    = p.x + Math.cos(aimAngle) * offsetDist;
  _weaponSprite.y    = p.y + Math.sin(aimAngle) * offsetDist + pivotY;

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

// ── IK Arms ────────────────────────────────────────────────────

const ARM_COLORS = {
  left:  { upper: 0x88aaff, forearm: 0x5588dd },
  right: { upper: 0xff88aa, forearm: 0xdd5588 },
};

function _getFacingDir(bodyKey, bodyFlip) {
  if (bodyKey.includes('forward')) return 'south';
  if (bodyKey.includes('back'))    return 'north';
  return bodyFlip ? 'east' : 'west';
}

function _solveIK(shoulderX, shoulderY, targetX, targetY, L1, L2, bendSign) {
  const dx = targetX - shoulderX;
  const dy = targetY - shoulderY;
  let dist = Math.hypot(dx, dy);
  const maxReach = L1 + L2 - 0.01;
  const minReach = Math.abs(L1 - L2) + 0.01;
  if (dist > maxReach) dist = maxReach;
  if (dist < minReach) dist = minReach;

  const cosElbow = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)));
  const elbowAngle = Math.acos(cosElbow) * bendSign;
  const baseAngle = Math.atan2(dy, dx);
  const elbowDir = baseAngle + elbowAngle;

  return {
    elbowX: shoulderX + Math.cos(elbowDir) * L1,
    elbowY: shoulderY + Math.sin(elbowDir) * L1,
  };
}

function _drawArmSegment(gfx, x1, y1, x2, y2, w, h, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hh = h / 2;
  const px = cos * w;
  const py = sin * w;
  const nx = -sin * hh;
  const ny = cos * hh;
  gfx.poly([
    x1 + nx,       y1 + ny,
    x1 + px + nx,  y1 + py + ny,
    x1 + px - nx,  y1 + py - ny,
    x1 - nx,       y1 - ny,
  ]).fill(color);
}

function _updateIKArms(state, p, mouseDx, mouseDy, drawSize, bodyKey, bodyFlip) {
  if (!_armsBackGfx || !_armsFrontGfx) return;
  _armsBackGfx.clear();
  _armsFrontGfx.clear();

  if (!CONFIG.DEBUG.showIKArms) return;
  if (!_heroSprite.visible) return;

  const weaponId = state.weaponSlots?.[state.activeSlot];
  const wDef = weaponId ? WEAPON_DEFS[weaponId] : null;
  if (!wDef) return;

  const facing = _getFacingDir(bodyKey, bodyFlip);
  const anchors = CONFIG.PLAYER_ARM_ANCHORS[facing];
  if (!anchors) return;

  const aimAngle = Math.atan2(mouseDy, mouseDx);
  const flipY = aimAngle > Math.PI / 2 || aimAngle < -Math.PI / 2;
  const spriteAngle = wDef.spriteAngle ?? 0;
  const weaponAngle = aimAngle + (flipY ? -spriteAngle : spriteAngle);
  const wDrawSize = drawSize * (wDef.spriteScale ?? 0.3);
  const ws = wDrawSize / 64;
  const offsetDist = drawSize * (wDef.spriteOffset ?? 0.3);
  const pivotY = wDef.spritePivotY ?? 0;

  const weaponCx = p.x + Math.cos(aimAngle) * offsetDist;
  const weaponCy = p.y + Math.sin(aimAngle) * offsetDist + pivotY;

  const cos = Math.cos(weaponAngle);
  const sin = Math.sin(weaponAngle);

  function gripWorld(grip) {
    const gx = grip.x * ws;
    const gy = grip.y * ws;
    return {
      x: weaponCx + cos * gx - sin * gy,
      y: weaponCy + sin * gx + cos * gy,
    };
  }

  const scale = drawSize / 28;

  const bendMap = {
    south: { left:  -1, right:  1 },
    north: { left:  1, right:  -1 },
    west:  { left: -1, right: -1 },
    east:  { left:  1, right:  1 },
  };
  const bend = bendMap[facing];

  const zOrder = {
    south: { left: 'front', right: 'front' },
    north: { left: 'back',  right: 'back'  },
    west:  { left: 'front', right: 'back'  },
    east:  { left: 'back',  right: 'front' },
  };
  const z = zOrder[facing];

  for (const side of ['left', 'right']) {
    const grip = wDef.gripLeft && side === 'left' ? wDef.gripLeft : wDef.gripRight;
    if (!grip) continue;

    const anchor = anchors[side];
    const sx = p.x + anchor.x * scale;
    const sy = p.y + anchor.y * scale;
    const target = gripWorld(grip);

    const { elbowX, elbowY } = _solveIK(sx, sy, target.x, target.y, CONFIG.ARM_UPPER.w * scale, CONFIG.ARM_FOREARM.w * scale, bend[side]);

    const gfx = z[side] === 'front' ? _armsFrontGfx : _armsBackGfx;
    const colors = ARM_COLORS[side];
    _drawArmSegment(gfx, sx, sy, elbowX, elbowY, CONFIG.ARM_UPPER.w * scale, CONFIG.ARM_UPPER.h * scale, colors.upper);
    _drawArmSegment(gfx, elbowX, elbowY, target.x, target.y, CONFIG.ARM_FOREARM.w * scale, CONFIG.ARM_FOREARM.h * scale, colors.forearm);
  }
}
