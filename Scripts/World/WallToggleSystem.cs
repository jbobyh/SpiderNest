using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public enum WallToggleResult
{
    None,
    Opened,
    Closed,
    Denied,
    AutoClosed,
}

public sealed class WallToggleOutcome
{
    public WallToggleResult Result;
    public WallId Wall;
    public Vector2 WallMidpoint;
    public Vector2 HeartFrom;
    public Vector2 HeartTo;
    public WallId? AutoClosedWall;
    public Vector2 AutoCloseMidpoint;
}

public static class WallToggleSystem
{
    private static readonly CellCoord[] Cardinals =
    {
        new(1, 0), new(-1, 0), new(0, 1), new(0, -1),
    };

    private static readonly CellCoord[] WallScanDirs =
    {
        new(1, 0), new(0, 1),
    };

    public static WallId? GetWallAtPoint(HashSet<CellCoord> blobCells, Vector2 point)
    {
        var snapR = GameConstants.CellPx * GameConstants.WallSnapRadius;
        var snapR2 = snapR * snapR;

        var cx0 = (int)Math.Floor((point.X - snapR) / GameConstants.CellPx) - 1;
        var cx1 = (int)Math.Floor((point.X + snapR) / GameConstants.CellPx) + 1;
        var cy0 = (int)Math.Floor((point.Y - snapR) / GameConstants.CellPx) - 1;
        var cy1 = (int)Math.Floor((point.Y + snapR) / GameConstants.CellPx) + 1;

        float bestDist2 = float.MaxValue;
        WallId? best = null;

        for (var gx = cx0; gx <= cx1; gx++)
        {
            for (var gy = cy0; gy <= cy1; gy++)
            {
                var cell = new CellCoord(gx, gy);
                if (!blobCells.Contains(cell)) continue;

                foreach (var d in WallScanDirs)
                {
                    var nc = new CellCoord(gx + d.X, gy + d.Y);
                    if (!blobCells.Contains(nc)) continue;

                    var midX = (gx + nc.X + 1) * 0.5f * GameConstants.CellPx;
                    var midY = (gy + nc.Y + 1) * 0.5f * GameConstants.CellPx;
                    var dx = point.X - midX;
                    var dy = point.Y - midY;
                    var d2 = dx * dx + dy * dy;

                    if (d2 < snapR2 && d2 < bestDist2)
                    {
                        bestDist2 = d2;
                        best = WallId.Create(cell, nc);
                    }
                }
            }
        }

        return best;
    }

    public static HashSet<CellCoord> RecomputeOpenCells(
        HashSet<CellCoord> blobCells,
        HashSet<WallId> removedWalls,
        CellCoord seed)
    {
        var open = new HashSet<CellCoord> { seed };
        var queue = new Queue<CellCoord>();
        queue.Enqueue(seed);

        while (queue.Count > 0)
        {
            var cell = queue.Dequeue();
            foreach (var d in Cardinals)
            {
                var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
                if (!blobCells.Contains(nc) || open.Contains(nc)) continue;

                var wall = WallId.Create(cell, nc);
                if (removedWalls.Contains(wall))
                {
                    open.Add(nc);
                    queue.Enqueue(nc);
                }
            }
        }

        return open;
    }

    public static CellCoord GetPlayerSeedCell(LevelState state, Vector2 playerPos)
    {
        var pc = CellCoord.FromWorld(playerPos.X, playerPos.Y, GameConstants.CellPx);
        return state.BlobCells.Contains(pc) ? pc : state.StartCell;
    }

    public static void DoOpenWall(LevelState state, WallId wall, Vector2 playerPos)
    {
        state.RemovedWalls.Add(wall);
        var seed = GetPlayerSeedCell(state, playerPos);
        state.OpenCells = RecomputeOpenCells(state.BlobCells, state.RemovedWalls, seed);

        if (!state.EverOpenedCells.Contains(wall.A))
            state.EverOpenedCells.Add(wall.A);
        if (!state.EverOpenedCells.Contains(wall.B))
            state.EverOpenedCells.Add(wall.B);

        TryPurifyRoomIfEmpty(state, wall.A);
        TryPurifyRoomIfEmpty(state, wall.B);
    }

    public static void DoCloseWall(LevelState state, WallId wall, Vector2 playerPos)
    {
        state.RemovedWalls.Remove(wall);
        var seed = GetPlayerSeedCell(state, playerPos);
        state.OpenCells = RecomputeOpenCells(state.BlobCells, state.RemovedWalls, seed);
    }

    public static bool TryPurifyRoomIfEmpty(LevelState state, CellCoord cell)
    {
        if (!state.CellToRoom.TryGetValue(cell, out var roomIdx)) return false;
        if (state.Purified.Contains(roomIdx)) return false;
        if (roomIdx < 0 || roomIdx >= state.Rooms.Count) return false;

        var room = state.Rooms[roomIdx];
        var isEmpty = true;
        foreach (var c in room.Cells)
        {
            if (state.CellContents.TryGetValue(c, out var content) && content.EnemyCount > 0)
            {
                isEmpty = false;
                break;
            }
        }

        if (!isEmpty) return false;

        state.Purified.Add(roomIdx);
        UpdateRevealedRoomsOnPurify(state, roomIdx);
        return true;
    }

