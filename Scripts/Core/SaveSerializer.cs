using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SpaceOrLife.Core;

public static class SaveSerializer
{
    private static readonly JsonSerializerOptions _options = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        IncludeFields = false
    };

    public static string Serialize(SaveData data)
    {
        return JsonSerializer.Serialize(data, _options);
    }

    public static SaveData? Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<SaveData>(json, _options);
        }
        catch
        {
            return null;
        }
    }

    // ── PlayerProgress ──────────────────────────────────────────

    public static PlayerProgressDto ToDto(PlayerProgress p)
    {
        return new PlayerProgressDto
        {
            Level = p.Level,
            Lives = p.Lives,
            TotalLives = p.TotalLives,
            Souls = p.Souls,
            WeaponSlots = new List<string>(p.WeaponSlots),
            ActiveSlot = p.ActiveSlot,
            MaxSlots = p.MaxSlots,
            Ammo = new List<int>(p.Ammo),
            SpawnedWeapons = new List<string>(p.SpawnedWeapons),
            UpgradeLevels = new Dictionary<string, int>(p.UpgradeLevels),
            Upgrades = ToDto(p.Upgrades),
            BossDefeated = p.BossDefeated
        };
    }

    public static PlayerProgress FromDto(PlayerProgressDto dto)
    {
        return new PlayerProgress
        {
            Level = dto.Level,
            Lives = dto.Lives,
            TotalLives = dto.TotalLives,
            Souls = dto.Souls,
            WeaponSlots = new List<string>(dto.WeaponSlots),
            ActiveSlot = dto.ActiveSlot,
            MaxSlots = dto.MaxSlots,
            Ammo = new List<int>(dto.Ammo),
            SpawnedWeapons = new List<string>(dto.SpawnedWeapons),
            UpgradeLevels = new Dictionary<string, int>(dto.UpgradeLevels),
            Upgrades = FromDto(dto.Upgrades),
            BossDefeated = dto.BossDefeated
        };
    }

    // ── UpgradeState ────────────────────────────────────────────

    public static UpgradeStateDto ToDto(UpgradeState u)
    {
        return new UpgradeStateDto
        {
            DamageMult = u.DamageMult,
            CooldownMult = u.CooldownMult,
            SpeedMult = u.SpeedMult,
            SpreadMult = u.SpreadMult,
            BulletSpeedMult = u.BulletSpeedMult,
            CritChance = u.CritChance,
            CritDamage = u.CritDamage,
            BloomReduction = u.BloomReduction,
            ExtraBulletChance = u.ExtraBulletChance,
            HitStun = u.HitStun,
            IncendiaryChance = u.IncendiaryChance,
            FreezeChance = u.FreezeChance,
            Penetrate = u.Penetrate,
            Shield = u.Shield,
            Retreat = u.Retreat,
            KillAccel = u.KillAccel,
            KillAccelPercent = u.KillAccelPercent,
            EnhancedPierce = u.EnhancedPierce,
            InfinitePenetrate = u.InfinitePenetrate,
            InfiniteRange = u.InfiniteRange,
            Ricochet = u.Ricochet,
            LastLife = u.LastLife,
            BattleSpeed = u.BattleSpeed,
            Freeze = u.Freeze,
            RandomBonus = u.RandomBonus,
            LongRange = u.LongRange,
            Sniper = u.Sniper,
            SpatialReloadRooms = u.SpatialReloadRooms,
            SpatialReloadHearts = u.SpatialReloadHearts,
            SpatialRangeRooms = u.SpatialRangeRooms,
            SpatialRangeHearts = u.SpatialRangeHearts,
            SpatialAccuracyRooms = u.SpatialAccuracyRooms,
            SpatialAccuracyHearts = u.SpatialAccuracyHearts,
            SpatialBulletSpeedRooms = u.SpatialBulletSpeedRooms,
            SpatialBulletSpeedHearts = u.SpatialBulletSpeedHearts,
            SpatialSpeedRooms = u.SpatialSpeedRooms,
            SpatialSpeedHearts = u.SpatialSpeedHearts,
            SpatialCritChanceRooms = u.SpatialCritChanceRooms,
            SpatialCritChanceHearts = u.SpatialCritChanceHearts,
            SpatialCritDamageRooms = u.SpatialCritDamageRooms,
            SpatialCritDamageHearts = u.SpatialCritDamageHearts,
            SpatialPenetrateRooms = u.SpatialPenetrateRooms,
            SpatialPenetrateHearts = u.SpatialPenetrateHearts
        };
    }

    public static UpgradeState FromDto(UpgradeStateDto d)
    {
        return new UpgradeState
        {
            DamageMult = d.DamageMult,
            CooldownMult = d.CooldownMult,
            SpeedMult = d.SpeedMult,
            SpreadMult = d.SpreadMult,
            BulletSpeedMult = d.BulletSpeedMult,
            CritChance = d.CritChance,
            CritDamage = d.CritDamage,
            BloomReduction = d.BloomReduction,
            ExtraBulletChance = d.ExtraBulletChance,
            HitStun = d.HitStun,
            IncendiaryChance = d.IncendiaryChance,
            FreezeChance = d.FreezeChance,
            Penetrate = d.Penetrate,
            Shield = d.Shield,
            Retreat = d.Retreat,
            KillAccel = d.KillAccel,
            KillAccelPercent = d.KillAccelPercent,
            EnhancedPierce = d.EnhancedPierce,
            InfinitePenetrate = d.InfinitePenetrate,
            InfiniteRange = d.InfiniteRange,
            Ricochet = d.Ricochet,
            LastLife = d.LastLife,
            BattleSpeed = d.BattleSpeed,
            Freeze = d.Freeze,
            RandomBonus = d.RandomBonus,
            LongRange = d.LongRange,
            Sniper = d.Sniper,
            SpatialReloadRooms = d.SpatialReloadRooms,
            SpatialReloadHearts = d.SpatialReloadHearts,
            SpatialRangeRooms = d.SpatialRangeRooms,
            SpatialRangeHearts = d.SpatialRangeHearts,
            SpatialAccuracyRooms = d.SpatialAccuracyRooms,
            SpatialAccuracyHearts = d.SpatialAccuracyHearts,
            SpatialBulletSpeedRooms = d.SpatialBulletSpeedRooms,
            SpatialBulletSpeedHearts = d.SpatialBulletSpeedHearts,
            SpatialSpeedRooms = d.SpatialSpeedRooms,
            SpatialSpeedHearts = d.SpatialSpeedHearts,
            SpatialCritChanceRooms = d.SpatialCritChanceRooms,
            SpatialCritChanceHearts = d.SpatialCritChanceHearts,
            SpatialCritDamageRooms = d.SpatialCritDamageRooms,
            SpatialCritDamageHearts = d.SpatialCritDamageHearts,
            SpatialPenetrateRooms = d.SpatialPenetrateRooms,
            SpatialPenetrateHearts = d.SpatialPenetrateHearts
        };
    }

    // ── LevelState ──────────────────────────────────────────────

    public static LevelStateDto ToDto(LevelState s, Vector2 playerPos)
    {
        var dto = new LevelStateDto
        {
            Level = s.Level,
            Seed = unchecked((long)s.Seed),
            GridSize = s.GridSize,
            PlayerX = playerPos.X,
            PlayerY = playerPos.Y,
            PlayerRemovedWalls = s.PlayerRemovedWalls,
            BossDefeated = s.BossDefeated,
            BossSummonReady = s.BossSummonReady,
            Souls = s.Souls,
            HeartsCollected = s.HeartsCollected,
            SummonSphereCollected = s.SummonSphereCollected,
            RevealedExit = s.RevealedExit,
            StartCell = new[] { s.StartCell.X, s.StartCell.Y },
            ExitCell = s.ExitCell.HasValue ? new[] { s.ExitCell.Value.X, s.ExitCell.Value.Y } : null
        };

        foreach (var r in s.Rooms)
        {
            var roomDto = new RoomDataDto
            {
                Idx = r.Idx,
                Size = r.Size,
                CenterCell = new[] { r.CenterCell.X, r.CenterCell.Y }
            };
            foreach (var c in r.Cells)
                roomDto.Cells.Add(new[] { c.X, c.Y });
            dto.Rooms.Add(roomDto);
        }

        dto.BlobCells = CellsToList(s.BlobCells);
        dto.OpenCells = CellsToList(s.OpenCells);
        dto.RemovedWalls = WallsToList(s.RemovedWalls);
        dto.InternalWalls = WallsToList(s.InternalWalls);
        dto.FixedWalls = WallsToList(s.FixedWalls);
        dto.PermanentlyClosed = CellsToList(s.PermanentlyClosed);
        dto.DisabledCells = CellsToList(s.DisabledCells);
        dto.EverRevealedCells = CellsToList(s.EverRevealedCells);
        dto.EverOpenedCells = CellsToList(s.EverOpenedCells);
        dto.Purified = new List<int>(s.Purified);

        foreach (var kvp in s.CellContents)
        {
            var c = kvp.Value;
            var entry = new CellContentEntryDto
            {
                Cell = new[] { kvp.Key.X, kvp.Key.Y },
                Type = (int)c.Type,
                EnemyCount = c.EnemyCount,
                EnemiesReleased = c.EnemiesReleased,
                RoomIdx = c.RoomIdx,
                WeaponId = c.WeaponId
            };
            foreach (var ep in c.EnemyPreset)
                entry.EnemyPreset.Add(new[] { (int)ep.Key, ep.Value });
            dto.CellContents.Add(entry);
        }

        foreach (var kvp in s.CellToRoom)
            dto.CellToRoom.Add(new[] { kvp.Key.X, kvp.Key.Y, kvp.Value });

        foreach (var kvp in s.RoomColors)
            dto.RoomColors.Add(new RoomColorEntryDto
            {
                Cell = new[] { kvp.Key.X, kvp.Key.Y },
                Color = new[] { kvp.Value.R, kvp.Value.G, kvp.Value.B }
            });

        foreach (var h in s.Hearts)
            dto.Hearts.Add(new HeartDataDto
            {
                Position = new[] { h.Position.X, h.Position.Y },
                Cell = new[] { h.Cell.X, h.Cell.Y },
                Collected = h.Collected,
                Spawned = h.Spawned
            });

        if (s.SummonSphere != null)
        {
            dto.SummonSphere = new SummonSphereDto
            {
                Position = new[] { s.SummonSphere.Position.X, s.SummonSphere.Position.Y },
                Cell = new[] { s.SummonSphere.Cell.X, s.SummonSphere.Cell.Y },
                Collected = s.SummonSphere.Collected,
                Spawned = s.SummonSphere.Spawned
            };
        }

        foreach (var c in s.UpgradeChests)
            dto.UpgradeChests.Add(ChestToDto(c));

        foreach (var c in s.SpatialChests)
            dto.SpatialChests.Add(ChestToDto(c));

        foreach (var w in s.DroppedWeapons)
            dto.DroppedWeapons.Add(new DroppedWeaponDto
            {
                Position = new[] { w.Position.X, w.Position.Y },
                Cell = new[] { w.Cell.X, w.Cell.Y },
                WeaponId = w.WeaponId
            });

        foreach (var e in s.TrappedSpiders)
            dto.TrappedSpiders.Add(new StasisEnemyDto
            {
                Type = (int)e.Type,
                X = e.X,
                Y = e.Y,
                Level = e.Level,
                RoomIdx = e.RoomIdx,
                Hp = e.Hp,
                Radius = e.Radius,
                VisualScale = e.VisualScale
            });

        foreach (var a in s.RoomAltars)
            dto.RoomAltars.Add(AltarToDto(a));

        foreach (var a in s.RoomBonusAltars)
        {
            dto.RoomBonusAltars.Add(new RoomBonusAltarDto
            {
                RoomIdx = a.RoomIdx,
                Position = new[] { a.Position.X, a.Position.Y },
                Cell = new[] { a.Cell.X, a.Cell.Y },
                Activated = a.Activated,
                BonusType = a.BonusType
            });
        }

        foreach (var b in s.RoomBonuses)
            dto.RoomBonuses.Add(new RoomBonusAssignmentDto
            {
                RoomIdx = b.RoomIdx,
                BonusType = b.BonusType
            });

        return dto;
    }

    public static LevelState FromDto(LevelStateDto d)
    {
        var s = new LevelState
        {
            Level = d.Level,
            Seed = unchecked((ulong)d.Seed),
            GridSize = d.GridSize,
            PlayerRemovedWalls = d.PlayerRemovedWalls,
            BossDefeated = d.BossDefeated,
            BossSummonReady = d.BossSummonReady,
            Souls = d.Souls,
            HeartsCollected = d.HeartsCollected,
            SummonSphereCollected = d.SummonSphereCollected,
            RevealedExit = d.RevealedExit,
            StartCell = new CellCoord(d.StartCell[0], d.StartCell[1]),
            ExitCell = d.ExitCell != null
                ? new CellCoord(d.ExitCell[0], d.ExitCell[1])
                : null,
            Battle = null,
            PendingChoice = null
        };

        foreach (var r in d.Rooms)
        {
            var room = new RoomData
            {
                Idx = r.Idx,
                Size = r.Size,
                CenterCell = new CellCoord(r.CenterCell[0], r.CenterCell[1])
            };
            foreach (var c in r.Cells)
            {
                var coord = new CellCoord(c[0], c[1]);
                room.Cells.Add(coord);
                room.CellSet.Add(coord);
            }
            s.Rooms.Add(room);
        }

        s.BlobCells = ListToCells(d.BlobCells);
        s.OpenCells = ListToCells(d.OpenCells);
        s.RemovedWalls = ListToWalls(d.RemovedWalls);
        s.InternalWalls = ListToWalls(d.InternalWalls);
        s.FixedWalls = ListToWalls(d.FixedWalls);
        s.PermanentlyClosed = ListToCells(d.PermanentlyClosed);
        s.DisabledCells = ListToCells(d.DisabledCells);
        s.EverRevealedCells = ListToCells(d.EverRevealedCells);
        s.EverOpenedCells = ListToCells(d.EverOpenedCells);
        s.Purified = new HashSet<int>(d.Purified);

        foreach (var e in d.CellContents)
        {
            var coord = new CellCoord(e.Cell[0], e.Cell[1]);
            var content = new CellContent
            {
                Type = (RoomContentKind)e.Type,
                EnemyCount = e.EnemyCount,
                EnemiesReleased = e.EnemiesReleased,
                RoomIdx = e.RoomIdx,
                WeaponId = e.WeaponId
            };
            foreach (var ep in e.EnemyPreset)
                content.EnemyPreset[(EnemyKind)ep[0]] = ep[1];
            s.CellContents[coord] = content;
        }

        foreach (var entry in d.CellToRoom)
            s.CellToRoom[new CellCoord(entry[0], entry[1])] = entry[2];

        foreach (var rc in d.RoomColors)
            s.RoomColors[new CellCoord(rc.Cell[0], rc.Cell[1])] =
                new Color(rc.Color[0], rc.Color[1], rc.Color[2]);

        foreach (var h in d.Hearts)
            s.Hearts.Add(new HeartData
            {
                Position = new Vector2(h.Position[0], h.Position[1]),
                Cell = new CellCoord(h.Cell[0], h.Cell[1]),
                Collected = h.Collected,
                Spawned = h.Spawned
            });

        if (d.SummonSphere != null)
        {
            s.SummonSphere = new SummonSphereData
            {
                Position = new Vector2(d.SummonSphere.Position[0], d.SummonSphere.Position[1]),
                Cell = new CellCoord(d.SummonSphere.Cell[0], d.SummonSphere.Cell[1]),
                Collected = d.SummonSphere.Collected,
                Spawned = d.SummonSphere.Spawned
            };
        }

        foreach (var c in d.UpgradeChests)
            s.UpgradeChests.Add(ChestFromDto(c));

        foreach (var c in d.SpatialChests)
            s.SpatialChests.Add(ChestFromDto(c));

        foreach (var w in d.DroppedWeapons)
            s.DroppedWeapons.Add(new DroppedWeaponData
            {
                Position = new Vector2(w.Position[0], w.Position[1]),
                Cell = new CellCoord(w.Cell[0], w.Cell[1]),
                WeaponId = w.WeaponId
            });

        foreach (var e in d.TrappedSpiders)
            s.TrappedSpiders.Add(new StasisEnemyData
            {
                Type = (EnemyKind)e.Type,
                X = e.X,
                Y = e.Y,
                Level = e.Level,
                RoomIdx = e.RoomIdx,
                Hp = e.Hp,
                Radius = e.Radius,
                VisualScale = e.VisualScale
            });

        foreach (var a in d.RoomAltars)
            s.RoomAltars.Add(AltarFromDto(a));

        foreach (var a in d.RoomBonusAltars)
        {
            s.RoomBonusAltars.Add(new RoomBonusAltarData
            {
                RoomIdx = a.RoomIdx,
                Position = new Vector2(a.Position[0], a.Position[1]),
                Cell = new CellCoord(a.Cell[0], a.Cell[1]),
                Activated = a.Activated,
                BonusType = a.BonusType
            });
        }

        foreach (var b in d.RoomBonuses)
            s.RoomBonuses.Add(new RoomBonusAssignment
            {
                RoomIdx = b.RoomIdx,
                BonusType = b.BonusType
            });

        return s;
    }

    // ── Helpers ─────────────────────────────────────────────────

    private static List<int[]> CellsToList(HashSet<CellCoord> cells)
    {
        var list = new List<int[]>(cells.Count);
        foreach (var c in cells)
            list.Add(new[] { c.X, c.Y });
        return list;
    }

    private static HashSet<CellCoord> ListToCells(List<int[]> list)
    {
        var set = new HashSet<CellCoord>(list.Count);
        foreach (var c in list)
            set.Add(new CellCoord(c[0], c[1]));
        return set;
    }

    private static List<int[]> WallsToList(HashSet<WallId> walls)
    {
        var list = new List<int[]>(walls.Count);
        foreach (var w in walls)
            list.Add(new[] { w.A.X, w.A.Y, w.B.X, w.B.Y });
        return list;
    }

    private static HashSet<WallId> ListToWalls(List<int[]> list)
    {
        var set = new HashSet<WallId>(list.Count);
        foreach (var w in list)
            set.Add(WallId.Create(w[0], w[1], w[2], w[3]));
        return set;
    }

    private static ChestDataDto ChestToDto(ChestData c)
    {
        return new ChestDataDto
        {
            Position = new[] { c.Position.X, c.Position.Y },
            Cell = new[] { c.Cell.X, c.Cell.Y },
            Collected = c.Collected,
            Spawned = c.Spawned
        };
    }

    private static ChestData ChestFromDto(ChestDataDto c)
    {
        return new ChestData
        {
            Position = new Vector2(c.Position[0], c.Position[1]),
            Cell = new CellCoord(c.Cell[0], c.Cell[1]),
            Collected = c.Collected,
            Spawned = c.Spawned
        };
    }

    private static AltarDto AltarToDto(AltarData a)
    {
        return new AltarDto
        {
            RoomIdx = a.RoomIdx,
            Position = new[] { a.Position.X, a.Position.Y },
            Cell = new[] { a.Cell.X, a.Cell.Y },
            Activated = a.Activated
        };
    }

    private static AltarData AltarFromDto(AltarDto a)
    {
        return new AltarData
        {
            RoomIdx = a.RoomIdx,
            Position = new Vector2(a.Position[0], a.Position[1]),
            Cell = new CellCoord(a.Cell[0], a.Cell[1]),
            Activated = a.Activated
        };
    }
}
