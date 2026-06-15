// ============================================================
// INPUT — keyboard / mouse state
// Thin layer: tracks raw state, no game-logic side-effects.
// Game-logic reactions (dash, weapon switch, etc.) live in
// play-mode.js / battle-mode.js.
// ============================================================

// ── Raw state ─────────────────────────────────────────────────

export const keys  = {};           // key.toLowerCase() → boolean
export const mouse = { x: 0, y: 0, held: false, rightHeld: false };

// ── Stored listener refs (required for removeEventListener) ────

let _canvas       = null;
let _mouseMoveRef = null;
let _mouseDownRef = null;
let _mouseUpRef   = null;

// ── Listeners ─────────────────────────────────────────────────

export function initInput(canvas) {
  _canvas       = canvas;
  _mouseMoveRef = e => _onMouseMove(e, canvas);
  _mouseDownRef = e => {
    if (e.button === 0) mouse.held = true;
    if (e.button === 2) mouse.rightHeld = true;
  };
  _mouseUpRef   = e => {
    if (e.button === 0) mouse.held = false;
    if (e.button === 2) mouse.rightHeld = false;
  };

  document.addEventListener('keydown', _onKeyDown);
  document.addEventListener('keyup',   _onKeyUp);
  canvas.addEventListener('mousemove', _mouseMoveRef);
  canvas.addEventListener('mousedown', _mouseDownRef);
  canvas.addEventListener('mouseup',   _mouseUpRef);
  window.addEventListener('blur',      _clearAll);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

export function destroyInput() {
  document.removeEventListener('keydown', _onKeyDown);
  document.removeEventListener('keyup',   _onKeyUp);
  if (_canvas) {
    _canvas.removeEventListener('mousemove', _mouseMoveRef);
    _canvas.removeEventListener('mousedown', _mouseDownRef);
    _canvas.removeEventListener('mouseup',   _mouseUpRef);
    _canvas = null;
  }
  window.removeEventListener('blur', _clearAll);
  _clearAll();
}

// ── Helpers ───────────────────────────────────────────────────

function _onKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  // Prevent scroll on space / arrows
  if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space' ||
      e.key === 'Tab') {
    e.preventDefault();
  }
}

function _onKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function _onMouseMove(e, canvas) {
  // Convert from page coords to logical canvas coords
  const rect   = canvas.getBoundingClientRect();
  const scaleX = CONFIG.VIEW_W / rect.width;
  const scaleY = CONFIG.VIEW_H / rect.height;
  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top)  * scaleY;
}

function _clearAll() {
  for (const k of Object.keys(keys)) keys[k] = false;
  mouse.held = false;
  mouse.rightHeld = false;
}

// ── Movement direction from current key state ─────────────────
// Returns { mvx, mvy } normalised (diagonal ≈ 0.707).

export function getMovementDir() {
  let mvx = 0, mvy = 0;
  if (keys['w'] || keys['ц'] || keys['arrowup'])    mvy -= 1;
  if (keys['s'] || keys['ы'] || keys['arrowdown'])  mvy += 1;
  if (keys['a'] || keys['ф'] || keys['arrowleft'])  mvx -= 1;
  if (keys['d'] || keys['в'] || keys['arrowright']) mvx += 1;
  if (mvx && mvy) { mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }
  return { mvx, mvy };
}
