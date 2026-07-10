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
import { heroFrames, heroHandsFrames, heroLegsFrames, weaponTextures, pistolFrames, pistolReloadFrames, smgFrames, smgReloadFrames, armTextures } from './entity-pool.js';
import { getMovementDir } from '../core/input.js';

let _playerContainer = null;
let _armsBackGfx     = null;
let _armsFrontGfx    = null;
let _dbgGfx         = null;
let _heroSprite   = null;
let _legsSprite   = null;
let _handsSprite  = null;
let _weaponSprite = null;

// IK arm sprites: upperL, foreL, upperR, foreR
let _armSprites = null;
let _armSouthSprites = null;
let _weaponFlipState = false;

const _anim = {
  key:   'idle_forward',
  frame: 0,
  timer: 0,
  flip:  false,
};

const _legsAnim = {
  row:   0,
  col:   0,
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

  _legsSprite = new Sprite(heroLegsFrames[0]?.[0] ?? undefined);
  _legsSprite.anchor.set(0.5);
  _legsSprite.zIndex = 0.5;

  _heroSprite = new Sprite(heroFrames.idle_forward[0]);
  _heroSprite.anchor.set(0.5);
  _heroSprite.zIndex = 1;

  _handsSprite = new Sprite();
  _handsSprite.anchor.set(0.5);
  _handsSprite.zIndex = 2;

  _weaponSprite = new Sprite();
  _weaponSprite.anchor.set(0.5);
  _weaponSprite.visible = false;
  _weaponSprite.zIndex = 5;

  _armsFrontGfx = new Graphics();
  _armsFrontGfx.zIndex = 4;

  _dbgGfx = new Graphics();
  _dbgGfx.zIndex = 100;

  // IK arm sprites — west/east (anchor at right edge = root joint)
  _armSprites = {};
  for (const side of ['left', 'right']) {
    const upper = new Sprite(armTextures.upper);
    upper.anchor.set(CONFIG.ARM_UPPER_PIVOT ?? 1, 0.5);
    upper.visible = false;
    const fore = new Sprite(armTextures.forearm);
    fore.anchor.set(1 - (CONFIG.ARM_FOREARM_PIVOT ?? 1), 0.5);
    fore.visible = false;
    _armSprites[side] = { upper, fore };
    _playerContainer.addChild(upper, fore);
  }

  // IK arm sprites — south (anchor at top edge = root joint, sprite points down)
  _armSouthSprites = {};
  for (const side of ['left', 'right']) {
    const upper = new Sprite(armTextures.southUpper);
    upper.anchor.set(0.5, CONFIG.ARM_SOUTH_UPPER_PIVOT ?? 0.2);
    upper.visible = false;
    const fore = new Sprite(armTextures.southForearm);
    fore.anchor.set(0.5, 1 - (CONFIG.ARM_SOUTH_FOREARM_PIVOT ?? 0.2));
    fore.visible = false;
    _armSouthSprites[side] = { upper, fore };
    _playerContainer.addChild(upper, fore);
  }

  _playerContainer.addChild(_armsBackGfx, _legsSprite, _heroSprite, _handsSprite, _weaponSprite, _armsFrontGfx, _dbgGfx);
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

  // ── Legs animation ───────────────────────────────────────
  const facing = _getFacingDir(_anim.key, _anim.flip);
  _updateLegs(p, dt, drawSize, facing, _heroSprite.visible);

  // ── Hands overlay (old system, debug toggle) ─────────────
  const skipOldHands = (facing === 'west' || facing === 'east' || facing === 'south' || facing === 'north');
  if (CONFIG.DEBUG.showOldHands && !skipOldHands) {
    _updateHands(p, mouseDx, mouseDy, drawSize, _heroSprite.visible, _anim.key, _anim.flip);
  } else {
    _handsSprite.visible = false;
  }

  // ── Weapon ────────────────────────────────────────────────
  _updateWeapon(state, p, mouseDx, mouseDy, drawSize, facing);

  // ── IK arms ───────────────────────────────────────────────
  _updateIKArms(state, p, mouseDx, mouseDy, drawSize, _anim.key, _anim.flip);
}

/**
 * Remove and destroy player sprites.
 */
