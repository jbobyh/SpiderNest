using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;

namespace SpaceOrLife.World;

using SpaceOrLife.Domain;

public static class LevelGenerator
{
    private const int MaxGenerationAttempts = 1000;
    private const float FixedWallRatio = 0.4f;

    private static readonly CellCoord[] Cardinals =
    {
        new(1, 0), new(-1, 0), new(0, 1), new(0, -1)
    };

    private static readonly CellCoord[] WallDirs =
    {
        new(1, 0), new(0, 1)
    };

    private static readonly CellCoord[] Diagonals =
    {
        new(-1, -1), new(1, -1), new(-1, 1), new(1, 1)
    };

    public static LevelState Generate(
        int level,
        GameCatalog catalog,
        PlayerProgress progress,
        SeededRng rng)
    {
        var levelDef = catalog.Levels?.GetByLevel(level) ?? catalog.Levels?.GetByLevel(1);
        if (levelDef == null)
            throw new InvalidOperationException($"LevelDefinition {level} not found");

        var genResult = GenerateRooms(levelDef, rng);

        var rooms = genResult.Rooms;
        var blobCells = genResult.BlobCells;
        var removedWalls = genResult.RemovedWalls;
        var internalWalls = genResult.InternalWalls;

        var cellToRoom = new Dictionary<CellCoord, int>();
        foreach (var room in rooms)
        {
            foreach (var cell in room.Cells)
                cellToRoom[cell] = room.Idx;
        }

        var startCell = rooms[0].Cells[0];

        var interRoomWalls = CollectInterRoomWalls(blobCells, internalWalls, cellToRoom);
        var spanningWalls = ComputeSpanningTreeWalls(rooms, interRoomWalls, cellToRoom);
        var fixedWalls = SelectFixedWalls(interRoomWalls, spanningWalls, rng);

        var state = new LevelState
        {
            Level = level,
            Seed = rng.Seed,
            Rooms = rooms,
            BlobCells = blobCells,
            RemovedWalls = removedWalls,
            InternalWalls = internalWalls,
            FixedWalls = fixedWalls,
            CellToRoom = cellToRoom,
            StartCell = startCell,
            Purified = { 0 }
        };

        AssignRoomContents(level, levelDef, catalog, progress, state, rooms, rng, startCell);
        SpawnStasisEnemies(level, catalog, state, rooms, rng);
        GenerateRoomColors(state, rooms, rng);
        GenerateRoomAltars(state, rooms);
        ComputeGridSize(state);

        return state;
    }

    private static void ComputeGridSize(LevelState state)
    {
        int minX = state.StartCell.X, maxX = minX;
        int minY = state.StartCell.Y, maxY = minY;
        foreach (var c in state.BlobCells)
        {
            if (c.X < minX) minX = c.X;
            if (c.X > maxX) maxX = c.X;
            if (c.Y < minY) minY = c.Y;
            if (c.Y > maxY) maxY = c.Y;
        }
        state.GridSize = Math.Max(maxX - minX + 1, maxY - minY + 1);
    }

    private static void GenerateRoomColors(LevelState state, List<RoomData> rooms, SeededRng rng)
    {
        foreach (var room in rooms)
        {
            float hue = rng.NextFloat() * 360f;
            float sat = rng.NextFloatRange(18f, 40f);
            float lit = rng.NextFloatRange(7f, 12f);
            var color = Color.FromHsv(hue / 360f, sat / 100f, lit / 100f);
            foreach (var cell in room.Cells)
                state.RoomColors[cell] = color;
        }
    }

    private static void GenerateRoomAltars(LevelState state, List<RoomData> rooms)
    {
        var processed = new HashSet<int>();
        foreach (var (cell, content) in state.CellContents)
        {
            if (content.EnemyCount <= 0 || content.EnemiesReleased) continue;
            if (content.Type == RoomContentKind.Chest ||
                content.Type == RoomContentKind.SpatialChest ||
                content.Type == RoomContentKind.RoomBonus)
                continue;

            if (!state.CellToRoom.TryGetValue(cell, out var ri)) continue;
            if (!processed.Add(ri)) continue;

            var room = rooms[ri];
            var centerCell = room.GetCenterCellCoord();
            state.RoomAltars.Add(new AltarData
            {
                RoomIdx = ri,
                Position = centerCell.ToWorldCenter(GameConstants.CellPx),
                Cell = centerCell,
                Activated = false
            });
        }
    }

