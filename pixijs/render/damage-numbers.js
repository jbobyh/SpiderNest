import { Container, Text, TextStyle } from 'pixi.js';

let _container = null;
const _pool = [];
const _active = new Map();

const MAX_ACTIVE = 64;
const FONT_SIZE = 16;
const LIFE = 0.8;
const RISE_SPEED = 30;
const DAMP = 0.95;

export function initDamageNumbers(layer) {
  _container = new Container({ label: 'damageNumbers' });
  layer.addChild(_container);
}

export function spawnDamageNumber(state, x, y, damage, isCrit, scale = 1) {
  const arr = state.damageNumbers;
  if (arr.length >= MAX_ACTIVE) {
    arr.shift();
  }
  arr.push({
    x,
    y,
    vy: -RISE_SPEED * scale,
    text: String(damage),
    life: LIFE,
    maxLife: LIFE,
    color: isCrit ? '#ff4400' : '#ffffff',
    scale: isCrit ? 1.3 : 1.0,
  });
}

export function updateAndSyncDamageNumbers(state, dt, camera) {
  if (!_container || !camera) return;

  const arr = state.damageNumbers;
  for (let i = arr.length - 1; i >= 0; i--) {
    const dn = arr[i];
    dn.y += dn.vy * dt;
    dn.vy *= DAMP;
    dn.life -= dt;
    if (dn.life <= 0) {
      arr.splice(i, 1);
    }
  }

  for (const [dn, text] of _active) {
    if (!arr.includes(dn)) {
      _returnText(text);
      _active.delete(dn);
    }
  }

  for (const dn of arr) {
    let text = _active.get(dn);
    if (!text) {
      text = _acquireText();
      _active.set(dn, text);
      _container.addChild(text);
    }
    text.text = dn.text;
    text.style.fontSize = FONT_SIZE * dn.scale;
    text.style.fill = dn.color;
    
    // Project world coords to screen
    const screenPos = camera.worldToScreen(dn.x, dn.y);
    text.x = screenPos.x;
    text.y = screenPos.y;
    
    text.alpha = dn.life / dn.maxLife;
  }
}

export function clearDamageNumbers() {
  if (!_container) return;
  _container.removeChildren();
  for (const [dn, text] of _active) {
    text.destroy();
  }
  _active.clear();
  for (const t of _pool) {
    t.destroy();
  }
  _pool.length = 0;
}

function _acquireText() {
  if (_pool.length > 0) {
    return _pool.pop();
  }
  const style = new TextStyle({
    fontFamily: 'Huninn, monospace',
    fontSize: FONT_SIZE,
    fontWeight: 'bold',
    fill: '#ffffff',
    align: 'center',
    dropShadow: { color: '#000000', blur: 3, distance: 0, alpha: 0.6 },
  });
  const text = new Text({ text: '', style });
  text.anchor.set(0.5, 0.5);
  return text;
}

function _returnText(text) {
  text.removeFromParent();
  if (_pool.length < MAX_ACTIVE) {
    _pool.push(text);
  } else {
    text.destroy();
  }
}
