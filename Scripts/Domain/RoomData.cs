using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Domain;

public sealed class RoomData
{
    public int Idx;
    public int Size;
    public CellCoord CenterCell;
    public List<CellCoord> Cells = new();
    public HashSet<CellCoord> CellSet = new();

    public Vector2 GetCenterWorld(float cellPx)
    {
        float sumX = 0, sumY = 0;
        foreach (var c in Cells) { sumX += c.X; sumY += c.Y; }
        return new Vector2(
            (sumX / Cells.Count + 0.5f) * cellPx,
            (sumY / Cells.Count + 0.5f) * cellPx);
    }

    public CellCoord GetCenterCellCoord()
    {
        float sumX = 0, sumY = 0;
        foreach (var c in Cells) { sumX += c.X; sumY += c.Y; }
        return new CellCoord(
            Mathf.RoundToInt(sumX / Cells.Count),
            Mathf.RoundToInt(sumY / Cells.Count));
    }
}