    private record GenRoomsResult(
        List<RoomData> Rooms,
        HashSet<CellCoord> BlobCells,
        HashSet<WallId> RemovedWalls,
        HashSet<WallId> InternalWalls);

    private static GenRoomsResult GenerateRooms(LevelDefinition def, SeededRng rng)
    {
        for (int attempt = 0; attempt < MaxGenerationAttempts; attempt++)
        {
            GenRoomsResult result = def.GenType == GenerationType.Grid
                ? GenerateRoomsGrid(def, rng)
                : GenerateRoomsRandom(def, rng);

            if (result.Rooms.Count >= def.RoomCount)
                return result;
        }

        throw new InvalidOperationException(
            $"Failed to generate level with {def.RoomCount} rooms after {MaxGenerationAttempts} attempts");
    }

    private static List<int> BuildRoomQuotaList(LevelDefinition def, SeededRng rng)
    {
        int remaining = def.RoomCount - 1;
        var sizes = new List<int>();

        for (int i = 0; i < def.Size4; i++) sizes.Add(4);
        for (int i = 0; i < def.Size3; i++) sizes.Add(3);
        for (int i = 0; i < def.Size2; i++) sizes.Add(2);

        if (sizes.Count > remaining)
            sizes.RemoveRange(remaining, sizes.Count - remaining);
        else
        {
            int singleCount = remaining - sizes.Count;
            for (int i = 0; i < singleCount; i++) sizes.Add(1);
        }

        rng.Shuffle(sizes);
        return sizes;
    }

    private static List<CellCoord> GenerateRoomShape(CellCoord center, int size, SeededRng rng)
    {
        var cells = new List<CellCoord>();
        var seen = new HashSet<CellCoord>();

        void Add(int x, int y)
        {
            var c = new CellCoord(x, y);
            if (seen.Add(c)) cells.Add(c);
        }

        Add(center.X, center.Y);

        if (size == 2)
        {
            if (rng.NextFloat() < 0.5f) Add(center.X + 1, center.Y);
            else Add(center.X, center.Y + 1);
            return cells;
        }

        if (size == 3)
        {
            if (rng.NextFloat() < 0.5f)
            {
                if (rng.NextFloat() < 0.5f) { Add(center.X - 1, center.Y); Add(center.X + 1, center.Y); }
                else { Add(center.X, center.Y - 1); Add(center.X, center.Y + 1); }
            }
            else
            {
                switch (rng.NextInt(4))
                {
                    case 0: Add(center.X + 1, center.Y); Add(center.X, center.Y + 1); break;
                    case 1: Add(center.X + 1, center.Y); Add(center.X, center.Y - 1); break;
                    case 2: Add(center.X - 1, center.Y); Add(center.X, center.Y + 1); break;
                    case 3: Add(center.X - 1, center.Y); Add(center.X, center.Y - 1); break;
                }
            }
            return cells;
        }

        if (size == 4)
        {
            int shape = rng.NextInt(3);
            if (shape == 0)
            {
                Add(center.X + 1, center.Y);
                Add(center.X, center.Y + 1);
                Add(center.X + 1, center.Y + 1);
            }
            else if (shape == 1)
            {
                bool horizontal = rng.NextFloat() < 0.5f;
                if (horizontal)
                {
                    Add(center.X - 1, center.Y);
                    Add(center.X + 1, center.Y);
                    if (rng.NextFloat() < 0.5f) Add(center.X - 1, center.Y + 1);
                    else Add(center.X - 1, center.Y - 1);
                }
                else
                {
                    Add(center.X, center.Y - 1);
                    Add(center.X, center.Y + 1);
                    if (rng.NextFloat() < 0.5f) Add(center.X + 1, center.Y - 1);
                    else Add(center.X - 1, center.Y - 1);
                }
            }
            else
            {
                bool horizontal = rng.NextFloat() < 0.5f;
                if (horizontal)
                {
                    Add(center.X - 1, center.Y);
                    Add(center.X + 1, center.Y);
                    if (rng.NextFloat() < 0.5f) Add(center.X, center.Y + 1);
                    else Add(center.X, center.Y - 1);
                }
                else
                {
                    Add(center.X, center.Y - 1);
                    Add(center.X, center.Y + 1);
                    if (rng.NextFloat() < 0.5f) Add(center.X + 1, center.Y);
                    else Add(center.X - 1, center.Y);
                }
            }
            return cells;
        }

        return cells;
    }