export function destroyPlayerRenderer() {
  _armsBackGfx?.destroy();
  _armsFrontGfx?.destroy();
  _dbgGfx?.destroy();
  _heroSprite?.destroy();
  _legsSprite?.destroy();
  _handsSprite?.destroy();
  _weaponSprite?.destroy();
  if (_armSprites) {
    _armSprites.left?.upper?.destroy();
    _armSprites.left?.fore?.destroy();
    _armSprites.right?.upper?.destroy();
    _armSprites.right?.fore?.destroy();
  }
  if (_armSouthSprites) {
    _armSouthSprites.left?.upper?.destroy();
    _armSouthSprites.left?.fore?.destroy();
    _armSouthSprites.right?.upper?.destroy();
    _armSouthSprites.right?.fore?.destroy();
  }
  _armSprites = null;
  _armSouthSprites = null;
  _playerContainer?.destroy();
  _armsBackGfx   = null;
  _armsFrontGfx  = null;
  _dbgGfx         = null;
  _heroSprite   = null;
  _legsSprite   = null;
  _handsSprite  = null;
  _weaponSprite = null;
  _playerContainer = null;
  _anim.key   = 'idle_forward';
  _anim.frame = 0;
  _anim.timer = 0;
  _anim.flip  = false;
  _legsAnim.row  = 0;
  _legsAnim.col  = 0;
  _legsAnim.timer = 0;
  _legsAnim.flip = false;
  _weaponFlipState = false;
}

// ── Private helpers ───────────────────────────────────────────

function _updateWeapon(state, p, mouseDx, mouseDy, heroDrawSize, facing) {
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
  } else if (weaponId === 'smg') {
    if (state.weaponReloadAnim > 0 && smgReloadFrames.length > 0) {
      isReloadAnim = true;
      const progress = 1 - state.weaponReloadAnim / (state.weaponReloadAnimMax || 1);
      const frame = Math.min(27, Math.floor(progress * 28));
      tex = smgReloadFrames[frame];
    } else if (state.weaponShootAnim > 0 && smgFrames.length > 0) {
      const progress = 1 - state.weaponShootAnim / (state.weaponShootAnimMax || 1);
      const frame = 1 + Math.min(5, Math.floor(progress * 6));
      tex = smgFrames[frame];
    } else {
      tex = smgFrames[0];
    }
  } else {
    tex = weaponTextures[weaponId];
  }

  if (tex && _weaponSprite.texture !== tex) {
    _weaponSprite.texture = tex;
  }

  // Scale: based on sprite width (64px pistol, 80px smg, fallback 64)
  const spriteW = wDef?.spriteWidth ?? 64;
  const ws = wDrawSize / spriteW;

  // Reload offset: anchor.x = 0.7 shifts 80px sprite 16px left in local space
  _weaponSprite.anchor.x = isReloadAnim ? 0.58 : 0.5;
  _weaponSprite.anchor.y = isReloadAnim ? 0.35 : 0.5;

  // Position: offset from player centre in aim direction
  const offsetDist   = heroDrawSize * (wDef?.spriteOffset ?? 0.3);
  const pivotY       = wDef?.spritePivotY ?? 0;
  _weaponSprite.x    = p.x + Math.cos(aimAngle) * offsetDist;
  _weaponSprite.y    = p.y + Math.sin(aimAngle) * offsetDist + pivotY;

  // Flip vertically with hysteresis
  const threshold = wDef?.flipThreshold ?? 0.26;
  if (!_weaponFlipState) {
    if (aimAngle > Math.PI / 2 + threshold || aimAngle < -Math.PI / 2 - threshold)
      _weaponFlipState = true;
  } else {
    if (aimAngle < Math.PI / 2 - threshold && aimAngle > -Math.PI / 2 + threshold)
      _weaponFlipState = false;
  }
  const flipY = _weaponFlipState;
  _weaponSprite.rotation = aimAngle + (flipY ? -spriteAngle : spriteAngle);
  _weaponSprite.scale.set(ws, flipY ? -ws : ws);
  _weaponSprite.visible = _heroSprite.visible;

  // Dynamic zIndex: weapon between arms
  const weaponZ = {
    south: 5,   // between arms (4 and 6)
    west:  3,   // between front arm (4) and back arm (0)
    east:  3,
    north: -1,  // between arms (-2 and 0), behind body (1)
  };
  _weaponSprite.zIndex = weaponZ[facing] ?? 5;
}

