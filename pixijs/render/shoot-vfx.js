// ============================================================
// SHOOT VFX — muzzle flash sprite animation from shoot-vfx.png
//
// initShootVfx(layer)      — slice frames, store layer ref
// spawnShootVfx(x, y, ang) — play 9-frame animation at position
// updateShootVfx(dt)       — advance frames, destroy finished
// clearShootVfx()          — destroy all active sprites
//
// Sprite sheet: 9×9 grid, 64×64px per frame. Uses top row only.
// Globals: CONFIG (from config.js)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';

const FRAME_SIZE = CONFIG.SHOOT_VFX.frameSize;
const FRAME_COUNT = CONFIG.SHOOT_VFX.frameCount;
const FPS = CONFIG.SHOOT_VFX.fps;

let _layer = null;
let _frames = [];
const _active = [];

export function initShootVfx(layer) {
  _layer = layer;
  _frames = [];

  const tex = Assets.get('shoot-vfx');
  if (!tex) return;

  for (let i = 0; i < FRAME_COUNT; i++) {
    _frames.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),
    }));
  }
}

export function spawnShootVfx(x, y, aimAngle) {
  if (!_layer || _frames.length === 0) return;

  const drawSize = CONFIG.PLAYER_SPRITE_RADIUS * 2 * CONFIG.SHOOT_VFX.sizeMult;
  const scale = drawSize / FRAME_SIZE;

  const spr = new Sprite(_frames[0]);
  spr.anchor.set(0.5);
  spr.x = x;
  spr.y = y;
  spr.rotation = aimAngle + CONFIG.SHOOT_VFX.rotationOffset;
  spr.scale.set(scale);

  _layer.addChild(spr);
  _active.push({ sprite: spr, frame: 0, timer: 0 });
}

export function updateShootVfx(dt) {
  const frameDur = 1 / FPS;

  for (let i = _active.length - 1; i >= 0; i--) {
    const v = _active[i];
    v.timer += dt;

    while (v.timer >= frameDur) {
      v.timer -= frameDur;
      v.frame++;
      if (v.frame >= FRAME_COUNT) {
        v.sprite.destroy();
        _active.splice(i, 1);
        break;
      }
      v.sprite.texture = _frames[v.frame];
    }
  }
}

export function clearShootVfx() {
  for (const v of _active) v.sprite.destroy();
  _active.length = 0;
}
