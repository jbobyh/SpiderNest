// ============================================================
// FLOW FIELD PATHFINDING — sub-cell BFS + Line of Sight
//
// Grid: FLOW_SUB×FLOW_SUB sub-cells per map cell (~25px each).
// FLOW_SUB=5 is distinct from SUBCELLS_PER_CELL=3 (render tiles).
//
// Usage:
//   state.flowField = computeFlowField(openCells, removedWalls, px, py, blockedSubNodes)
//   const dir = getEnemyMoveDir(gx, gy, px, py, state.flowField, openCells, removedWalls)
// ============================================================

import { CELL_PX, cellKey, wallKey } from '../world/constants.js';

export const FLOW_SUB = 5;                 // sub-cells per cell axis
export const FLOW_SUB_PX = CELL_PX / FLOW_SUB; // ≈ 25.2 px per sub-cell

// ── Internal helpers ──────────────────────────────────────────

function subKey(scx, scy) { return `${scx},${scy}`; }

function subToCell(scx, scy) {
  return { cx: Math.floor(scx / FLOW_SUB), cy: Math.floor(scy / FLOW_SUB) };
}

// Can an entity at sub-cell (scx, scy) move into sub-cell (nscx, nscy)?
// Checks open cells + removed walls at any cell boundary crossing.
function canTraverse(scx, scy, nscx, nscy, openCells, removedWalls, blockedSubNodes) {
  if (blockedSubNodes && blockedSubNodes.has(subKey(nscx, nscy))) return false;

  const { cx: dstCX, cy: dstCY } = subToCell(nscx, nscy);
  if (!openCells.has(cellKey(dstCX, dstCY))) return false;

  const { cx: srcCX, cy: srcCY } = subToCell(scx, scy);
  if (srcCX === dstCX && srcCY === dstCY) return true; // same cell → always connected

  const ddCX = dstCX - srcCX;
  const ddCY = dstCY - srcCY;

  if (ddCX !== 0 && ddCY !== 0) {
    // Diagonal cell crossing: both intermediate cells must be open.
    // At least one L-path (src→interX→dst or src→interY→dst) must have both walls removed.
    // This prevents corner-cutting through wall junctions.
    if (!openCells.has(cellKey(srcCX + ddCX, srcCY))) return false;
    if (!openCells.has(cellKey(srcCX, srcCY + ddCY))) return false;
    const pathA = removedWalls.has(wallKey(srcCX, srcCY, srcCX + ddCX, srcCY)) &&
                  removedWalls.has(wallKey(srcCX + ddCX, srcCY, dstCX, dstCY));
    const pathB = removedWalls.has(wallKey(srcCX, srcCY, srcCX, srcCY + ddCY)) &&
                  removedWalls.has(wallKey(srcCX, srcCY + ddCY, dstCX, dstCY));
    if (!(pathA || pathB)) return false;
  } else {
    // Cardinal cell crossing
    if (!removedWalls.has(wallKey(srcCX, srcCY, dstCX, dstCY))) return false;
  }

  return true;
}

// ── Flow field ────────────────────────────────────────────────

/**
 * BFS from the player's sub-cell outward across the sub-cell grid.
 * Returns Map<subKey, {dx, dy}> — normalized direction toward the player.
 *
 * @param {Set<string>}  openCells
 * @param {Set<string>}  removedWalls
 * @param {number}       targetWx   — player world X
 * @param {number}       targetWy   — player world Y
 * @param {Set<string>=} blockedSubNodes — reserved for future rect-obstacles
 * @returns {Map<string, {dx:number, dy:number}>}
 */
export function computeFlowField(openCells, removedWalls, targetWx, targetWy, blockedSubNodes) {
  const tScx = Math.floor(targetWx / FLOW_SUB_PX);
  const tScy = Math.floor(targetWy / FLOW_SUB_PX);

  const field   = new Map();
  const visited = new Set();
  const queue   = [];

  const startKey = subKey(tScx, tScy);
  visited.add(startKey);
  queue.push([tScx, tScy]);
  field.set(startKey, { dx: 0, dy: 0 }); // at target: no movement needed

  const DIRS = [
    [ 1,  0], [-1,  0], [ 0,  1], [ 0, -1],
    [ 1,  1], [ 1, -1], [-1,  1], [-1, -1],
  ];

  let head = 0;
  while (head < queue.length) {
    const [scx, scy] = queue[head++];

    for (const [ddx, ddy] of DIRS) {
      const nscx = scx + ddx;
      const nscy = scy + ddy;
      const nk   = subKey(nscx, nscy);

      if (visited.has(nk)) continue;
      if (!canTraverse(scx, scy, nscx, nscy, openCells, removedWalls, blockedSubNodes)) continue;

      // Direction from (nscx, nscy) toward (scx, scy) = reverse of (ddx, ddy)
      const len = Math.hypot(ddx, ddy);
      field.set(nk, { dx: -ddx / len, dy: -ddy / len });
      visited.add(nk);
      queue.push([nscx, nscy]);
    }
  }

  return field;
}

// ── Line of Sight ─────────────────────────────────────────────