/**
 * Determine animation key + horizontal flip from movement + aim direction.
 * Mirrors original getPlayerAnimKey() from game-state.js.
 */
function _getAnimKey(mvx, mvy, mouseDx, mouseDy) {
  const moving = (mvx !== 0 || mvy !== 0);
  const a      = Math.atan2(mouseDy, mouseDx);

  const shrink = CONFIG.FACING_SOUTH_SHRINK ?? 0;
  let dir;
  if      (a > -Math.PI / 4 && a <=  Math.PI / 4 + shrink)       dir = 'right';
  else if (a >  Math.PI / 4 + shrink && a <=  3 * Math.PI / 4 - shrink) dir = 'down';
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

// ── Legs animation ─────────────────────────────────────────────

function _updateLegs(p, dt, drawSize, facing, visible) {
  if (!_legsSprite) return;

  // Row: south=0, north=1, west=2, east=2 (flipped)
  const rowMap = { south: 0, north: 1, west: 2, east: 2 };
  const row = rowMap[facing] ?? 0;
  const flip = (facing === 'east');

  // Movement speed from physics body
  const speed = p.body ? Math.hypot(p.body.velocity.x, p.body.velocity.y) : 0;
  const moving = speed > 0.01;

  // Determine animation column
  if (row !== _legsAnim.row || flip !== _legsAnim.flip) {
    _legsAnim.row = row;
    _legsAnim.flip = flip;
    _legsAnim.col = 0;
    _legsAnim.timer = 0;
  }

  if (moving) {
    // Walk cycle: cols 1-4, fps scaled by speed ratio
    const speedRatio = Math.min(3, speed / CONFIG.PLAYER_SPEED);
    const fps = CONFIG.PLAYER_LEGS_WALK_FPS * speedRatio;
    _legsAnim.timer += dt;
    const frameDur = 1 / fps;
    while (_legsAnim.timer >= frameDur) {
      _legsAnim.timer -= frameDur;
      _legsAnim.col = 1 + ((_legsAnim.col - 1 + 1) % 4);
    }
  } else {
    // Idle: col 0
    _legsAnim.col = 0;
    _legsAnim.timer = 0;
  }

  const tex = heroLegsFrames[row]?.[_legsAnim.col];
  if (tex && _legsSprite.texture !== tex) _legsSprite.texture = tex;

  const s = drawSize / SPRITE_SHEETS.heroLegs.sw;
  _legsSprite.scale.x = (flip ? -1 : 1) * s;
  _legsSprite.scale.y = s;
  _legsSprite.x = p.x;
  _legsSprite.y = p.y;
  _legsSprite.visible = visible;
}

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
  if (_dbgGfx) _dbgGfx.clear();

  // Hide all arm sprites by default
  if (_armSprites) {
    for (const side of ['left', 'right']) {
      _armSprites[side].upper.visible = false;
      _armSprites[side].fore.visible = false;
    }
  }
  if (_armSouthSprites) {
    for (const side of ['left', 'right']) {
      _armSouthSprites[side].upper.visible = false;
      _armSouthSprites[side].fore.visible = false;
    }
  }

  if (!CONFIG.DEBUG.showIKArms) return;
  if (!_heroSprite.visible) return;

  const weaponId = state.weaponSlots?.[state.activeSlot];
  const wDef = weaponId ? WEAPON_DEFS[weaponId] : null;
  if (!wDef) return;

  const facing = _getFacingDir(bodyKey, bodyFlip);
  const anchors = CONFIG.PLAYER_ARM_ANCHORS[facing];
  if (!anchors) return;

  const aimAngle = Math.atan2(mouseDy, mouseDx);
  const flipY = _weaponFlipState;
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
    const gy = (flipY ? -grip.y : grip.y) * ws;
    return {
      x: weaponCx + cos * gx - sin * gy,
      y: weaponCy + sin * gx + cos * gy,
    };
  }

  const scale = drawSize / 28;
  const useSprites = (facing === 'west' || facing === 'east' || facing === 'south' || facing === 'north');

  const bendMap = {
    south: { left:  -1, right:  1 },
    north: { left:  1, right:  -1 },
    west:  { left: -1, right: -1 },
    east:  { left:  1, right:  1 },
  };
  const bend = bendMap[facing];

  const zOrder = {
    south: { left: flipY ? 6 : 4, right: flipY ? 4 : 6 },
    north: { left: flipY ? 0 : -2, right: flipY ? -2 : 0 },
    west:  { left: 4, right: 0  },
    east:  { left: 0,  right: 4 },
  };
  const z = zOrder[facing];

  for (const side of ['left', 'right']) {
    const grip = wDef.gripLeft && side === 'left' ? wDef.gripLeft : wDef.gripRight;
    if (!grip) continue;

    const anchor = anchors[side];
    const sx = p.x + anchor.x * scale;
    const sy = p.y + anchor.y * scale;
    const target = gripWorld(grip);

    const L1 = CONFIG.ARM_UPPER.w * scale;
    const L2 = CONFIG.ARM_FOREARM.w * scale;
    const { elbowX, elbowY } = _solveIK(sx, sy, target.x, target.y, L1, L2, bend[side]);

    const zVal = z[side];
    const isFront = zVal >= 4;

    if (useSprites && _armSprites && facing !== 'south' && facing !== 'north') {
      const sprites = _armSprites[side];
      const upper = sprites.upper;
      const fore = sprites.fore;

      const upperAngle = Math.atan2(elbowY - sy, elbowX - sx);
      const foreAngle = Math.atan2(target.y - elbowY, target.x - elbowX);

      const s = scale * (CONFIG.ARM_SPRITE_SCALE ?? 0.3);
      const spriteParams = {
        west:  { scaleX:  s, rotOffset: Math.PI },
        east:  { scaleX: -s, rotOffset: 0 },
      };
      const { scaleX, rotOffset } = spriteParams[facing];

      upper.scale.set(scaleX, s);
      upper.rotation = upperAngle + rotOffset;
      upper.x = sx;
      upper.y = sy;
      upper.zIndex = zVal;
      upper.visible = true;

      fore.scale.set(scaleX, s);
      fore.rotation = foreAngle + rotOffset;
      fore.x = target.x;
      fore.y = target.y;
      fore.zIndex = zVal;
      fore.visible = true;
    } else if (useSprites && _armSouthSprites && (facing === 'south' || facing === 'north')) {
      const sprites = _armSouthSprites[side];
      const upper = sprites.upper;
      const fore = sprites.fore;

      // Sprite points down (angle = π/2). Rotate to match segment direction.
      const upperAngle = Math.atan2(elbowY - sy, elbowX - sx);
      const foreAngle = Math.atan2(target.y - elbowY, target.x - elbowX);
      const rotOffset = -Math.PI / 2; // sprite default = down = π/2

      const s = scale * (CONFIG.ARM_SPRITE_SCALE ?? 0.3);
      // Left hand = character's left = screen right (as-is), right hand = reflected
      const scaleX = (side === 'right') ? -s : s;

      upper.scale.set(scaleX, s);
      upper.rotation = upperAngle + rotOffset;
      upper.x = sx;
      upper.y = sy;
      upper.zIndex = zVal;
      upper.visible = true;

      fore.scale.set(scaleX, s);
      fore.rotation = foreAngle + rotOffset;
      fore.x = target.x;
      fore.y = target.y;
      fore.zIndex = zVal;
      fore.visible = true;
    } else {
      const gfx = isFront ? _armsFrontGfx : _armsBackGfx;
      const colors = ARM_COLORS[side];
      _drawArmSegment(gfx, sx, sy, elbowX, elbowY, CONFIG.ARM_UPPER.w * scale, CONFIG.ARM_UPPER.h * scale, colors.upper);
      _drawArmSegment(gfx, elbowX, elbowY, target.x, target.y, CONFIG.ARM_FOREARM.w * scale, CONFIG.ARM_FOREARM.h * scale, colors.forearm);
    }

    // Debug bone points
    if (CONFIG.DEBUG.showIKBones) {
      const dbgColor = side === 'left' ? 0x88aaff : 0xff88aa;
      _dbgGfx.circle(sx, sy, 0.5).fill(dbgColor);
      _dbgGfx.circle(elbowX, elbowY, 0.5).fill(dbgColor);
      _dbgGfx.circle(target.x, target.y, 0.5).fill(dbgColor);
    }
  }
}
