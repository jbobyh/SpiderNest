using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public static class BattleSystem
{
    public static HashSet<CellCoord> GetConnectedCells(HashSet<CellCoord> openCells, CellCoord start)
    {
        var connected = new HashSet<CellCoord> { start };
        var queue = new Queue<CellCoord>();
        queue.Enqueue(start);

        while (queue.Count > 0)
        {
            var cell = queue.Dequeue();
            foreach (var dir in CellCoord.Cardinals)
            {
                var next = cell + dir;
                if (openCells.Contains(next) && !connected.Contains(next))
                {
                    connected.Add(next);
                    queue.Enqueue(next);
                }
            }
        }
        return connected;
    }

    public static (int minX, int minY, int maxX, int maxY) GetCellBounds(HashSet<CellCoord> cells)
    {
        int minX = int.MaxValue, minY = int.MaxValue;
        int maxX = int.MinValue, maxY = int.MinValue;
        foreach (var c in cells)
        {
            if (c.X < minX) minX = c.X;
            if (c.X > maxX) maxX = c.X;
            if (c.Y < minY) minY = c.Y;
            if (c.Y > maxY) maxY = c.Y;
        }
        return (minX, minY, maxX, maxY);
    }

    public static (float zoom, float centerX, float centerY) CalculateBattleZoom(
        HashSet<CellCoord> battleCells, float cellPx, float viewW, float viewH, float zoomMult)
    {
        var (minX, minY, maxX, maxY) = GetCellBounds(battleCells);
        int bCols = maxX - minX + 1;
        int bRows = maxY - minY + 1;
        float wallPad = cellPx * GameConstants.WallPad;
        float scaleX = viewW / (bCols * cellPx + wallPad * 2f);
        float scaleY = viewH / (bRows * cellPx + wallPad * 2f);
        float zoom = Mathf.Min(scaleX, scaleY) * zoomMult;
        float centerX = (minX + bCols / 2f) * cellPx;
        float centerY = (minY + bRows / 2f) * cellPx;
        return (zoom, centerX, centerY);
    }

    public static BattleState CreateBattleState(LevelState state, CellCoord openedCell, Vector2 playerPos)
    {
        var cp = GameConstants.CellPx;

        var allOpenCells = new HashSet<CellCoord>(state.OpenCells) { openedCell };
        var playerCell = CellCoord.FromWorld(playerPos.X, playerPos.Y, cp);
        var battleCells = GetConnectedCells(allOpenCells, playerCell);

        var (zoom, centerX, centerY) = CalculateBattleZoom(
            battleCells, cp, GameConstants.ViewWidth, GameConstants.ViewHeight, GameConstants.BattleZoomMult);

        var roomCenter = GetRoomCenterCell(state, openedCell);

        foreach (var k in battleCells)
        {
            if (state.CellContents.TryGetValue(k, out var content))
            {
                if (content.EnemyCount > 0)
                    content.EnemiesReleased = true;
            }
        }

        return new BattleState
        {
            BattleCells = battleCells,
            OpenedCellKey = openedCell,
            RoomCellKey = roomCenter,
            IsBossBattle = false,
            PendingSpawns = new List<PendingSpawn>(),
            FreezeTimer = 0f,
            Zoom = zoom,
            CenterX = centerX,
            CenterY = centerY,
        };
    }

    public static BattleState CreateBossBattleState(
        LevelState state, BossDefinition bossDef, Vector2 playerPos)
    {
        var cp = GameConstants.CellPx;
        var battleCells = new HashSet<CellCoord>(state.OpenCells);

        var (zoom, centerX, centerY) = CalculateBattleZoom(
            battleCells, cp, GameConstants.ViewWidth, GameConstants.ViewHeight, GameConstants.BattleZoomMult);

        return new BattleState
        {
            BattleCells = battleCells,
            OpenedCellKey = null,
            RoomCellKey = null,
            IsBossBattle = true,
            PendingSpawns = new List<PendingSpawn>(),
            FreezeTimer = 0f,
            Zoom = zoom,
            CenterX = centerX,
            CenterY = centerY,
        };
    }

    public static CellCoord? FindFarthestCell(HashSet<CellCoord> cells, Vector2 playerPos, float cellPx)
    {
        CellCoord? farthest = null;
        float maxDist = -1f;
        foreach (var c in cells)
        {
            var center = c.ToWorldCenter(cellPx);
            var d = center.DistanceTo(playerPos);
            if (d > maxDist)
            {
                maxDist = d;
                farthest = c;
            }
        }
        return farthest;
    }

    public static Vector2 CalculateBossSpawnPos(CellCoord farthestCell, Vector2 playerPos, float cellPx, float margin)
    {
        var relX = playerPos.X - farthestCell.X * cellPx;
        var relY = playerPos.Y - farthestCell.Y * cellPx;
        float bossX = farthestCell.X * cellPx + (relX < cellPx / 2f ? cellPx - margin : margin);
        float bossY = farthestCell.Y * cellPx + (relY < cellPx / 2f ? cellPx - margin : margin);
        return new Vector2(bossX, bossY);
    }

    public static float CalculateBossHp(BossDefinition bossDef, EnemyCatalog enemyCatalog)
    {
        if (bossDef.HpSource == BossHpSource.Fixed)
            return bossDef.HpFixed;

        var baseKind = bossDef.HpSource == BossHpSource.Buldyga
            ? EnemyKind.Buldyga
            : EnemyKind.Soldier;
        var baseDef = enemyCatalog.GetByKind(baseKind);
        var baseHp = baseDef?.Hp ?? 120f;
        return baseHp * bossDef.HpMult;
    }

    public static void ExitBattleMode(LevelState state)
    {
        if (state.Battle == null) return;
        var b = state.Battle;

        if (b.BattleCells != null && state.Rooms != null && state.Purified != null)
        {
            for (int ri = 0; ri < state.Rooms.Count; ri++)
            {
                var room = state.Rooms[ri];
                bool hasEnemyContent = false;
                foreach (var c in room.Cells)
                {
                    if (state.CellContents.TryGetValue(c, out var content) && content.EnemyCount > 0)
                    {
                        hasEnemyContent = true;
                        break;
                    }
                }
                if (!hasEnemyContent) continue;

                bool inBattle = false;
                foreach (var c in room.Cells)
                {
                    if (b.BattleCells.Contains(c))
                    {
                        inBattle = true;
                        break;
                    }
                }
                if (!inBattle) continue;
                if (state.Purified.Contains(ri)) continue;

                SpawnRoomRewards(state, room.CenterCell);
                state.Purified.Add(ri);
                UpdateRevealedRoomsOnPurify(state, ri);
            }
        }

        if (state.BossDefeated && state.ExitCell.HasValue)
        {
            state.OpenCells.Add(state.ExitCell.Value);
            state.EverRevealedCells.Add(state.ExitCell.Value);
            state.EverOpenedCells.Add(state.ExitCell.Value);
        }

        state.Battle = null;
    }

    public static void SpawnRoomRewards(LevelState state, CellCoord roomCell)
    {
        foreach (var heart in state.Hearts)
        {
            if (heart.Cell.Equals(roomCell))
                heart.Spawned = true;
        }
        foreach (var chest in state.UpgradeChests)
        {
            if (chest.Cell.Equals(roomCell))
                chest.Spawned = true;
        }
        foreach (var chest in state.SpatialChests)
        {
            if (chest.Cell.Equals(roomCell))
                chest.Spawned = true;
        }
        if (state.SummonSphere != null && state.SummonSphere.Cell.Equals(roomCell))
            state.SummonSphere.Spawned = true;
    }

    public static void UpdateRevealedRoomsOnPurify(LevelState state, int purifiedRoomIdx)
    {
        if (state.Rooms == null || state.CellToRoom == null) return;
        if (purifiedRoomIdx < 0 || purifiedRoomIdx >= state.Rooms.Count) return;

        var purifiedRoom = state.Rooms[purifiedRoomIdx];
        var purifiedCellSet = new HashSet<CellCoord>(purifiedRoom.Cells);

        var adjacentRooms = new HashSet<int>();
        foreach (var pc in purifiedRoom.Cells)
        {
            foreach (var dir in CellCoord.Cardinals)
            {
                var neighbor = pc + dir;
                if (purifiedCellSet.Contains(neighbor)) continue;
                if (state.CellToRoom.TryGetValue(neighbor, out var neighborRoomIdx))
                {
                    if (neighborRoomIdx != purifiedRoomIdx && !state.Purified.Contains(neighborRoomIdx))
                        adjacentRooms.Add(neighborRoomIdx);
                }
            }
        }

        foreach (var roomIdx in adjacentRooms)
        {
            foreach (var cell in state.Rooms[roomIdx].Cells)
                state.EverRevealedCells.Add(cell);
        }
    }

    private static CellCoord? GetRoomCenterCell(LevelState state, CellCoord openedCell)
    {
        if (state.CellToRoom.TryGetValue(openedCell, out var roomIdx))
        {
            if (roomIdx >= 0 && roomIdx < state.Rooms.Count)
            {
                return state.Rooms[roomIdx].GetCenterCellCoord();
            }
        }
        return openedCell;
    }
}
