// ============================================================
// LIGHTING — dynamic raycasting light from player
//
// initLighting(container)     — create darkness + light overlay
// updateLighting(playerX, playerY, removedWalls, segments) — raycast every frame
// destroyLighting()           — cleanup
// ============================================================

import { Graphics, Texture, Sprite } from 'pixi.js';

const LIGHT_RADIUS = CONFIG.LIGHT_RADIUS;
const RAY_COUNT = CONFIG.LIGHT_RAY_COUNT;
const RAY_STEP = (Math.PI * 2) / RAY_COUNT;
const DARKNESS_SIZE = 4000; // large enough to cover screen in world space

// Module state
let _container = null;
let _darknessGraphics = null;
let _darknessSprite = null;
let _maskGraphics = null;
let _lightSprite = null;
let _gradientTexture = null;
let _darknessTexture = null;
let _lastPlayerX = null;
let _lastPlayerY = null;
let _cachedRemovedWalls = null;

// Create radial gradient texture (warm yellow center -> transparent edge)
function _createGradientTexture() {
  const size = LIGHT_RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const centerX = size / 2;
  const centerY = size / 2;

  const r = parseInt(CONFIG.LIGHT_COLOR.slice(1, 3), 16);
  const g = parseInt(CONFIG.LIGHT_COLOR.slice(3, 5), 16);
  const b = parseInt(CONFIG.LIGHT_COLOR.slice(5, 7), 16);

  // Radial gradient: warm yellow at center -> transparent at edge
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, LIGHT_RADIUS);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${CONFIG.LIGHT_ALPHA_CENTER})`);
  gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${CONFIG.LIGHT_ALPHA_MID})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return Texture.from(canvas);
}

// Create darkness gradient texture (transparent center -> dark edge)
function _createDarknessTexture() {
  const size = LIGHT_RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const centerX = size / 2;
  const centerY = size / 2;

  // Radial gradient: transparent at center -> dark at edge
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, LIGHT_RADIUS);
  gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
  gradient.addColorStop(0.5, `rgba(0, 0, 0, ${CONFIG.LIGHT_DARKNESS_ALPHA * 0.3})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${CONFIG.LIGHT_DARKNESS_ALPHA})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return Texture.from(canvas);
}

// Line-line intersection
function _rayIntersect(rayX, rayY, rayDx, rayDy, segX1, segY1, segX2, segY2) {
  const segDx = segX2 - segX1;
  const segDy = segY2 - segY1;

  const denom = rayDx * segDy - rayDy * segDx;
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((segX1 - rayX) * segDy - (segY1 - rayY) * segDx) / denom;
  const u = ((segX1 - rayX) * rayDy - (segY1 - rayY) * rayDx) / denom;

  if (t >= 0 && u >= 0 && u <= 1) {
    return { x: rayX + t * rayDx, y: rayY + t * rayDy, t };
  }
  return null;
}

// Get closest intersection along ray
function _castRay(rayX, rayY, rayDx, rayDy, segments) {
  let closest = null;
  let closestT = Infinity;

  for (const seg of segments) {
    if (seg.isRemoved) continue;

    const verts = seg.verts;
    const n = verts.length;

    for (let i = 0; i < n; i++) {
      const v1 = verts[i];
      const v2 = verts[(i + 1) % n];
      const hit = _rayIntersect(rayX, rayY, rayDx, rayDy, v1.x, v1.y, v2.x, v2.y);
      if (hit && hit.t < closestT && hit.t > 0.001) {
        closestT = hit.t;
        closest = hit;
      }
    }
  }

  return closest;
}

