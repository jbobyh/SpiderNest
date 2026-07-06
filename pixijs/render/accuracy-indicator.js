// ============================================================
// ACCURACY INDICATOR — visualizes weapon spread near cursor
//
// initAccuracyIndicator(parentContainer)
// updateAccuracyIndicator(state, camera)
// destroyAccuracyIndicator()
//
// Draws two tilted lines at cursor distance, marking the cone
// edges where bullets can land. Screen-space (HUD layer).
// ============================================================

import { Graphics } from 'pixi.js';
import { getActiveWeapon, getTotalSpread, getBulletRange } from '../game/combat.js';

let _gfx = null;
let _parent = null;

export function initAccuracyIndicator(parentContainer) {
  _parent = parentContainer;
  _gfx = new Graphics();
  _gfx.visible = false;
  _parent.addChild(_gfx);
}

export function updateAccuracyIndicator(state, camera) {
  if (!_gfx) return;

  const cfg = CONFIG.ACCURACY_INDICATOR;
  const weapon = getActiveWeapon(state);
  if (!weapon || !state.player || !state.mouse) {
    _gfx.visible = false;
    return;
  }

  const totalSpread = getTotalSpread(state);
  if (totalSpread < cfg.minSpread) {
    _gfx.visible = false;
    return;
  }

  const px = state.player.x;
  const py = state.player.y;
  const mx = state.mouse.x;
  const my = state.mouse.y;

  const baseAngle = Math.atan2(my - py, mx - px);
  const dist = Math.hypot(mx - px, my - py);
  if (dist < 1) {
    _gfx.visible = false;
    return;
  }

  const scale = state.battle ? (CONFIG.BATTLE_SCALE || 1) : 1;
  const bulletRange = getBulletRange(state, weapon, scale);
  const effectiveDist = Math.min(dist, bulletRange);
  const isClamped = dist > bulletRange;

  const halfSpread = totalSpread / 2;
  const leftAngle  = baseAngle - halfSpread;
  const rightAngle = baseAngle + halfSpread;

  // World-space cone edge points at effective distance
  const lx = px + Math.cos(leftAngle)  * effectiveDist;
  const ly = py + Math.sin(leftAngle)  * effectiveDist;
  const rx = px + Math.cos(rightAngle) * effectiveDist;
  const ry = py + Math.sin(rightAngle) * effectiveDist;

  // Project cone edge points and player to screen-space
  const ls = camera.worldToScreen(lx, ly);
  const rs = camera.worldToScreen(rx, ry);
  const ps = camera.worldToScreen(px, py);

  // Direction from player to each cone edge (screen-space) = cone edge ray direction
  const lDx = ls.x - ps.x;
  const lDy = ls.y - ps.y;
  const lLen = Math.hypot(lDx, lDy);
  const rDx = rs.x - ps.x;
  const rDy = rs.y - ps.y;
  const rLen = Math.hypot(rDx, rDy);
  if (lLen < 1 || rLen < 1) {
    _gfx.visible = false;
    return;
  }

  // Unit vectors along each cone edge (from player outward)
  const lux = lDx / lLen, luy = lDy / lLen;
  const rux = rDx / rLen, ruy = rDy / rLen;

  const halfLen = cfg.lineLength / 2;
  const color = 0xffffff;

  _gfx.clear();
  _gfx.visible = true;

  const strokeOpts = { width: cfg.lineWidth, color, alpha: cfg.alpha };

  // Left mark: oriented along left cone edge, near end toward player
  const lNearX = ls.x - lux * halfLen, lNearY = ls.y - luy * halfLen;
  const lFarX  = ls.x + lux * halfLen, lFarY  = ls.y + luy * halfLen;
  _gfx.moveTo(lNearX, lNearY);
  _gfx.lineTo(lFarX, lFarY);
  if (isClamped) {
    // L-bend: perpendicular toward right (inward)
    _gfx.lineTo(lFarX - luy * cfg.bendLength, lFarY + lux * cfg.bendLength);
  }
  _gfx.stroke(strokeOpts);

  // Right mark: oriented along right cone edge, near end toward player
  const rNearX = rs.x - rux * halfLen, rNearY = rs.y - ruy * halfLen;
  const rFarX  = rs.x + rux * halfLen, rFarY  = rs.y + ruy * halfLen;
  _gfx.moveTo(rNearX, rNearY);
  _gfx.lineTo(rFarX, rFarY);
  if (isClamped) {
    // L-bend: perpendicular toward left (inward)
    _gfx.lineTo(rFarX + ruy * cfg.bendLength, rFarY - rux * cfg.bendLength);
  }
  _gfx.stroke(strokeOpts);
}

export function destroyAccuracyIndicator() {
  if (_gfx) {
    _gfx.destroy({ children: true });
    _gfx = null;
  }
  _parent = null;
}
