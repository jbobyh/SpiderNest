using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public sealed class FlowField
{
    private readonly Dictionary<(int, int), Vector2> _directions = new();
    private Vector2 _targetPos;

    public IReadOnlyDictionary<(int, int), Vector2> Directions => _directions;
    public Vector2 TargetPos => _targetPos;
    public int Count => _directions.Count;

    private static readonly (int dx, int dy)[] Dirs =
    {
        (1, 0), (-1, 0), (0, 1), (0, -1),
        (1, 1), (1, -1), (-1, 1), (-1, -1),
    };

    public void Compute(HashSet<CellCoord> openCells, HashSet<WallId> removedWalls, Vector2 targetWorldPos)
    {
        _targetPos = targetWorldPos;
        _directions.Clear();

        var cellPx = GameConstants.CellPx;
        var subPx = GameConstants.FlowSubPx;

        int tScx = (int)Mathf.Floor(targetWorldPos.X / subPx);
        int tScy = (int)Mathf.Floor(targetWorldPos.Y / subPx);

        var visited = new HashSet<(int, int)>();
        var queue = new Queue<(int scx, int scy)>();

        visited.Add((tScx, tScy));
        queue.Enqueue((tScx, tScy));
        _directions[(tScx, tScy)] = Vector2.Zero;

        while (queue.Count > 0)
        {
            var (scx, scy) = queue.Dequeue();

            for (int i = 0; i < Dirs.Length; i++)
            {
                var (ddx, ddy) = Dirs[i];
                int nscx = scx + ddx;
                int nscy = scy + ddy;
                var nk = (nscx, nscy);

                if (visited.Contains(nk))
                    continue;

                if (!CanTraverse(scx, scy, nscx, nscy, openCells, removedWalls, cellPx, subPx))
                    continue;

                float len = Mathf.Sqrt(ddx * ddx + ddy * ddy);
                _directions[nk] = new Vector2(-ddx / len, -ddy / len);
                visited.Add(nk);
                queue.Enqueue((nscx, nscy));
            }
        }
    }

    private static bool CanTraverse(
        int scx, int scy, int nscx, int nscy,
        HashSet<CellCoord> openCells, HashSet<WallId> removedWalls,
        float cellPx, float subPx)
    {
        int dstCX = (int)Mathf.Floor(nscx * subPx / cellPx);
        int dstCY = (int)Mathf.Floor(nscy * subPx / cellPx);
        var dstCell = new CellCoord(dstCX, dstCY);
        if (!openCells.Contains(dstCell))
            return false;

        int srcCX = (int)Mathf.Floor(scx * subPx / cellPx);
        int srcCY = (int)Mathf.Floor(scy * subPx / cellPx);

        if (srcCX == dstCX && srcCY == dstCY)
            return true;

        int ddCX = dstCX - srcCX;
        int ddCY = dstCY - srcCY;

        if (ddCX != 0 && ddCY != 0)
        {
            if (!openCells.Contains(new CellCoord(srcCX + ddCX, srcCY)))
                return false;
            if (!openCells.Contains(new CellCoord(srcCX, srcCY + ddCY)))
                return false;

            var pathA = removedWalls.Contains(WallId.Create(srcCX, srcCY, srcCX + ddCX, srcCY)) &&
                        removedWalls.Contains(WallId.Create(srcCX + ddCX, srcCY, dstCX, dstCY));
            var pathB = removedWalls.Contains(WallId.Create(srcCX, srcCY, srcCX, srcCY + ddCY)) &&
                        removedWalls.Contains(WallId.Create(srcCX, srcCY + ddCY, dstCX, dstCY));
            if (!pathA && !pathB)
                return false;
        }
        else
        {
            if (!removedWalls.Contains(WallId.Create(srcCX, srcCY, dstCX, dstCY)))
                return false;
        }

        return true;
    }

    public Vector2 GetDirectionAt(Vector2 worldPos)
    {
        var subPx = GameConstants.FlowSubPx;
        int scx = (int)Mathf.Floor(worldPos.X / subPx);
        int scy = (int)Mathf.Floor(worldPos.Y / subPx);
        if (_directions.TryGetValue((scx, scy), out var dir))
            return dir;
        return Vector2.Zero;
    }

    public static bool HasLineOfSight(
        HashSet<CellCoord> openCells, HashSet<WallId> removedWalls,
        Vector2 from, Vector2 to)
    {
        var dx = to.X - from.X;
        var dy = to.Y - from.Y;
        if (Mathf.Abs(dx) < 0.001f && Mathf.Abs(dy) < 0.001f)
            return true;

        var cellPx = GameConstants.CellPx;

        int cx = (int)Mathf.Floor(from.X / cellPx);
        int cy = (int)Mathf.Floor(from.Y / cellPx);
        int tcx = (int)Mathf.Floor(to.X / cellPx);
        int tcy = (int)Mathf.Floor(to.Y / cellPx);

        if (!openCells.Contains(new CellCoord(cx, cy)))
            return false;
        if (cx == tcx && cy == tcy)
            return true;

        int stepX = dx > 0 ? 1 : -1;
        int stepY = dy > 0 ? 1 : -1;

        float tDeltaX = Mathf.Abs(dx) > 0.001f ? Mathf.Abs(cellPx / dx) : float.PositiveInfinity;
        float tDeltaY = Mathf.Abs(dy) > 0.001f ? Mathf.Abs(cellPx / dy) : float.PositiveInfinity;

        float nextBX = (dx > 0 ? cx + 1 : cx) * cellPx;
        float nextBY = (dy > 0 ? cy + 1 : cy) * cellPx;

        float tMaxX = Mathf.Abs(dx) > 0.001f ? Mathf.Abs((nextBX - from.X) / dx) : float.PositiveInfinity;
        float tMaxY = Mathf.Abs(dy) > 0.001f ? Mathf.Abs((nextBY - from.Y) / dy) : float.PositiveInfinity;

        int maxSteps = Mathf.Abs(tcx - cx) + Mathf.Abs(tcy - cy) + 2;

        for (int step = 0; step < maxSteps; step++)
        {
            if (cx == tcx && cy == tcy)
                return true;

            int ncx = cx, ncy = cy;
            if (tMaxX < tMaxY)
            {
                ncx = cx + stepX;
                tMaxX += tDeltaX;
            }
            else
            {
                ncy = cy + stepY;
                tMaxY += tDeltaY;
            }

            if (!openCells.Contains(new CellCoord(ncx, ncy)))
                return false;
            if (!removedWalls.Contains(WallId.Create(cx, cy, ncx, ncy)))
                return false;

            cx = ncx;
            cy = ncy;
        }

        return cx == tcx && cy == tcy;
    }

    public static Vector2 GetEnemyMoveDir(
        Vector2 enemyPos, Vector2 playerPos,
        FlowField? flowField,
        HashSet<CellCoord> openCells, HashSet<WallId> removedWalls)
    {
        var dx = playerPos.X - enemyPos.X;
        var dy = playerPos.Y - enemyPos.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        if (dist < 0.001f)
            return Vector2.Zero;

        if (HasLineOfSight(openCells, removedWalls, enemyPos, playerPos))
            return new Vector2(dx / dist, dy / dist);

        if (flowField != null)
        {
            var dir = flowField.GetDirectionAt(enemyPos);
            if (dir != Vector2.Zero)
                return dir;
        }

        return new Vector2(dx / dist, dy / dist);
    }
}
