using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public static class LevelStateFactory
{
    private static readonly CellCoord[] Cardinals =
    {
        new(1, 0), new(-1, 0), new(0, 1), new(0, -1)
    };

    public static LevelState Create(
        int level,
        GameCatalog catalog,
        PlayerProgress progress,
        ulong seed)
    {
        var rng = new SeededRng(seed);
        var state = LevelGenerator.Generate(level, catalog, progress, rng);

        ComputeInitialVisibility(state);

        return state;
    }

    public static void ComputeInitialVisibility(LevelState state)
    {
        state.OpenCells.Clear();
        state.EverOpenedCells.Clear();
        state.EverRevealedCells.Clear();

        state.OpenCells.Add(state.StartCell);
        state.EverOpenedCells.Add(state.StartCell);
        state.EverRevealedCells.Add(state.StartCell);

        foreach (var purifiedIdx in state.Purified)
        {
            if (purifiedIdx < 0 || purifiedIdx >= state.Rooms.Count) continue;
            foreach (var cell in state.Rooms[purifiedIdx].Cells)
                state.EverRevealedCells.Add(cell);
        }

        foreach (var purifiedIdx in state.Purified)
        {
            if (purifiedIdx < 0 || purifiedIdx >= state.Rooms.Count) continue;
            var purifiedCells = state.Rooms[purifiedIdx].CellSet;

            foreach (var pc in purifiedCells)
            {
                foreach (var d in Cardinals)
                {
                    var nc = new CellCoord(pc.X + d.X, pc.Y + d.Y);
                    if (purifiedCells.Contains(nc)) continue;
                    if (!state.CellToRoom.TryGetValue(nc, out var neighborIdx)) continue;
                    if (state.Purified.Contains(neighborIdx)) continue;
                    if (neighborIdx < 0 || neighborIdx >= state.Rooms.Count) continue;
                    foreach (var cell in state.Rooms[neighborIdx].Cells)
                        state.EverRevealedCells.Add(cell);
                }
            }
        }
    }
}
