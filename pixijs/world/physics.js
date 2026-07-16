// ============================================================
// PHYSICS — Matter.js engine wrapper (top-down, no gravity)
// Matter is loaded as UMD via index.html → window.Matter
// ============================================================

import { CELL_PX } from './constants.js';

// eslint-disable-next-line no-undef
const { Engine, Bodies, Body, Composite, Events } = Matter;

const WALL_THICKNESS = CELL_PX * 0.05; // px — thin static wall body depth (matches PART_T in tiles.js)

export const CAT_WALL   = 0x0001;
export const CAT_PLAYER = 0x0002;
export const CAT_ENEMY  = 0x0004;

let _engine    = null;
let _rectWallBodies = []; // 4 rectangle boundary wall bodies

// ── Engine lifecycle ──────────────────────────────────────────

export function createEngine() {
  _engine     = Engine.create({ gravity: { x: 0, y: 0 } });
  _rectWallBodies = [];
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

export function createGhostBody(x, y, radius, entity, label = 'enemy') {
  const body = Bodies.circle(x, y, radius, {
    label,
    frictionAir: 0,
    restitution: 0.1,
    friction: 0,
    collisionFilter: { category: CAT_ENEMY, mask: CAT_PLAYER | CAT_ENEMY },
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

// Update player collision mask: pass through enemies when dashing or invulnerable.
export function updatePlayerCollision(body, isDashing, isInvulnerable) {
  const skipEnemies = isDashing || isInvulnerable;
  Body.set(body, 'collisionFilter', {
    category: CAT_PLAYER,
    mask: skipEnemies ? CAT_WALL : CAT_WALL | CAT_ENEMY,
  });
}

// Destroy engine and free all bodies. Call on level teardown.
export function clearEngine() {
  if (_engine) {
    Engine.clear(_engine);
    _engine     = null;
    _rectWallBodies = [];
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

// ── Rectangle wall bodies ────────────────────────────────────
//
// 4 static walls forming the open rectangle boundary.
// Call syncRectWallBodies() whenever openRect changes.

export function syncRectWallBodies(openRect) {
  // Remove old bodies
  for (const body of _rectWallBodies) {
    Composite.remove(_engine.world, body);
  }
  _rectWallBodies = [];

  const { minX, minY, maxX, maxY } = openRect;
  const W = maxX - minX;
  const H = maxY - minY;

  const walls = [
    // North: horizontal strip at y = minY
    { x: (minX + maxX) / 2, y: minY, w: W, h: WALL_THICKNESS },
    // South: horizontal strip at y = maxY
    { x: (minX + maxX) / 2, y: maxY, w: W, h: WALL_THICKNESS },
    // West: vertical strip at x = minX
    { x: minX, y: (minY + maxY) / 2, w: WALL_THICKNESS, h: H },
    // East: vertical strip at x = maxX
    { x: maxX, y: (minY + maxY) / 2, w: WALL_THICKNESS, h: H },
  ];

  for (const w of walls) {
    const body = Bodies.rectangle(w.x, w.y, w.w, w.h, {
      isStatic: true,
      label: 'wall',
      friction: 0,
      restitution: 0,
      collisionFilter: { category: CAT_WALL },
    });
    Composite.add(_engine.world, body);
    _rectWallBodies.push(body);
  }
}

// No-op stubs for backward compatibility (old callers updated separately)
export function syncWallBodies() {}
export function syncExternalWallBodies() {}

// ── Collision events ──────────────────────────────────────────
export function getAllBodies() {
  return _engine ? Composite.allBodies(_engine.world) : [];
}

// callback(pairs) called on each 'collisionStart' event
export function onCollision(callback) {
  Events.on(_engine, 'collisionStart', ({ pairs }) => callback(pairs));
}
