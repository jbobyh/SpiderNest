// ============================================================
// BURN VFX — looping fire animation overlay on burning enemies
//
// initBurnVfx(layer)                    — slice frames, store layer ref
// syncBurnVfx(activeSpiders, dt)        — create/update/destroy fire sprites
// clearBurnVfx()                        — destroy all active sprites
//
// Sprite sheet: top row, 16 frames × 64×64px. Loops at 16 FPS.
// Globals: CONFIG (from config.js)
// ============================================================

import { Sprite, Texture, Rectangle } from 'pixi.js';
import { Assets } from 'pixi.js';
import { hasStatus } from '../game/status-system.js';

const FRAME_SIZE  = CONFIG.BURN_VFX.frameSize;
const FRAME_COUNT = CONFIG.BURN_VFX.frameCount;
const FPS         = CONFIG.BURN_VFX.fps;

let _layer  = null;
let _frames = [];
const _map  = new Map(); // enemy → { sprite, timer }

export function initBurnVfx(layer) {
  _layer  = layer;
  _frames = [];

  const tex = Assets.get('firestatus-vfx');
  if (!tex) return;

  for (let i = 0; i < FRAME_COUNT; i++) {
    _frames.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),
    }));
  }
}

export function syncBurnVfx(activeSpiders, dt) {
  if (!_layer || _frames.length === 0) return;

  const frameDur = 1 / FPS;

  // Remove entries for enemies no longer in activeSpiders or without burn
  for (const [g, entry] of _map) {
    if (!activeSpiders.includes(g) || !hasStatus(g, 'burn') || g.isDead) {
      entry.sprite.destroy();
      _map.delete(g);
    }
  }

  for (const g of activeSpiders) {
    if (g.isDead || !hasStatus(g, 'burn')) continue;

    let entry = _map.get(g);
    if (!entry) {
      const spr = new Sprite(_frames[0]);
      spr.anchor.set(0.5);
      _layer.addChild(spr);
      entry = { sprite: spr, timer: 0 };
      _map.set(g, entry);
    }

    const spr = entry.sprite;
    spr.x = g.x;
    spr.y = g.y;

    const drawSize = (g.radius ?? CONFIG.ENEMY_STATS.soldier.radius) * (g.visualScale ?? CONFIG.ENEMY_STATS.soldier.visualScale);
    const scale = drawSize / FRAME_SIZE;
    spr.scale.set(scale);

    entry.timer += dt;
    const frame = Math.floor(entry.timer / frameDur) % FRAME_COUNT;
    const tex = _frames[frame];
    if (spr.texture !== tex) spr.texture = tex;
  }
}

export function clearBurnVfx() {
  for (const { sprite } of _map.values()) {
    sprite.destroy();
  }
  _map.clear();
}
