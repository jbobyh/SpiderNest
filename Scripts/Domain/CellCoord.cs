using System;

namespace SpaceOrLife.Domain;

public readonly record struct CellCoord(int X, int Y)
{
    public static CellCoord FromWorld(float wx, float wy, float cellPx)
    {
        return new CellCoord(
            (int)Math.Floor(wx / cellPx),
            (int)Math.Floor(wy / cellPx));
    }

    public Godot.Vector2 ToWorldCenter(float cellPx)
    {
        return new Godot.Vector2((X + 0.5f) * cellPx, (Y + 0.5f) * cellPx);
    }

    public Godot.Vector2I ToVector2I() => new(X, Y);

    public static CellCoord operator +(CellCoord a, CellCoord b) => new(a.X + b.X, a.Y + b.Y);

    public static readonly CellCoord Zero = new(0, 0);

    public static readonly CellCoord[] Cardinals =
    {
        new(1, 0), new(-1, 0), new(0, 1), new(0, -1)
    };

    public static readonly CellCoord[] Diagonals =
    {
        new(1, 1), new(-1, 1), new(1, -1), new(-1, -1)
    };
}