export function initLighting(container) {
  _container = container;
  _gradientTexture = _createGradientTexture();
  _darknessTexture = _createDarknessTexture();

  // Darkness graphics: large dark rectangle with polygon hole cut out (hard darkness outside walls)
  _darknessGraphics = new Graphics({ label: 'darkness' });
  _container.addChild(_darknessGraphics);

  // Mask graphics for light & darkness sprites (raycast polygon)
  _maskGraphics = new Graphics({ label: 'light-mask' });
  _container.addChild(_maskGraphics);

  // Darkness sprite: radial gradient (transparent center -> dark edge), masked by polygon
  _darknessSprite = new Sprite(_darknessTexture);
  _darknessSprite.anchor.set(0.5);
  _darknessSprite.mask = _maskGraphics;
  _container.addChild(_darknessSprite);

  // Light sprite with gradient texture (centered on player, ADD blend)
  _lightSprite = new Sprite(_gradientTexture);
  _lightSprite.anchor.set(0.5);
  _lightSprite.blendMode = 'add';
  _lightSprite.mask = _maskGraphics;
  _container.addChild(_lightSprite);

  _lastPlayerX = null;
  _lastPlayerY = null;
}

export function updateLighting(playerX, playerY, removedWalls, segments) {
  if (!_darknessGraphics || !_lightSprite || !segments) return;

  // Check if walls changed
  const wallsChanged = _cachedRemovedWalls !== removedWalls ||
    (_cachedRemovedWalls && _cachedRemovedWalls.size !== removedWalls.size);
  if (wallsChanged) {
    _cachedRemovedWalls = removedWalls;
  }

  // Skip if player hasn't moved much AND walls haven't changed
  if (!wallsChanged && _lastPlayerX !== null &&
      Math.abs(playerX - _lastPlayerX) < CONFIG.LIGHT_MOVE_THRESHOLD &&
      Math.abs(playerY - _lastPlayerY) < CONFIG.LIGHT_MOVE_THRESHOLD) return;

  _lastPlayerX = playerX;
  _lastPlayerY = playerY;

  // Update sprite positions (centered on player)
  _lightSprite.position.set(playerX, playerY);
  _darknessSprite.position.set(playerX, playerY);

  // Cast rays in all directions
  const points = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const angle = i * RAY_STEP;
    const rayDx = Math.cos(angle);
    const rayDy = Math.sin(angle);

    const hit = _castRay(playerX, playerY, rayDx, rayDy, segments);

    if (hit) {
      const dx = hit.x - playerX;
      const dy = hit.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > LIGHT_RADIUS) {
        // Cap at LIGHT_RADIUS — wall is beyond light range
        points.push(
          playerX + (dx / dist) * LIGHT_RADIUS,
          playerY + (dy / dist) * LIGHT_RADIUS
        );
      } else {
        points.push(hit.x, hit.y);
      }
    } else {
      points.push(
        playerX + rayDx * LIGHT_RADIUS,
        playerY + rayDy * LIGHT_RADIUS
      );
    }
  }

  // Redraw darkness with polygon hole
  _darknessGraphics.clear();
  _darknessGraphics
    .rect(playerX - DARKNESS_SIZE / 2, playerY - DARKNESS_SIZE / 2, DARKNESS_SIZE, DARKNESS_SIZE)
    .fill({ color: 0x000000, alpha: CONFIG.LIGHT_DARKNESS_ALPHA });

  if (points.length >= 6) {
    _darknessGraphics.poly(points).cut();
  }

  // Redraw mask for light & darkness sprites
  _maskGraphics.clear();
  if (points.length >= 6) {
    _maskGraphics.poly(points).fill({ color: 0xffffff, alpha: 1 });
  }
}

// Force update lighting (call when walls change)
export function forceLightingUpdate() {
  _lastPlayerX = null;
  _lastPlayerY = null;
}

export function destroyLighting() {
  if (_gradientTexture) {
    _gradientTexture.destroy();
    _gradientTexture = null;
  }
  if (_darknessTexture) {
    _darknessTexture.destroy();
    _darknessTexture = null;
  }
  if (_lightSprite) {
    _lightSprite.destroy();
    _lightSprite = null;
  }
  if (_darknessSprite) {
    _darknessSprite.destroy();
    _darknessSprite = null;
  }
  if (_maskGraphics) {
    _maskGraphics.destroy();
    _maskGraphics = null;
  }
  if (_darknessGraphics) {
    _darknessGraphics.destroy();
    _darknessGraphics = null;
  }
  _container = null;
  _lastPlayerX = null;
  _lastPlayerY = null;
  _cachedRemovedWalls = null;
}
