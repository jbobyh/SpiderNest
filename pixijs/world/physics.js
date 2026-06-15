// ============================================================
// PHYSICS — Matter.js engine wrapper (top-down, no gravity)
// Matter is loaded as UMD via index.html → window.Matter
// ============================================================

import { CELL_PX, cellFromKey, wallKey } from './constants.js';

// eslint-disable-next-line no-undef
const { Engine, Bodies, Body, Composite, Events } = Matter;

const WALL_THICKNESS = 6; // px — thin static wall body depth

let _engine    = null;
let _wallBodies = new Map(); // wallKey → Matter.Body
let _outerWalls = [];

// ── Engine lifecycle ──────────────────────────────────────────

export function createEngine() {
  _engine     = Engine.create({ gravity: { x: 0, y: 0 } });
  _wallBodies = new Map();
  _outerWalls = [];
  return _engine;
}

export function getEngine() { return _engine; }

export function stepEngine(dtMs) {
  Engine.update(_engine, dtMs);
}

// ── Entity bodies ─────────────────────────────────────────────

export function createPlayerBody(x, y) {
  const body = Bodies.circle(x, y, CONFIG.PLAYER_RADIUS, {
    label: 'player',
    frictionAir: 0,
    restitution: 0,
    friction: 0,
  });
  Composite.add(_engine.world, body);
  return body;
}

export function createEnemyBody(x, y, radius, label = 'enemy') {
  const body = Bodies.circle(x, y, radius, {
    label,
    frictionAir: 0,
    restitution: 0.1,
    friction: 0,
  });
  Composite.add(_engine.world, body);
  return body;
}

export function destroyBody(body) {
  if (body && _engine) Composite.remove(_engine.world, body);
}

// ── Wall bodies ───────────────────────────────────────────────
//
// For every boundary between two adjacent blobCells that is NOT in
// removedWalls, we maintain a thin static rectangle.
// Call syncWallBodies() whenever removedWalls changes.

export function syncWallBodies(blobCells, removedWalls) {
  // Collect walls that should exist
  const neededWalls = new Set();
  for (const k of blobCells) {
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = `${nx},${ny}`;
      if (!blobCells.has(nk)) continue;
      const wk = wallKey(x, y, nx, ny);
      if (!removedWalls.has(wk)) neededWalls.add(wk);
    }
  }

  // Remove stale bodies
  for (const [wk, body] of _wallBodies) {
    if (!neededWalls.has(wk)) {
      Composite.remove(_engine.world, body);
      _wallBodies.delete(wk);
    }
  }

  // Add missing bodies
  for (const wk of neededWalls) {
    if (_wallBodies.has(wk)) continue;
    const [left, right] = wk.split('|');
    const [ax, ay]      = left.split(',').map(Number);
    const [bx, by]      = right.split(',').map(Number);
    // ax===bx → horizontal boundary (same column) → horizontal wall strip
    // ay===by → vertical boundary (same row)       → vertical wall strip
    const isHorizBoundary = ax === bx; // boundary runs top-bottom → vertical strip

    let wx, wy, ww, wh;
    if (!isHorizBoundary) {
      // bx = ax+1 — wall between columns ax and bx (vertical strip at x = bx*CELL_PX)
      wx = bx * CELL_PX;
      wy = ay * CELL_PX + CELL_PX / 2;
      ww = WALL_THICKNESS;
      wh = CELL_PX;
    } else {
      // by = ay+1 — wall between rows ay and by (horizontal strip at y = by*CELL_PX)
      wx = ax * CELL_PX + CELL_PX / 2;
      wy = by * CELL_PX;
      ww = CELL_PX;
      wh = WALL_THICKNESS;
    }

    const body = Bodies.rectangle(wx, wy, ww, wh, {
      isStatic: true,
      label: 'wall',
      friction: 0,
      restitution: 0,
    });
    Composite.add(_engine.world, body);
    _wallBodies.set(wk, body);
  }
}

// Outer boundary walls around a rectangular region of cells.
// Removes previous outer walls first.
export function syncOuterBounds(minX, minY, maxX, maxY) {
  for (const b of _outerWalls) Composite.remove(_engine.world, b);
  _outerWalls = [];

  const T  = CELL_PX;                                   // thickness = one cell
  const w  = (maxX - minX + 1) * CELL_PX;
  const h  = (maxY - minY + 1) * CELL_PX;
  const cx = (minX + maxX + 1) * CELL_PX / 2;
  const cy = (minY + maxY + 1) * CELL_PX / 2;
  const x0 = minX * CELL_PX;
  const y0 = minY * CELL_PX;
  const x1 = (maxX + 1) * CELL_PX;
  const y1 = (maxY + 1) * CELL_PX;

  const rects = [
    [cx,       y0 - T / 2, w + T * 2, T], // top
    [cx,       y1 + T / 2, w + T * 2, T], // bottom
    [x0 - T / 2, cy,       T, h + T * 2], // left
    [x1 + T / 2, cy,       T, h + T * 2], // right
  ];

  for (const [rx, ry, rw, rh] of rects) {
    const body = Bodies.rectangle(rx, ry, rw, rh, { isStatic: true, label: 'outer_wall' });
    Composite.add(_engine.world, body);
    _outerWalls.push(body);
  }

  return _outerWalls;
}

// ── Collision events ──────────────────────────────────────────

// callback(pairs) called on each 'collisionStart' event
export function onCollision(callback) {
  Events.on(_engine, 'collisionStart', ({ pairs }) => callback(pairs));
}
