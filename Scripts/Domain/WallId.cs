namespace SpaceOrLife.Domain;

public readonly record struct WallId(CellCoord A, CellCoord B)
{
    public WallId Normalize()
    {
        if (A.X > B.X || (A.X == B.X && A.Y > B.Y))
            return new WallId(B, A);
        return this;
    }

    public static WallId Create(int ax, int ay, int bx, int by)
    {
        return new WallId(new CellCoord(ax, ay), new CellCoord(bx, by)).Normalize();
    }

    public static WallId Create(CellCoord a, CellCoord b)
    {
        return new WallId(a, b).Normalize();
    }

    public bool IsHorizontal => A.Y == B.Y;
    public bool IsVertical => A.X == B.X;
}
