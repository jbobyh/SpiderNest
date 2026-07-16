// ============================================================
// FLOW FIELD PATHFINDING — sub-cell BFS + Line of Sight
//
// Grid: FLOW_SUB×FLOW_SUB sub-cells per map cell (~25px each).
// FLOW_SUB=5 is distinct from SUBCELLS_PER_CELL=3 (render tiles).
//
// Usage:
//   state.flowField = computeFlowField(openRect, px, py, blockedSubNodes)
//   const dir = getEnemyMoveDir(gx, gy, px, py, state.flowField, openRect)
// ============================================================

import { CELL_PX, inOpenRect } from '../world/constants.js';

export const FLOW_SUB = 5;                 // sub-cells per cell axis
export const FLOW_SUB_PX = CELL_PX / FLOW_SUB; // ≈ 25.2 px per sub-cell

// ── Internal helpers ──────────────────────────────────────────

function subKey(scx, scy) { return `${scx},${scy}`; }

function subToCell(scx, scy) {
  return { cx: Math.floor(scx / FLOW_SUB), cy: Math.floor(scy / FLOW_SUB) };
}

// Can an entity at sub-cell (scx, scy) move into sub-cell (nscx, nscy)?
// In the rectangle system: just check if destination is inside openRect.
function canTraverse(scx, scy, nscx, nscy, openRect, blockedSubNodes) {
  if (blockedSubNodes && blockedSubNodes.has(subKey(nscx, nscy))) return false;

  const wx = (nscx + 0.5) * FLOW_SUB_PX;
  const wy = (nscy + 0.5) * FLOW_SUB_PX;
  return inOpenRect(wx, wy, openRect);
}

// ── Flow field ────────────────────────────────────────────────

/**
 * BFS from the player's sub-cell outward across the sub-cell grid.
 * Returns Map<subKey, {dx, dy}> — normalized direction toward the player.
 *
 * @param {{minX,minY,maxX,maxY}} openRect
 * @param {number}               targetWx   — player world X
 * @param {number}               targetWy   — player world Y
 * @param {Set<string>=}         blockedSubNodes — reserved for future rect-obstacles
 * @returns {Map<string, {dx:number, dy:number}>}
 */
export function computeFlowField(openRect, targetWx, targetWy, blockedSubNodes) {
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
      if (!canTraverse(scx, scy, nscx, nscy, openRect, blockedSubNodes)) continue;

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
 * In the rectangle system: LoS is true if both endpoints are inside openRect.
 * No internal walls exist to block sight.
 *
 * @param {{minX,minY,maxX,maxY}} openRect
 */
export function hasLineOfSight(openRect, x0, y0, x1, y1) {
  return inOpenRect(x0, y0, openRect) && inOpenRect(x1, y1, openRect);
}

// ── Enemy direction ───────────────────────────────────────────

/**
 * Get normalized move direction for an enemy at (gx, gy) toward player at (px, py).
 * Direct vector if LoS; flow field otherwise; raw direct vector as last resort.
 *
 * @param {number}             gx, gy       — enemy world pos
 * @param {number}             px, py       — player world pos
 * @param {Map|null}           flowField    — from computeFlowField
 * @param {{minX,minY,maxX,maxY}} openRect
 * @returns {{dx:number, dy:number}}        — normalized direction (may be {0,0} if at same pos)
 */
export function getEnemyMoveDir(gx, gy, px, py, flowField, openRect) {
  const dx   = px - gx;
  const dy   = py - gy;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.001) return { dx: 0, dy: 0 };

  if (hasLineOfSight(openRect, gx, gy, px, py)) {
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