    public static void UpdateRevealedRoomsOnPurify(LevelState state, int purifiedRoomIdx)
    {
        if (purifiedRoomIdx < 0 || purifiedRoomIdx >= state.Rooms.Count) return;
        var purifiedRoom = state.Rooms[purifiedRoomIdx];

        var adjacentRooms = new HashSet<int>();

        foreach (var cell in purifiedRoom.Cells)
        {
            foreach (var d in Cardinals)
            {
                var nc = new CellCoord(cell.X + d.X, cell.Y + d.Y);
                if (purifiedRoom.CellSet.Contains(nc)) continue;

                if (state.CellToRoom.TryGetValue(nc, out var neighborIdx) &&
                    neighborIdx != purifiedRoomIdx &&
                    !state.Purified.Contains(neighborIdx))
                {
                    adjacentRooms.Add(neighborIdx);
                }
            }
        }

        foreach (var roomIdx in adjacentRooms)
        {
            if (roomIdx < 0 || roomIdx >= state.Rooms.Count) continue;
            foreach (var cell in state.Rooms[roomIdx].Cells)
            {
                if (!state.EverRevealedCells.Contains(cell))
                    state.EverRevealedCells.Add(cell);
            }
        }
    }

    public static WallId? FindAutoCloseWall(LevelState state, WallId exclude, Vector2 playerPos)
    {
        WallId? best = null;
        float bestDist = float.MaxValue;

        foreach (var wk in state.RemovedWalls)
        {
            if (wk == exclude) continue;
            if (state.InternalWalls.Contains(wk)) continue;
            if (state.FixedWalls.Contains(wk)) continue;

            var aOpen = state.OpenCells.Contains(wk.A);
            var bOpen = state.OpenCells.Contains(wk.B);
            if (!aOpen && !bOpen) continue;

            var midX = (wk.A.X + wk.B.X + 1) * 0.5f * GameConstants.CellPx;
            var midY = (wk.A.Y + wk.B.Y + 1) * 0.5f * GameConstants.CellPx;
            var dist = MathF.Sqrt(
                (midX - playerPos.X) * (midX - playerPos.X) +
                (midY - playerPos.Y) * (midY - playerPos.Y));

            if (dist < bestDist)
            {
                bestDist = dist;
                best = wk;
            }
        }

        return best;
    }

    public static WallToggleOutcome? TryToggle(
        LevelState state,
        PlayerProgress progress,
        Vector2 mouseWorld,
        Vector2 playerPos)
    {
        var wallOpt = GetWallAtPoint(state.BlobCells, mouseWorld);
        if (wallOpt == null) return null;

        var wall = wallOpt.Value;

        if (state.InternalWalls.Contains(wall)) return null;
        if (state.FixedWalls.Contains(wall)) return null;

        var aOpen = state.OpenCells.Contains(wall.A);
        var bOpen = state.OpenCells.Contains(wall.B);
        if (!aOpen && !bOpen) return null;

        var wallMid = new Vector2(
            (wall.A.X + wall.B.X + 1) * 0.5f * GameConstants.CellPx,
            (wall.A.Y + wall.B.Y + 1) * 0.5f * GameConstants.CellPx);

        var roomA = state.CellToRoom.TryGetValue(wall.A, out var ra) ? ra : -1;
        var roomB = state.CellToRoom.TryGetValue(wall.B, out var rb) ? rb : -1;
        var purifiedA = roomA >= 0 && state.Purified.Contains(roomA);
        var purifiedB = roomB >= 0 && state.Purified.Contains(roomB);

        if (!state.RemovedWalls.Contains(wall))
        {
            if (progress.Lives < 1) return null;
            if (!purifiedA && !purifiedB) return null;

            var outcome = new WallToggleOutcome
            {
                Wall = wall,
                WallMidpoint = wallMid,
            };

            if (progress.Lives == 1)
            {
                var autoClose = FindAutoCloseWall(state, wall, playerPos);
                if (autoClose == null) return null;

                var acWall = autoClose.Value;
                DoCloseWall(state, acWall, playerPos);

                outcome.Result = WallToggleResult.AutoClosed;
                outcome.AutoClosedWall = acWall;
                outcome.AutoCloseMidpoint = new Vector2(
                    (acWall.A.X + acWall.B.X + 1) * 0.5f * GameConstants.CellPx,
                    (acWall.A.Y + acWall.B.Y + 1) * 0.5f * GameConstants.CellPx);
                outcome.HeartFrom = outcome.AutoCloseMidpoint;
                outcome.HeartTo = wallMid;
                return outcome;
            }

            progress.Lives -= 1;
            state.PlayerRemovedWalls++;
            outcome.Result = WallToggleResult.Opened;
            outcome.HeartFrom = playerPos;
            outcome.HeartTo = wallMid;
            return outcome;
        }
        else
        {
            if (progress.Lives >= GameConstants.MaxLives) return null;
            if (!purifiedA && !purifiedB) return null;

            var outcome = new WallToggleOutcome
            {
                Wall = wall,
                WallMidpoint = wallMid,
                Result = WallToggleResult.Closed,
                HeartFrom = wallMid,
                HeartTo = playerPos,
            };
            return outcome;
        }
    }

    public static Vector2 GetWallMidpoint(WallId wall)
    {
        return new Vector2(
            (wall.A.X + wall.B.X + 1) * 0.5f * GameConstants.CellPx,
            (wall.A.Y + wall.B.Y + 1) * 0.5f * GameConstants.CellPx);
    }
}
