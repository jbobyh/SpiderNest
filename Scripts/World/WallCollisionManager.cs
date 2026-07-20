using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public partial class WallCollisionManager : StaticBody2D
{
    private readonly Dictionary<WallId, CollisionPolygon2D> _wallSegments = new();
    private readonly List<CollisionPolygon2D> _externalSegments = new();
    private readonly Stack<CollisionPolygon2D> _pool = new();

    private static readonly float WallThickness = GameConstants.CellPx * 0.05f;

    public override void _Ready()
    {
        CollisionLayer = 1u;
        CollisionMask = 0u;
    }

    public void SyncWalls(LevelState state)
    {
        ClearAll();

        foreach (var cell in state.BlobCells)
        {
            for (int i = 0; i < 2; i++)
            {
                var d = i == 0 ? new CellCoord(1, 0) : new CellCoord(0, 1);
                var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
                if (!state.BlobCells.Contains(nc)) continue;

                var wall = WallId.Create(cell, nc);
                if (state.InternalWalls.Contains(wall)) continue;
                if (state.RemovedWalls.Contains(wall)) continue;

                AddInterRoomSegment(wall, cell, nc);
            }
        }

        SyncExternalWalls(state);
    }

    public void ToggleWall(WallId wall, bool open)
    {
        if (_wallSegments.TryGetValue(wall, out var segment))
        {
            segment.Disabled = open;
        }
        else if (!open)
        {
            var a = wall.A;
            var b = wall.B;
            AddInterRoomSegment(wall, a, b);
        }
    }

    private void AddInterRoomSegment(WallId wall, CellCoord a, CellCoord b)
    {
        var poly = AcquirePolygon();
        ConfigureSegmentPolygon(poly, a, b);
        _wallSegments[wall] = poly;
    }

    private void SyncExternalWalls(LevelState state)
    {
        var dirs = new[]
        {
            (new CellCoord(1, 0), true),
            (new CellCoord(-1, 0), true),
            (new CellCoord(0, 1), false),
            (new CellCoord(0, -1), false),
        };

        var seen = new HashSet<(CellCoord, CellCoord)>();

        foreach (var cell in state.BlobCells)
        {
            foreach (var (d, _) in dirs)
            {
                var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
                if (state.BlobCells.Contains(nc)) continue;

                var key = (cell, nc);
                if (!seen.Add(key)) continue;

                var poly = AcquirePolygon();
                ConfigureExternalPolygon(poly, cell, d);
                _externalSegments.Add(poly);
            }
        }
    }

    private static void ConfigureSegmentPolygon(CollisionPolygon2D poly, CellCoord a, CellCoord b)
    {
        float cx, cy, w, h;

        if (a.X == b.X)
        {
            cx = a.X * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            cy = b.Y * GameConstants.CellPx;
            w = GameConstants.CellPx;
            h = WallThickness;
        }
        else
        {
            cx = b.X * GameConstants.CellPx;
            cy = a.Y * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            w = WallThickness;
            h = GameConstants.CellPx;
        }

        poly.Polygon = MakeRect(cx, cy, w, h);
        poly.Disabled = false;
    }

    private static void ConfigureExternalPolygon(CollisionPolygon2D poly, CellCoord cell, CellCoord dir)
    {
        float cx, cy, w, h;
        var ht = WallThickness * 0.5f;

        if (dir.X == 1)
        {
            cx = (cell.X + 1) * GameConstants.CellPx;
            cy = cell.Y * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            w = WallThickness;
            h = GameConstants.CellPx;
        }
        else if (dir.X == -1)
        {
            cx = cell.X * GameConstants.CellPx;
            cy = cell.Y * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            w = WallThickness;
            h = GameConstants.CellPx;
        }
        else if (dir.Y == 1)
        {
            cx = cell.X * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            cy = (cell.Y + 1) * GameConstants.CellPx;
            w = GameConstants.CellPx;
            h = WallThickness;
        }
        else
        {
            cx = cell.X * GameConstants.CellPx + GameConstants.CellPx * 0.5f;
            cy = cell.Y * GameConstants.CellPx;
            w = GameConstants.CellPx;
            h = WallThickness;
        }

        poly.Polygon = MakeRect(cx, cy, w, h);
        poly.Disabled = false;
    }

    private static Vector2[] MakeRect(float cx, float cy, float w, float h)
    {
        var hw = w * 0.5f;
        var hh = h * 0.5f;
        return new[]
        {
            new Vector2(cx - hw, cy - hh),
            new Vector2(cx + hw, cy - hh),
            new Vector2(cx + hw, cy + hh),
            new Vector2(cx - hw, cy + hh),
        };
    }

    private CollisionPolygon2D AcquirePolygon()
    {
        if (_pool.TryPop(out var poly))
        {
            poly.Visible = true;
            AddChild(poly);
            return poly;
        }

        poly = new CollisionPolygon2D();
        AddChild(poly);
        return poly;
    }

    private void ReleasePolygon(CollisionPolygon2D poly)
    {
        RemoveChild(poly);
        poly.Visible = false;
        _pool.Push(poly);
    }

    private void ClearAll()
    {
        foreach (var seg in _wallSegments.Values)
            ReleasePolygon(seg);
        _wallSegments.Clear();

        foreach (var seg in _externalSegments)
            ReleasePolygon(seg);
        _externalSegments.Clear();
    }
}
