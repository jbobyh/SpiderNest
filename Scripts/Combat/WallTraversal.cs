using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Combat;

public static class WallTraversal
{
    public static bool CrossesWall(HashSet<WallId> removedWalls, Vector2 from, Vector2 to, float cellPx)
    {
        var c0 = CellCoord.FromWorld(from.X, from.Y, cellPx);
        var c1 = CellCoord.FromWorld(to.X, to.Y, cellPx);

        if (c0.X == c1.X && c0.Y == c1.Y)
            return false;

        if (c0.X != c1.X && c0.Y != c1.Y)
        {
            var wA1 = WallId.Create(c0.X, c0.Y, c1.X, c0.Y);
            var wA2 = WallId.Create(c1.X, c0.Y, c1.X, c1.Y);
            var pathA = removedWalls.Contains(wA1) && removedWalls.Contains(wA2);

            var wB1 = WallId.Create(c0.X, c0.Y, c0.X, c1.Y);
            var wB2 = WallId.Create(c0.X, c1.Y, c1.X, c1.Y);
            var pathB = removedWalls.Contains(wB1) && removedWalls.Contains(wB2);

            return !(pathA || pathB);
        }

        var w = WallId.Create(c0.X, c0.Y, c1.X, c1.Y);
        return !removedWalls.Contains(w);
    }

    public static bool InRoom(Vector2 pos, HashSet<CellCoord> openCells, float cellPx)
    {
        var c = CellCoord.FromWorld(pos.X, pos.Y, cellPx);
        return openCells.Contains(c);
    }

    public static WallHitResult WallHitPoint(Vector2 from, Vector2 to, float cellPx)
    {
        var c0 = CellCoord.FromWorld(from.X, from.Y, cellPx);
        var c1 = CellCoord.FromWorld(to.X, to.Y, cellPx);

        var dx = to.X - from.X;
        var dy = to.Y - from.Y;

        float t = 1f;
        float nx = 0f;
        float ny = 0f;

        if (c1.X > c0.X && dx != 0f)
        {
            var tx = (c1.X * cellPx - from.X) / dx;
            if (tx < t) { t = tx; nx = -1f; ny = 0f; }
        }
        else if (c1.X < c0.X && dx != 0f)
        {
            var tx = (c0.X * cellPx - from.X) / dx;
            if (tx < t) { t = tx; nx = 1f; ny = 0f; }
        }

        if (c1.Y > c0.Y && dy != 0f)
        {
            var tx = (c1.Y * cellPx - from.Y) / dy;
            if (tx < t) { t = tx; nx = 0f; ny = -1f; }
        }
        else if (c1.Y < c0.Y && dy != 0f)
        {
            var tx = (c0.Y * cellPx - from.Y) / dy;
            if (tx < t) { t = tx; nx = 0f; ny = 1f; }
        }

        if (t < 0f) t = 0f;

        const float halfWallFraction = 0.025f;
        var halfWall = cellPx * halfWallFraction;

        return new WallHitResult
        {
            Point = new Vector2(from.X + t * dx + nx * halfWall,
                                from.Y + t * dy + ny * halfWall),
            Normal = new Vector2(nx, ny)
        };
    }
}

public readonly struct WallHitResult
{
    public Vector2 Point { get; init; }
    public Vector2 Normal { get; init; }
}
