// ============================================================
// CAMERA — PixiJS Container wrapper
// Handles world pan, zoom, and screen-shake.
// Usage:
//   const cam = new Camera();
//   app.stage.addChild(cam.container);
//   cam.pan(playerX, playerY);
//   cam.setZoom(1.0);
//   cam.shake(8, angle);
//   // per-frame in ticker:
//   cam.update(dtSec);
// ============================================================

import { Container } from 'pixi.js';

const VW = CONFIG.VIEW_W;
const VH = CONFIG.VIEW_H;

export class Camera {
  constructor() {
    this.container = new Container();

    this._zoom    = 1;
    this._worldX  = 0; // world X at screen centre
    this._worldY  = 0; // world Y at screen centre

    this._currentX = 0; // smoothed camera X
    this._currentY = 0; // smoothed camera Y

    this._shakeAmount = 0;
    this._shakeAngle  = 0;
  }

  // Centre the view on world point (wx, wy) instantly (no damping).
  pan(wx, wy) {
    this._worldX  = wx;
    this._worldY  = wy;
    this._currentX = wx;
    this._currentY = wy;
    this._apply();
  }

  // Set target for smooth follow — camera damps toward (wx, wy) each update().
  moveTo(wx, wy) {
    this._worldX = wx;
    this._worldY = wy;
  }

  // Set zoom level and optionally re-centre on (cx, cy).
  setZoom(scale, cx, cy) {
    this._zoom = scale;
    if (cx !== undefined) { this._worldX = cx; this._worldY = cy; }
    this._apply();
  }

  // Add a one-shot impulse shake.
  shake(amount, angle) {
    if (amount > this._shakeAmount) {
      this._shakeAmount = amount;
      this._shakeAngle  = angle;
    }
  }

  // Call every frame (dt in seconds) to decay shake and advance smooth follow.
  update(dt) {
    const t = 1 - Math.exp(-CONFIG.CAMERA.damping * dt);
    this._currentX += (this._worldX - this._currentX) * t;
    this._currentY += (this._worldY - this._currentY) * t;
    this._shakeAmount *= CONFIG.CAMERA.shakeDecay;
    if (this._shakeAmount < 0.5) this._shakeAmount = 0;
    this._apply();
  }

  // Convert world-space (wx, wy) -> logical screen coordinates.
  worldToScreen(wx, wy) {
    return {
      x: (wx - this._currentX) * this._zoom + VW / 2,
      y: (wy - this._currentY) * this._zoom + VH / 2,
    };
  }

  // Convert screen-space (sx, sy) → world coords given current camera state.
  screenToWorld(sx, sy) {
    return {
      x: (sx - VW / 2) / this._zoom + this._currentX,
      y: (sy - VH / 2) / this._zoom + this._currentY,
    };
  }

  // Current zoom scale.
  get zoom()   { return this._zoom; }
  get worldX() { return this._currentX; }
  get worldY() { return this._currentY; }

  // ── Internal ────────────────────────────────────────────────

  _apply() {
    const sx = Math.cos(this._shakeAngle) * this._shakeAmount;
    const sy = Math.sin(this._shakeAngle) * this._shakeAmount;

    this.container.scale.set(this._zoom);
    // Screen-centre (VW/2, VH/2) should map to world (_currentX, _currentY).
    // container maps local→screen: local_pt * zoom + position = screen_pt
    // → position = VW/2 - _currentX * zoom   (+ shake)
    this.container.position.set(
      VW / 2 - this._currentX * this._zoom + sx,
      VH / 2 - this._currentY * this._zoom + sy,
    );
  }
}