/**
 * DDA grid traversal. Returns true if the straight line (x0,y0)→(x1,y1)
 * does not cross any closed cell wall.
 *
 * @param {Set<string>} openCells
 * @param {Set<string>} removedWalls
 */
export function hasLineOfSight(openCells, removedWalls, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return true;

  let cx = Math.floor(x0 / CELL_PX);
  let cy = Math.floor(y0 / CELL_PX);
  const tcx = Math.floor(x1 / CELL_PX);
  const tcy = Math.floor(y1 / CELL_PX);

  if (!openCells.has(cellKey(cx, cy))) return false;
  if (cx === tcx && cy === tcy) return true;

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;

  const tDeltaX = Math.abs(dx) > 0.001 ? Math.abs(CELL_PX / dx) : Infinity;
  const tDeltaY = Math.abs(dy) > 0.001 ? Math.abs(CELL_PX / dy) : Infinity;

  const nextBX = (dx > 0 ? cx + 1 : cx) * CELL_PX;
  const nextBY = (dy > 0 ? cy + 1 : cy) * CELL_PX;

  let tMaxX = Math.abs(dx) > 0.001 ? Math.abs((nextBX - x0) / dx) : Infinity;
  let tMaxY = Math.abs(dy) > 0.001 ? Math.abs((nextBY - y0) / dy) : Infinity;

  const maxSteps = Math.abs(tcx - cx) + Math.abs(tcy - cy) + 2;

  for (let step = 0; step < maxSteps; step++) {
    if (cx === tcx && cy === tcy) return true;

    let ncx = cx, ncy = cy;
    if (tMaxX < tMaxY) {
      ncx = cx + stepX;
      tMaxX += tDeltaX;
    } else {
      ncy = cy + stepY;
      tMaxY += tDeltaY;
    }

    if (!openCells.has(cellKey(ncx, ncy))) return false;
    if (!removedWalls.has(wallKey(cx, cy, ncx, ncy))) return false;

    cx = ncx;
    cy = ncy;
  }

  return cx === tcx && cy === tcy;
}

// ── Enemy direction ───────────────────────────────────────────

/**
 * Get normalized move direction for an enemy at (gx, gy) toward player at (px, py).
 * Direct vector if LoS; flow field otherwise; raw direct vector as last resort.
 *
 * @param {number}             gx, gy       — enemy world pos
 * @param {number}             px, py       — player world pos
 * @param {Map|null}           flowField    — from computeFlowField
 * @param {Set<string>}        openCells
 * @param {Set<string>}        removedWalls
 * @returns {{dx:number, dy:number}}        — normalized direction (may be {0,0} if at same pos)
 */
export function getEnemyMoveDir(gx, gy, px, py, flowField, openCells, removedWalls) {
  const dx   = px - gx;
  const dy   = py - gy;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.001) return { dx: 0, dy: 0 };

  if (hasLineOfSight(openCells, removedWalls, gx, gy, px, py)) {
    return { dx: dx / dist, dy: dy / dist };
  }

  if (flowField) {
    const scx = Math.floor(gx / FLOW_SUB_PX);
    const scy = Math.floor(gy / FLOW_SUB_PX);
    const dir = flowField.get(subKey(scx, scy));
    if (dir && (dir.dx !== 0 || dir.dy !== 0)) return dir;
  }

  return { dx: dx / dist, dy: dy / dist };
}

// ── Future obstacle API ───────────────────────────────────────

/**
 * Mark sub-cells overlapping world-space rects as blocked.
 * Invalidate state.flowField after calling.
 *
 * @param {Set<string>} blockedSubNodes
 * @param {Array<{x,y,w,h}>} rects
 */
export function addBlockedSubNodes(blockedSubNodes, rects) {
  for (const { x, y, w, h } of rects) {
    const minScx = Math.floor(x / FLOW_SUB_PX);
    const minScy = Math.floor(y / FLOW_SUB_PX);
    const maxScx = Math.floor((x + w) / FLOW_SUB_PX);
    const maxScy = Math.floor((y + h) / FLOW_SUB_PX);
    for (let sx = minScx; sx <= maxScx; sx++) {
      for (let sy = minScy; sy <= maxScy; sy++) {
        blockedSubNodes.add(subKey(sx, sy));
      }
    }
  }
}

/**
 * Unmark sub-cells for the given rects.
 * Invalidate state.flowField after calling.
 *
 * @param {Set<string>} blockedSubNodes
 * @param {Array<{x,y,w,h}>} rects
 */
export function removeBlockedSubNodes(blockedSubNodes, rects) {
  for (const { x, y, w, h } of rects) {
    const minScx = Math.floor(x / FLOW_SUB_PX);
    const minScy = Math.floor(y / FLOW_SUB_PX);
    const maxScx = Math.floor((x + w) / FLOW_SUB_PX);
    const maxScy = Math.floor((y + h) / FLOW_SUB_PX);
    for (let sx = minScx; sx <= maxScx; sx++) {
      for (let sy = minScy; sy <= maxScy; sy++) {
        blockedSubNodes.delete(subKey(sx, sy));
      }
    }
  }
}
