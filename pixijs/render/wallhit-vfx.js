// ============================================================
// WALL HIT VFX — sprite animation when bullet hits wall
//
// initWallHitVfx(layer)       — slice frames, store layer ref
// spawnWallHitVfx(x, y, normalAngle) — play animation at hit point
// updateWallHitVfx(dt)        — advance frames, destroy finished
// clearWallHitVfx()           — destroy all active sprites
//
// Sprite sheet: top row, 10 frames × 64×64px.
// Sprite default orientation: effect points UP (bottom faces wall normal).
// Rotation from wall normal (already cardinal from _wallHitPoint).
// Globals: CONFIG (from config.js)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';

const FRAME_SIZE = CONFIG.WALL_HIT_VFX.frameSize;
const FRAME_COUNT = CONFIG.WALL_HIT_VFX.frameCount;
const FPS = CONFIG.WALL_HIT_VFX.fps;

let _layer = null;
let _frames = [];
const _active = [];

export function initWallHitVfx(layer) {
  _layer = layer;
  _frames = [];

  const tex = Assets.get('wallhit-vfx');
  if (!tex) return;

  for (let i = 0; i < FRAME_COUNT; i++) {
    _frames.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),
    }));
  }
}

export function spawnWallHitVfx(x, y, normalAngle) {
  if (!_layer || _frames.length === 0) return;

  const drawSize = CONFIG.CELL_PX * CONFIG.WALL_HIT_VFX.sizeMult;
  const scale = drawSize / FRAME_SIZE;

  // Sprite default: effect points up, bottom faces +Y (down).
  // Rotate so bottom faces wall normal, effect points away from wall.
  const rotation = normalAngle + Math.PI / 2;

  // Offset sprite along normal (away from wall) to compensate for
  // effect being drawn in lower portion of the sprite frame.
  const offset = drawSize * (CONFIG.WALL_HIT_VFX.normalOffset ?? 0);
  const ox = Math.cos(normalAngle) * offset;
  const oy = Math.sin(normalAngle) * offset;

  const spr = new Sprite(_frames[0]);
  spr.anchor.set(0.5);
  spr.x = x + ox;
  spr.y = y + oy;
  spr.rotation = rotation;
  spr.scale.set(scale);

  _layer.addChild(spr);
  _active.push({ sprite: spr, frame: 0, timer: 0 });
}

export function updateWallHitVfx(dt) {
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

export function clearWallHitVfx() {
  for (const v of _active) v.sprite.destroy();
  _active.length = 0;
}