    private static List<WallId> GetInternalWalls(List<CellCoord> cells)
    {
        var walls = new List<WallId>();
        var cellSet = new HashSet<CellCoord>(cells);
        foreach (var c in cells)
        {
            if (cellSet.Contains(new CellCoord(c.X + 1, c.Y)))
                walls.Add(WallId.Create(c.X, c.Y, c.X + 1, c.Y));
            if (cellSet.Contains(new CellCoord(c.X, c.Y + 1)))
                walls.Add(WallId.Create(c.X, c.Y, c.X, c.Y + 1));
        }
        return walls;
    }

    private static GenRoomsResult GenerateRoomsRandom(LevelDefinition def, SeededRng rng)
    {
        var rooms = new List<RoomData>();
        var allCells = new Dictionary<CellCoord, int>();
        var removedWalls = new HashSet<WallId>();
        var internalWalls = new HashSet<WallId>();

        var sizes = BuildRoomQuotaList(def, rng);
        int nextIdx = 0;

        var startRoom = new RoomData
        {
            Idx = 0,
            Size = 1,
            Cells = { new CellCoord(0, 0) },
            CellSet = { new CellCoord(0, 0) },
            CenterCell = new CellCoord(0, 0)
        };
        rooms.Add(startRoom);
        allCells[new CellCoord(0, 0)] = 0;

        var frontier = new List<CellCoord> { new(0, 0) };

        while (rooms.Count < def.RoomCount && frontier.Count > 0)
        {
            int idx = rng.NextInt(frontier.Count);
            var frontierCell = frontier[idx];
            var dirs = new List<CellCoord>(Cardinals);
            rng.Shuffle(dirs);
            bool placed = false;

            foreach (var dir in dirs)
            {
                int size = nextIdx < sizes.Count ? sizes[nextIdx] : 1;
                var anchor = new CellCoord(frontierCell.X + dir.X, frontierCell.Y + dir.Y);
                var roomCells = GenerateRoomShape(anchor, size, rng);

                if (roomCells.Count == 0) continue;

                bool allFree = true;
                foreach (var cell in roomCells)
                {
                    if (allCells.ContainsKey(cell)) { allFree = false; break; }
                }
                if (!allFree) continue;

                bool hasAdj = false;
                if (roomCells.Count > 1)
                {
                    foreach (var cell in roomCells)
                    {
                        foreach (var nd in Cardinals)
                        {
                            if (allCells.ContainsKey(new CellCoord(cell.X + nd.X, cell.Y + nd.Y)))
                            { hasAdj = true; break; }
                        }
                        if (hasAdj) break;
                    }
                    if (!hasAdj) continue;
                }

                int roomIndex = rooms.Count;
                var room = new RoomData { Idx = roomIndex, Size = roomCells.Count };
                foreach (var cell in roomCells)
                {
                    room.Cells.Add(cell);
                    room.CellSet.Add(cell);
                    allCells[cell] = roomIndex;
                }
                room.CenterCell = room.GetCenterCellCoord();

                foreach (var w in GetInternalWalls(roomCells))
                {
                    removedWalls.Add(w);
                    internalWalls.Add(w);
                }

                rooms.Add(room);
                foreach (var cell in roomCells) frontier.Add(cell);
                nextIdx++;
                placed = true;
                break;
            }

            if (!placed) frontier.RemoveAt(idx);
        }

        return new GenRoomsResult(rooms, new HashSet<CellCoord>(allCells.Keys), removedWalls, internalWalls);
    }

