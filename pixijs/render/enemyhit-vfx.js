// ============================================================
// ENEMY HIT VFX — sprite animation when bullet hits enemy
//
// initEnemyHitVfx(layer)    — slice frames, store layer ref
// spawnEnemyHitVfx(x, y)    — play animation at hit point
// updateEnemyHitVfx(dt)     — advance frames, destroy finished
// clearEnemyHitVfx()        — destroy all active sprites
//
// Sprite sheet: top row, 8 frames × 64×64px.
// Globals: CONFIG (from config.js)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';

const FRAME_SIZE = CONFIG.ENEMY_HIT_VFX.frameSize;
const FRAME_COUNT = CONFIG.ENEMY_HIT_VFX.frameCount;
const FPS = CONFIG.ENEMY_HIT_VFX.fps;

let _layer = null;
let _frames = [];
const _active = [];

export function initEnemyHitVfx(layer) {
  _layer = layer;
  _frames = [];

  const tex = Assets.get('enemyhit-vfx');
  if (!tex) return;

  for (let i = 0; i < FRAME_COUNT; i++) {
    _frames.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),
    }));
  }
}

export function spawnEnemyHitVfx(x, y) {
  if (!_layer || _frames.length === 0) return;

  const drawSize = CONFIG.CELL_PX * CONFIG.ENEMY_HIT_VFX.sizeMult;
  const scale = drawSize / FRAME_SIZE;

  const spr = new Sprite(_frames[0]);
  spr.anchor.set(0.5);
  spr.x = x;
  spr.y = y;
  spr.scale.set(scale);

  _layer.addChild(spr);
  _active.push({ sprite: spr, frame: 0, timer: 0 });
}

export function updateEnemyHitVfx(dt) {
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

export function clearEnemyHitVfx() {
  for (const v of _active) v.sprite.destroy();
  _active.length = 0;
}
