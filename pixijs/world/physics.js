// ============================================================
// PHYSICS — Matter.js engine wrapper (top-down, no gravity)
// Matter is loaded as UMD via index.html → window.Matter
// ============================================================

import { CELL_PX, cellFromKey, wallKey } from './constants.js';

// eslint-disable-next-line no-undef
const { Engine, Bodies, Body, Composite, Events } = Matter;

const WALL_THICKNESS = 6; // px — thin static wall body depth

export const CAT_WALL   = 0x0001;
export const CAT_PLAYER = 0x0002;
export const CAT_ENEMY  = 0x0004;

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

export function createPlayerBody(x, y, entity) {
  const body = Bodies.circle(x, y, CONFIG.PLAYER_RADIUS, {
    label: 'player',
    frictionAir: 0,
    restitution: 0,
    friction: 0,
    collisionFilter: { category: CAT_PLAYER, mask: CAT_WALL | CAT_ENEMY },
  });
  body._entity = entity;
  Composite.add(_engine.world, body);
  return body;
}

export function createEnemyBody(x, y, radius, entity, label = 'enemy') {
  const body = Bodies.circle(x, y, radius, {
    label,
    frictionAir: 0,
    restitution: 0.1,
    friction: 0,
    collisionFilter: { category: CAT_ENEMY, mask: CAT_WALL | CAT_PLAYER | CAT_ENEMY },
  });
  body._entity = entity;
  Composite.add(_engine.world, body);
  return body;
}

export function destroyBody(body) {
  if (body && _engine) Composite.remove(_engine.world, body);
}

// Convenience wrapper — avoids importing Body into every module.
export function setBodyVelocity(body, vx, vy) {
  if (body) Body.setVelocity(body, { x: vx, y: vy });
}

// Switch player collision mask: during dash player passes through enemies but not walls.
export function setPlayerDashing(body, isDashing) {
  Body.set(body, 'collisionFilter', {
    category: CAT_PLAYER,
    mask: isDashing ? CAT_WALL : CAT_WALL | CAT_ENEMY,
  });
}

// Destroy engine and free all bodies. Call on level teardown.
export function clearEngine() {
  if (_engine) {
    Engine.clear(_engine);
    _engine     = null;
    _wallBodies = new Map();
    _outerWalls = [];
  }
}

// ── Wall bodies ───────────────────────────────────────────────
//
// For every boundary between two adjacent blobCells that is NOT in
// removedWalls, we maintain a thin static rectangle.
// Call syncWallBodies() whenever removedWalls changes.

export function syncWallBodies(blobCells, removedWalls) {
  const neededWalls = new Set();

  for (const k of blobCells) {
    const [x, y] = k.split(',').map(Number);
    // Check all 4 directions to find world boundaries or closed internal walls
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = `${nx},${ny}`;
      const wk = wallKey(x, y, nx, ny);

      const isEdge = !blobCells.has(nk);
      const isClosedInternal = !isEdge && !removedWalls.has(wk);

      if (isEdge || isClosedInternal) {
        neededWalls.add(wk);
      }
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

    const isVertWall = ax === bx; // cells are (x,y) and (x,y+1) -> horizontal boundary -> horizontal wall strip

    let wx, wy, ww, wh;
    if (!isVertWall) {
      // vertical wall between column ax and bx
      wx = Math.max(ax, bx) * CELL_PX;
      wy = ay * CELL_PX + CELL_PX / 2;
      ww = WALL_THICKNESS;
      wh = CELL_PX;
    } else {
      // horizontal wall between row ay and by
      wx = ax * CELL_PX + CELL_PX / 2;
      wy = Math.max(ay, by) * CELL_PX;
      ww = CELL_PX;
      wh = WALL_THICKNESS;
    }

    const body = Bodies.rectangle(wx, wy, ww, wh, {
      isStatic: true,
      label: 'wall',
      friction: 0,
      restitution: 0,
      collisionFilter: { category: CAT_WALL },
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
    const body = Bodies.rectangle(rx, ry, rw, rh, {
      isStatic: true,
      label: 'outer_wall',
      collisionFilter: { category: CAT_WALL },
    });
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