    private static GenRoomsResult GenerateRoomsGrid(LevelDefinition def, SeededRng rng)
    {
        var sizes = BuildRoomQuotaList(def, rng);
        int totalCellsNeeded = 1;
        foreach (var s in sizes) totalCellsNeeded += s;

        int h = 5;
        int w = Mathf.CeilToInt((float)totalCellsNeeded / h);
        if (w < 5) { w = 5; h = Mathf.CeilToInt((float)totalCellsNeeded / w); }

        var rooms = new List<RoomData>();
        var allCells = new Dictionary<CellCoord, int>();
        var removedWalls = new HashSet<WallId>();
        var internalWalls = new HashSet<WallId>();

        var startCell = new CellCoord(0, h / 2);
        var startRoom = new RoomData
        {
            Idx = 0,
            Size = 1,
            Cells = { startCell },
            CellSet = { startCell },
            CenterCell = startCell
        };
        rooms.Add(startRoom);
        allCells[startCell] = 0;

        var quota = new Queue<int>(sizes);

        for (int x = 0; x < w; x++)
        {
            for (int y = 0; y < h; y++)
            {
                var cellKey = new CellCoord(x, y);
                if (allCells.ContainsKey(cellKey)) continue;

                int size = quota.Count > 0 ? quota.Dequeue() : 1;
                List<CellCoord> roomCells;

                if (size == 1)
                {
                    roomCells = new List<CellCoord> { cellKey };
                }
                else
                {
                    roomCells = new List<CellCoord> { cellKey };
                    var queue = new Queue<CellCoord>();
                    queue.Enqueue(cellKey);
                    var seenInSearch = new HashSet<CellCoord> { cellKey };

                    while (roomCells.Count < size && queue.Count > 0)
                    {
                        var curr = queue.Dequeue();
                        var dirs = new List<CellCoord>(Cardinals);
                        rng.Shuffle(dirs);
                        foreach (var d in dirs)
                        {
                            var nc = new CellCoord(curr.X + d.X, curr.Y + d.Y);
                            if (nc.X >= 0 && nc.X < w && nc.Y >= 0 && nc.Y < h &&
                                !allCells.ContainsKey(nc) && seenInSearch.Add(nc))
                            {
                                roomCells.Add(nc);
                                queue.Enqueue(nc);
                                if (roomCells.Count == size) break;
                            }
                        }
                    }
                }

                int roomIndex = rooms.Count;
                var room = new RoomData { Idx = roomIndex, Size = roomCells.Count };
                foreach (var cell in roomCells)
                {
                    room.Cells.Add(cell);
                    room.CellSet.Add(cell);
                    allCells[cell] = roomIndex;
                }
                room.CenterCell = room.GetCenterCellCoord();

                foreach (var wKey in GetInternalWalls(roomCells))
                {
                    removedWalls.Add(wKey);
                    internalWalls.Add(wKey);
                }

                rooms.Add(room);
            }
        }

        return new GenRoomsResult(rooms, new HashSet<CellCoord>(allCells.Keys), removedWalls, internalWalls);
    }

    private static List<WallId> CollectInterRoomWalls(
        HashSet<CellCoord> blobCells,
        HashSet<WallId> internalWalls,
        Dictionary<CellCoord, int> cellToRoom)
    {
        var result = new List<WallId>();
        foreach (var c in blobCells)
        {
            foreach (var d in WallDirs)
            {
                var nc = new CellCoord(c.X + d.X, c.Y + d.Y);
                if (!blobCells.Contains(nc)) continue;
                var wk = WallId.Create(c.X, c.Y, nc.X, nc.Y);
                if (internalWalls.Contains(wk)) continue;
                if (cellToRoom.TryGetValue(c, out var ra) && cellToRoom.TryGetValue(nc, out var rb) && ra == rb)
                    continue;
                result.Add(wk);
            }
        }
        return result;
    }

    private static HashSet<WallId> ComputeSpanningTreeWalls(
        List<RoomData> rooms,
        List<WallId> interRoomWalls,
        Dictionary<CellCoord, int> cellToRoom)
    {
        var adj = new Dictionary<int, List<(int to, WallId wall)>>();
        foreach (var wk in interRoomWalls)
        {
            int ra = cellToRoom[wk.A];
            int rb = cellToRoom[wk.B];
            if (!adj.ContainsKey(ra)) adj[ra] = new();
            if (!adj.ContainsKey(rb)) adj[rb] = new();
            adj[ra].Add((rb, wk));
            adj[rb].Add((ra, wk));
        }

        var spanning = new HashSet<WallId>();
        var visited = new HashSet<int> { 0 };
        var queue = new Queue<int>();
        queue.Enqueue(0);

        while (queue.Count > 0)
        {
            int ri = queue.Dequeue();
            if (!adj.TryGetValue(ri, out var edges)) continue;
            foreach (var e in edges)
            {
                if (!visited.Add(e.to)) continue;
                spanning.Add(e.wall);
                queue.Enqueue(e.to);
            }
        }

        return spanning;
    }

