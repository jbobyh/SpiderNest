// ============================================================
// DARKNESS OVERLAY — Canvas2D-based darkness with light holes.
// Uses globalCompositeOperation='destination-out' for reliable
// hole-punching without Graphics cut() artifacts.
// Lives in screen-space between world and HUD.
// ============================================================

import { Container, Sprite, Texture } from 'pixi.js';

const { LIGHT_RADIUS, DARKNESS_ALPHA, LIGHT_GRADIENT_FULL } = CONFIG.TORCH_MODE;

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

let _overlay = null;
let _canvas = null;
let _ctx = null;
let _texture = null;
let _sprite = null;

export function initDarknessOverlay() {
  if (_overlay) return _overlay;

  _canvas = document.createElement('canvas');
  _canvas.width = VW;
  _canvas.height = VH;
  _ctx = _canvas.getContext('2d');

  _texture = Texture.from(_canvas);
  _sprite = new Sprite(_texture);

  _overlay = new Container({ label: 'darkness' });
  _overlay.addChild(_sprite);
  _overlay.visible = false;
  return _overlay;
}

export function getDarknessOverlay() {
  return _overlay;
}

export function updateDarknessOverlay(state, camera) {
  if (!_overlay || !_ctx) return;
  if (!state.torchMode) {
    _overlay.visible = false;
    return;
  }

  _overlay.visible = true;

  // 1. Fill entire canvas with darkness
  _ctx.globalCompositeOperation = 'source-over';
  _ctx.fillStyle = `rgba(0,0,0,${DARKNESS_ALPHA})`;
  _ctx.fillRect(0, 0, VW, VH);

  // 2. Erase light holes with destination-out + radial gradient
  _ctx.globalCompositeOperation = 'destination-out';

  // Player emits light while holding >=1 torch
  if (state.player.lives > 0) {
    const screen = camera.worldToScreen(state.player.x, state.player.y);
    _punchLight(_ctx, screen.x, screen.y, LIGHT_RADIUS * camera.zoom);
  }

  // Ground torches
  for (const torch of (state.torches || [])) {
    const screen = camera.worldToScreen(torch.x, torch.y);
    _punchLight(_ctx, screen.x, screen.y, torch.radius * camera.zoom);
  }

  // 3. Update texture (PixiJS v8: update source to re-upload to GPU)
  _texture.source.update();
}

function _punchLight(ctx, x, y, r) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(LIGHT_GRADIENT_FULL, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function destroyDarknessOverlay() {
  if (_overlay) {
    _overlay.destroy({ children: true });
    _overlay = null;
  }
  if (_texture) {
    _texture.destroy(true);
    _texture = null;
  }
  _sprite = null;
  _canvas = null;
  _ctx = null;
}
