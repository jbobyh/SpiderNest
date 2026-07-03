import { Container, Text, TextStyle } from 'pixi.js';

const D = CONFIG.DAMAGE_NUMBERS;

let _container = null;
const _pool = [];
const _active = new Map();

function easeOutBack(t, s) {
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function initDamageNumbers(layer) {
  _container = new Container({ label: 'damageNumbers' });
  layer.addChild(_container);
}

export function spawnDamageNumber(state, x, y, damage, isCrit, scale = 1) {
  const arr = state.damageNumbers;
  if (arr.length >= D.maxActive) {
    arr.shift();
  }
  arr.push({
    x,
    y,
    vx: (Math.random() - 0.5) * D.driftSpeed,
    vy: -D.riseSpeed * scale,
    text: String(damage),
    life: D.life,
    maxLife: D.life,
    age: 0,
    color: isCrit ? '#ff4400' : '#ffffff',
    scale: isCrit ? 1.3 : 1.0,
  });
}

export function updateAndSyncDamageNumbers(state, dt, camera) {
  if (!_container || !camera) return;

  const arr = state.damageNumbers;
  for (let i = arr.length - 1; i >= 0; i--) {
    const dn = arr[i];
    dn.x += dn.vx * dt;
    dn.y += dn.vy * dt;
    dn.vx *= D.damp;
    dn.vy *= D.damp;
    dn.age += dt;
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
    text.style.fontSize = D.fontSize * dn.scale;
    text.style.fill = dn.color;

    // Pop-in scale via easeOutBack
    let popScale;
    if (dn.age < D.popDuration) {
      const t = dn.age / D.popDuration;
      popScale = easeOutBack(t, D.popOvershoot);
    } else {
      popScale = 1;
    }
    text.scale.set(dn.scale * popScale);

    // Project world coords to screen
    const screenPos = camera.worldToScreen(dn.x, dn.y);
    text.x = screenPos.x;
    text.y = screenPos.y;

    // Nonlinear alpha: full until fadeStart, then fade out
    const lifeFrac = dn.life / dn.maxLife;
    text.alpha = lifeFrac > D.fadeStart ? 1 : lifeFrac / D.fadeStart;
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
    fontSize: D.fontSize,
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
  if (_pool.length < D.maxActive) {
    _pool.push(text);
  } else {
    text.destroy();
  }
}
