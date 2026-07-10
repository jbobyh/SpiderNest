// ============================================================
// TORCH RENDERER — renders torch sprites on the ground
// Lives in world-space (added to camera.container layers)
// ============================================================

import { Container, Graphics } from 'pixi.js';

let _layer = null;
let _torchGraphics = null;

export function initTorchRenderer(layer) {
  _layer = layer;
  _torchGraphics = new Graphics();
  _layer.addChild(_torchGraphics);
}

export function syncTorches(torches) {
  if (!_torchGraphics) return;
  _torchGraphics.clear();

  for (const torch of (torches || [])) {
    // Torch base — small dark circle
    _torchGraphics.circle(torch.x, torch.y, 8);
    _torchGraphics.fill({ color: 0x4a2a10 });

    // Flame — orange/yellow circle
    _torchGraphics.circle(torch.x, torch.y - 4, 6);
    _torchGraphics.fill({ color: 0xff8800 });

    // Inner flame — bright yellow
    _torchGraphics.circle(torch.x, torch.y - 6, 3);
    _torchGraphics.fill({ color: 0xffdd44 });
  }
}

export function clearTorchRenderer() {
  if (_torchGraphics) {
    _torchGraphics.clear();
  }
  if (_layer && _torchGraphics) {
    _layer.removeChild(_torchGraphics);
    _torchGraphics.destroy();
    _torchGraphics = null;
  }
  _layer = null;
}
