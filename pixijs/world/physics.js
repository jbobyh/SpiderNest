// ============================================================
// PHYSICS — Matter.js engine wrapper (top-down, no gravity)
// Matter is loaded as UMD via index.html → window.Matter
// ============================================================

import { CELL_PX, cellFromKey, wallKey } from './constants.js';

// eslint-disable-next-line no-undef
const { Engine, Bodies, Body, Composite, Events } = Matter;

const WALL_THICKNESS = CELL_PX * 0.05; // px — thin static wall body depth (matches PART_T in tiles.js)

export const CAT_WALL   = 0x0001;
export const CAT_PLAYER = 0x0002;
export const CAT_ENEMY  = 0x0004;

let _engine    = null;
let _wallBodies = new Map(); // wallKey → Matter.Body
let _outerWalls = [];
let _externalWallBodies = new Map(); // key: "${x},${y}|${dx},${dy}" → Matter.Body

// ── Engine lifecycle ──────────────────────────────────────────

export function createEngine() {
  _engine     = Engine.create({ gravity: { x: 0, y: 0 } });
  _wallBodies = new Map();
  _outerWalls = [];
  _externalWallBodies = new Map();
  return _engine;
}

export function stepEngine(dtMs) {
  const subSteps = 2;
  const subDt = dtMs / subSteps;
  for (let i = 0; i < subSteps; i++) {
    Engine.update(_engine, subDt);
  }
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
    _externalWallBodies = new Map();
  }
}

export function syncEntitiesToBodies(player, enemies) {
  if (player?.body) {
    player.x = player.body.position.x;
    player.y = player.body.position.y;
  }
  for (const g of enemies) {
    if (g.body) {
      g.x = g.body.position.x;
      g.y = g.body.position.y;
    }
  }
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
      collisionFilter: { category: CAT_WALL },
    });
    Composite.add(_engine.world, body);
    _wallBodies.set(wk, body);
  }
}

// External wall bodies at blobCell boundaries (where adjacent cell is NOT in blobCells).
// Matches buildExternalWalls() visual rendering exactly.
// visibleCells: optional Set of cells to check (like openCells + everRevealedCells)
// If not provided, checks all blobCells.
export function syncExternalWallBodies(blobCells, visibleCells = null) {
  // Collect walls that should exist
  const neededWalls = new Set();
  const cellsToCheck = visibleCells ? new Set([...visibleCells].filter(k => blobCells.has(k))) : blobCells;
  
  for (const k of cellsToCheck) {
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const nk = `${nx},${ny}`;
      if (blobCells.has(nk)) continue; // Skip if adjacent cell exists in blob
      const wk = `${x},${y}|${dx},${dy}`;
      neededWalls.add(wk);
    }
  }

  // Remove stale bodies
  for (const [wk, body] of _externalWallBodies) {
    if (!neededWalls.has(wk)) {
      Composite.remove(_engine.world, body);
      _externalWallBodies.delete(wk);
    }
  }

  // Add missing bodies
  for (const wk of neededWalls) {
    if (_externalWallBodies.has(wk)) continue;
    const [left, right] = wk.split('|');
    const [x, y] = left.split(',').map(Number);
    const [dx, dy] = right.split(',').map(Number);

    let wx, wy, ww, wh;
    const HT = WALL_THICKNESS / 2;
    if (dx === 1) {
      // Right boundary - vertical strip at x = (x+1)*CELL_PX
      // Visual polygon: center at bx, extends from bx-HT to bx+HT
      const bx = (x + 1) * CELL_PX;
      wx = bx;
      wy = y * CELL_PX + CELL_PX / 2;
      ww = WALL_THICKNESS;
      wh = CELL_PX;
    } else if (dx === -1) {
      // Left boundary - vertical strip at x = x*CELL_PX
      const bx = x * CELL_PX;
      wx = bx;
      wy = y * CELL_PX + CELL_PX / 2;
      ww = WALL_THICKNESS;
      wh = CELL_PX;
    } else if (dy === 1) {
      // Bottom boundary - horizontal strip at y = (y+1)*CELL_PX
      const by = (y + 1) * CELL_PX;
      wx = x * CELL_PX + CELL_PX / 2;
      wy = by;
      ww = CELL_PX;
      wh = WALL_THICKNESS;
    } else {
      // Top boundary - horizontal strip at y = y*CELL_PX
      const by = y * CELL_PX;
      wx = x * CELL_PX + CELL_PX / 2;
      wy = by;
      ww = CELL_PX;
      wh = WALL_THICKNESS;
    }

    const body = Bodies.rectangle(wx, wy, ww, wh, {
      isStatic: true,
      label: 'external_wall',
      friction: 0,
      restitution: 0,
      collisionFilter: { category: CAT_WALL },
    });
    Composite.add(_engine.world, body);
    _externalWallBodies.set(wk, body);
  }
}

// ── Collision events ──────────────────────────────────────────
export function getAllBodies() {
  return _engine ? Composite.allBodies(_engine.world) : [];
}

// callback(pairs) called on each 'collisionStart' event
export function onCollision(callback) {
  Events.on(_engine, 'collisionStart', ({ pairs }) => callback(pairs));
}
