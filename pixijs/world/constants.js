// ============================================================
// WORLD CONSTANTS & COORDINATE UTILITIES
// ============================================================

export const CELL_PX           = 126; // physical cell size in pixels (drives physics & collision)

export const FLOOR_TILES_PER_CELL = 5;                           // how many floor tiles fill one cell (render only)
export const FLOOR_TILE_PX        = CELL_PX / FLOOR_TILES_PER_CELL;

export const TILES_PER_CELL    = FLOOR_TILES_PER_CELL;           // alias
export const SUBCELLS_PER_CELL = FLOOR_TILES_PER_CELL;           // alias
export const SUBCELL_PX        = FLOOR_TILE_PX;                  // alias

export const CARDINAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAGONAL_DIRECTIONS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
export const WALL_DIRECTIONS     = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// ── Cell coordinate helpers ──────────────────────────────────

export function cellKey(x, y)    { return `${x},${y}`; }
export function cellFromKey(k)   { if (!k) return { x: 0, y: 0 }; const [x, y] = k.split(','); return { x: +x, y: +y }; }
export function cellOf(wx, wy)   { return { x: Math.floor(wx / CELL_PX), y: Math.floor(wy / CELL_PX) }; }
export function inBounds(x, y)   { return x >= -100 && x < 200 && y >= -100 && y < 200; }

// Sub-cell position within a cell (0..8 in each axis)
export function subCellOf(wx, wy) {
  const cellX  = Math.floor(wx / CELL_PX);
  const cellY  = Math.floor(wy / CELL_PX);
  const localX = wx - cellX * CELL_PX;
  const localY = wy - cellY * CELL_PX;
  return { cellX, cellY, subX: Math.floor(localX / SUBCELL_PX), subY: Math.floor(localY / SUBCELL_PX) };
}

// ── Wall key helpers ─────────────────────────────────────────
// Normalised so the cell with smaller (x, then y) is always first.

export function wallKey(ax, ay, bx, by) {
  if (ax > bx || (ax === bx && ay > by)) return `${bx},${by}|${ax},${ay}`;
  return `${ax},${ay}|${bx},${by}`;
}

export function wallKeyFromStr(wk) {
  const [left, right] = wk.split('|');
  const [ax, ay] = left.split(',').map(Number);
  const [bx, by] = right.split(',').map(Number);
  return { ax, ay, bx, by };
}

// ── Spatial queries ──────────────────────────────────────────

// BFS: open cells reachable from seedKey by crossing removedWalls inside blobCells
export function recomputeOpenCells(blobCells, removedWalls, seedKey) {
  const open  = new Set([seedKey]);
  const queue = [seedKey];
  while (queue.length) {
    const k    = queue.shift();
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = x + dx, ny = y + dy;
      const nk = cellKey(nx, ny);
      if (!blobCells.has(nk) || open.has(nk)) continue;
      if (removedWalls.has(wallKey(x, y, nx, ny))) { open.add(nk); queue.push(nk); }
    }
  }
  return open;
}

// BFS: flood-fill within openCells from startKey
export function getConnectedCells(openCells, startKey) {
  const connected = new Set([startKey]);
  const queue     = [startKey];
  while (queue.length) {
    const k    = queue.shift();
    const { x, y } = cellFromKey(k);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nk = cellKey(x + dx, y + dy);
      if (openCells.has(nk) && !connected.has(nk)) { connected.add(nk); queue.push(nk); }
    }
  }
  return connected;
}

export function getCellBounds(cells) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cells) {
    const { x, y } = cellFromKey(k);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// ── Movement / collision helpers ─────────────────────────────

// True if movement from (x0,y0)→(x1,y1) crosses a closed inter-cell wall.
export function crossesWall(removedWalls, x0, y0, x1, y1) {
  const c0x = Math.floor(x0 / CELL_PX), c0y = Math.floor(y0 / CELL_PX);
  const c1x = Math.floor(x1 / CELL_PX), c1y = Math.floor(y1 / CELL_PX);
  if (c0x === c1x && c0y === c1y) return false;
  return !removedWalls.has(wallKey(c0x, c0y, c1x, c1y));
}

// True if world-point (px,py) is inside an open cell.
export function inRoom(px, py, openCells) {
  const c = cellOf(px, py);
  return openCells.has(cellKey(c.x, c.y));
}

// Find wall at point (mx, my) within blobCells. Returns { ax, ay, bx, by, wk } or null.
export function getWallAtPoint(blobCells, mx, my) {
  const snapR = CELL_PX * 0.30;
  const snapR2 = snapR * snapR;
  const cx0 = Math.floor((mx - snapR) / CELL_PX) - 1;
  const cx1 = Math.floor((mx + snapR) / CELL_PX) + 1;
  const cy0 = Math.floor((my - snapR) / CELL_PX) - 1;
  const cy1 = Math.floor((my + snapR) / CELL_PX) + 1;

  let bestDist2 = Infinity;
  let best = null;

  for (let gx = cx0; gx <= cx1; gx++) {
    for (let gy = cy0; gy <= cy1; gy++) {
      const k = cellKey(gx, gy);
      if (!blobCells.has(k)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = gx + dx, ny = gy + dy;
        const nk = cellKey(nx, ny);
        if (!blobCells.has(nk)) continue;
        const midX = (gx + nx + 1) * CELL_PX / 2;
        const midY = (gy + ny + 1) * CELL_PX / 2;
        const d2 = (mx - midX) * (mx - midX) + (my - midY) * (my - midY);
        if (d2 < snapR2 && d2 < bestDist2) {
          bestDist2 = d2;
          best = { ax: gx, ay: gy, bx: nx, by: ny, wk: wallKey(gx, gy, nx, ny) };
        }
      }
    }
  }
  return best;
}

// ── Misc utilities ───────────────────────────────────────────

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