    private static HashSet<WallId> SelectFixedWalls(
        List<WallId> interRoomWalls,
        HashSet<WallId> spanningWalls,
        SeededRng rng)
    {
        var nonTree = new List<WallId>();
        foreach (var w in interRoomWalls)
            if (!spanningWalls.Contains(w)) nonTree.Add(w);

        rng.Shuffle(nonTree);
        int fixedCount = Mathf.FloorToInt(FixedWallRatio * interRoomWalls.Count);
        var fixedWalls = new HashSet<WallId>();
        for (int i = 0; i < fixedCount && i < nonTree.Count; i++)
            fixedWalls.Add(nonTree[i]);
        return fixedWalls;
    }

    private static void AssignRoomContents(
        int level,
        LevelDefinition def,
        GameCatalog catalog,
        PlayerProgress progress,
        LevelState state,
        List<RoomData> rooms,
        SeededRng rng,
        CellCoord startCell)
    {
        var assignments = new Dictionary<int, RoomContentKind>();
        assignments[0] = RoomContentKind.Start;

        var available = new List<int>();
        for (int i = 1; i < rooms.Count; i++) available.Add(i);
        rng.Shuffle(available);

        int bonusesToPlace = def.Bonuses;
        var largeRooms = available.FindAll(ri => rooms[ri].Size >= 3);
        rng.Shuffle(largeRooms);

        while (bonusesToPlace > 0 && largeRooms.Count > 0)
        {
            int ri = largeRooms[0];
            largeRooms.RemoveAt(0);
            assignments[ri] = RoomContentKind.RoomBonus;
            available.Remove(ri);
            bonusesToPlace--;
        }
        while (bonusesToPlace > 0 && available.Count > 0)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = RoomContentKind.RoomBonus;
            bonusesToPlace--;
        }

