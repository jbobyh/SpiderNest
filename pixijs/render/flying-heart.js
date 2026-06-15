// ============================================================
// FLYING HEART RENDERER
//
// Renders the flying heart animation in world space.
// Call syncFlyingHeart() every frame.
// ============================================================

import { Sprite, Texture } from 'pixi.js';
import { getFlyingHeart } from '../game/walls.js';

let _heartSprite = null;

/**
 * Initialize flying heart sprite in the given container.
 * @param {import('pixi.js').Container} container
 */
export function initFlyingHeartRenderer(container) {
  _heartSprite = new Sprite(Texture.from('heart'));
  _heartSprite.anchor.set(0.5);
  _heartSprite.visible = false;
  container.addChild(_heartSprite);
}

/**
 * Update flying heart sprite position.
 * Call every frame.
 */
export function syncFlyingHeart() {
  const fh = getFlyingHeart();
  if (!fh || !_heartSprite) {
    if (_heartSprite) _heartSprite.visible = false;
    return;
  }

  _heartSprite.visible = true;
  _heartSprite.x = fh.x;
  _heartSprite.y = fh.y;
  _heartSprite.scale.set(0.8);
}

/**
 * Cleanup flying heart renderer.
 */
export function destroyFlyingHeartRenderer() {
  if (_heartSprite) {
    _heartSprite.destroy();
    _heartSprite = null;
  }
}