        if (available.Count > 0)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = RoomContentKind.SummonSphere;
        }

        int weaponCount = def.Weapons;
        if (level == 1)
        {
            var candidates = new List<int>();
            foreach (var d in Diagonals)
            {
                var k = new CellCoord(startCell.X + d.X, startCell.Y + d.Y);
                if (state.CellToRoom.TryGetValue(k, out var ri) && !assignments.ContainsKey(ri))
                    candidates.Add(ri);
            }
            rng.Shuffle(candidates);
            int count = Math.Min(weaponCount, candidates.Count);
            for (int i = 0; i < count; i++)
            {
                int ri = candidates[i];
                assignments[ri] = RoomContentKind.Weapon;
                available.Remove(ri);
            }
            weaponCount -= count;
        }

        for (int i = 0; i < weaponCount && available.Count > 0; i++)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = RoomContentKind.Weapon;
        }

        PlaceType(assignments, available, RoomContentKind.Heart, def.Hearts);
        PlaceType(assignments, available, RoomContentKind.Chest, def.Upgrades);
        PlaceType(assignments, available, RoomContentKind.SpatialChest, def.Cursed);

        int combatRoomCount = Mathf.FloorToInt(available.Count * def.EnemyRoomPercent);
        for (int i = 0; i < combatRoomCount && available.Count > 0; i++)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = RoomContentKind.Enemy;
        }

        while (available.Count > 0)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = RoomContentKind.Empty;
        }

        var weaponPool = BuildWeaponPool(catalog, progress, rng);
        foreach (var (ri, type) in assignments)
            ApplyRoomContent(ri, type, level, catalog, def, rooms, state, progress, weaponPool, rng);
    }

    private static void PlaceType(
        Dictionary<int, RoomContentKind> assignments,
        List<int> available,
        RoomContentKind type,
        int count)
    {
        int placed = 0;
        while (placed < count && available.Count > 0)
        {
            int ri = available[0];
            available.RemoveAt(0);
            assignments[ri] = type;
            placed++;
        }
    }

    private static List<string> BuildWeaponPool(GameCatalog catalog, PlayerProgress progress, SeededRng rng)
    {
        var all = new List<string> { "shotgun", "smg", "rifle", "revolver", "carbine" };
        var pool = new List<string>();
        foreach (var w in all)
            if (!progress.SpawnedWeapons.Contains(w)) pool.Add(w);
        rng.Shuffle(pool);
        return pool;
    }

    private static void ApplyRoomContent(
        int ri,
        RoomContentKind type,
        int level,
        GameCatalog catalog,
        LevelDefinition def,
        List<RoomData> rooms,
        LevelState state,
        PlayerProgress progress,
        List<string> weaponPool,
        SeededRng rng)
    {
        var room = rooms[ri];
        var center = room.GetCenterWorld(GameConstants.CellPx);
        var centerKey = room.GetCenterCellCoord();

        var preset = GenerateRoomEnemyComposition(level, type, room.Cells.Count, def, catalog, rng);

        void SetCells(RoomContentKind contentType, string? weaponId = null)
        {
            foreach (var cell in room.Cells)
            {
                var content = new CellContent
                {
                    Type = contentType,
                    RoomIdx = ri,
                    WeaponId = weaponId
                };
                if (preset.Count > 0)
                {
                    content.EnemyPreset = preset;
                    content.EnemyCount = CountEnemies(preset);
                }
                state.CellContents[cell] = content;
            }
        }

        switch (type)
        {
            case RoomContentKind.Start:
                SetCells(RoomContentKind.Empty);
                break;

            case RoomContentKind.SummonSphere:
                SetCells(type);
                state.SummonSphere = new SummonSphereData
                {
                    Position = center,
                    Cell = centerKey
                };
                break;

            case RoomContentKind.RoomBonus:
                SetCells(type);
                state.RoomBonusAltars.Add(new RoomBonusAltarData
                {
                    RoomIdx = ri,
                    Position = center,
                    Cell = centerKey
                });
                break;

            case RoomContentKind.Weapon:
                if (weaponPool.Count > 0)
                {
                    string weaponId = weaponPool[0];
                    weaponPool.RemoveAt(0);
                    SetCells(type, weaponId);
                    state.DroppedWeapons.Add(new DroppedWeaponData
                    {
                        Position = center,
                        Cell = centerKey,
                        WeaponId = weaponId
                    });
                    progress.SpawnedWeapons.Add(weaponId);
                }
                else
                {
                    SetCells(RoomContentKind.Empty);
                }
                break;

            case RoomContentKind.Heart:
                SetCells(type);
                state.Hearts.Add(new HeartData { Position = center, Cell = centerKey });
                break;

            case RoomContentKind.Chest:
                SetCells(type);
                state.UpgradeChests.Add(new ChestData { Position = center, Cell = centerKey });
                break;

            case RoomContentKind.SpatialChest:
                SetCells(type);
                state.SpatialChests.Add(new ChestData { Position = center, Cell = centerKey });
                break;

            case RoomContentKind.Enemy:
                SetCells(type);
                break;

            default:
                SetCells(RoomContentKind.Empty);
                break;
        }
    }

    private static int CountEnemies(Dictionary<EnemyKind, int> preset)
    {
        int total = 0;
        foreach (var count in preset.Values) total += count;
        return total;
    }

    private static readonly Dictionary<RoomContentKind, string> ContentBudgetKey = new()
    {
        { RoomContentKind.SummonSphere, "summonSphere" },
        { RoomContentKind.RoomBonus, "roomBonus" },
        { RoomContentKind.Heart, "heart" },
        { RoomContentKind.Chest, "chest" },
        { RoomContentKind.SpatialChest, "spatial" },
        { RoomContentKind.Enemy, "enemies" }
    };

    private static readonly Dictionary<string, float> ContentBudgetMult = new()
    {
        { "enemies", 1.0f },
        { "heart", 1.5f },
        { "summonSphere", 1.4f },
        { "chest", 1.15f },
        { "spatial", 1.15f },
        { "roomBonus", 1.15f }
    };

    private static readonly Dictionary<int, float> LevelMult = new()
    {
        { 1, 1.0f }, { 2, 1.2f }, { 3, 1.5f }
    };

    private const float BudgetBase = 100f;
    private const float BudgetGrowthRate = 1.4f;
    private const int MaxEnemiesPerCell = 8;
    private const int MaxEnemiesTotal = 32;

    private static int RoomEnemyBudget(int level, RoomContentKind roomType, int cellCount)
    {
        if (!ContentBudgetKey.TryGetValue(roomType, out var multKey)) return 0;
        float levelMult = LevelMult.GetValueOrDefault(level, 1f);
        float contentMult = ContentBudgetMult.GetValueOrDefault(multKey, 1f);
        float raw = BudgetBase * Mathf.Pow(BudgetGrowthRate, Math.Max(0, cellCount - 1));
        return Mathf.RoundToInt(raw * levelMult * contentMult);
    }

    private static Dictionary<EnemyKind, int> GenerateRoomEnemyComposition(
        int level,
        RoomContentKind roomType,
        int cellCount,
        LevelDefinition def,
        GameCatalog catalog,
        SeededRng rng)
    {
        var result = new Dictionary<EnemyKind, int>();
        int budget = RoomEnemyBudget(level, roomType, cellCount);
        if (budget <= 0) return result;

        int maxByCells = cellCount * MaxEnemiesPerCell;
        int maxEnemies = Math.Min(maxByCells, MaxEnemiesTotal);

        var candidates = new List<(EnemyKind kind, int cost, int weight)>();
        for (int i = 0; i < def.SpawnKinds.Count; i++)
        {
            var kind = def.SpawnKinds[i];
            int weight = i < def.SpawnWeights.Count ? def.SpawnWeights[i] : 0;
            if (weight <= 0) continue;
            var enemyDef = catalog.Enemies?.GetByKind(kind);
            if (enemyDef == null || enemyDef.Cost <= 0 || enemyDef.Cost > budget) continue;
            candidates.Add((kind, enemyDef.Cost, weight));
        }
        candidates.Sort((a, b) => a.cost.CompareTo(b.cost));
        if (candidates.Count == 0) return result;

        int remaining = budget;
        int total = 0;

        while (total < maxEnemies)
        {
            var affordable = new List<(EnemyKind kind, int cost, int weight)>();
            int totalWeight = 0;
            foreach (var c in candidates)
            {
                if (c.cost <= remaining) { affordable.Add(c); totalWeight += c.weight; }
            }
            if (affordable.Count == 0) break;

            float roll = rng.NextFloat() * totalWeight;
            var picked = affordable[affordable.Count - 1];
            foreach (var c in affordable)
            {
                roll -= c.weight;
                if (roll <= 0) { picked = c; break; }
            }

            result[picked.kind] = result.GetValueOrDefault(picked.kind) + 1;
            remaining -= picked.cost;
            total++;
        }

        return result;
    }

    private static void SpawnStasisEnemies(
        int level,
        GameCatalog catalog,
        LevelState state,
        List<RoomData> rooms,
        SeededRng rng)
    {
        var processed = new HashSet<int>();
        foreach (var (cell, content) in state.CellContents)
        {
            if (content.EnemyCount <= 0) continue;
            if (!state.CellToRoom.TryGetValue(cell, out var ri)) continue;
            if (!processed.Add(ri)) continue;

            SpawnEnemiesFromPreset(level, catalog, content.EnemyPreset, rooms[ri], state, rng);
        }
    }

    private static void SpawnEnemiesFromPreset(
        int level,
        GameCatalog catalog,
        Dictionary<EnemyKind, int> preset,
        RoomData room,
        LevelState state,
        SeededRng rng)
    {
        const int maxAttempts = 20;

        foreach (var (kind, count) in preset)
        {
            if (count <= 0) continue;
            var enemyDef = catalog.Enemies?.GetByKind(kind);
            float radius = enemyDef?.Radius ?? 7f;
            float visualScale = enemyDef?.VisualScale ?? 2.9f;
            float hp = (enemyDef?.Hp ?? 120f) * GetHpMult(level);
            float margin = (enemyDef?.SpawnMargin ?? 10f) + radius;

            for (int i = 0; i < count; i++)
            {
                float gx = 0, gy = 0;
                for (int attempt = 0; attempt < maxAttempts; attempt++)
                {
                    var cell = rng.Pick(room.Cells);
                    gx = cell.X * GameConstants.CellPx + margin + rng.NextFloat() * (GameConstants.CellPx - margin * 2);
                    gy = cell.Y * GameConstants.CellPx + margin + rng.NextFloat() * (GameConstants.CellPx - margin * 2);

                    bool ok = true;
                    foreach (var existing in state.TrappedSpiders)
                    {
                        float minDist = radius + existing.Radius;
                        float dx = gx - existing.X;
                        float dy = gy - existing.Y;
                        if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
                    }
                    if (ok) break;
                }

                state.TrappedSpiders.Add(new StasisEnemyData
                {
                    Type = kind,
                    X = gx,
                    Y = gy,
                    Level = level,
                    RoomIdx = room.Idx,
                    Hp = hp,
                    Radius = radius,
                    VisualScale = visualScale
                });
            }
        }
    }

    private static float GetHpMult(int level) => level switch
    {
        1 => 1f,
        2 => 2f,
        3 => 4f,
        _ => 1f
    };
}
