using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SpaceOrLife.Core;

public sealed class SaveData
{
    [JsonPropertyName("version")]
    public int Version { get; set; }

    [JsonPropertyName("currentLevel")]
    public int CurrentLevel { get; set; }

    [JsonPropertyName("playerProgress")]
    public PlayerProgressDto PlayerProgress { get; set; } = new();

    [JsonPropertyName("levelState")]
    public LevelStateDto? LevelState { get; set; }
}

public sealed class PlayerProgressDto
{
    [JsonPropertyName("level")] public int Level { get; set; }
    [JsonPropertyName("lives")] public int Lives { get; set; }
    [JsonPropertyName("totalLives")] public int TotalLives { get; set; }
    [JsonPropertyName("souls")] public int Souls { get; set; }
    [JsonPropertyName("weaponSlots")] public List<string> WeaponSlots { get; set; } = new();
    [JsonPropertyName("activeSlot")] public int ActiveSlot { get; set; }
    [JsonPropertyName("maxSlots")] public int MaxSlots { get; set; }
    [JsonPropertyName("ammo")] public List<int> Ammo { get; set; } = new();
    [JsonPropertyName("spawnedWeapons")] public List<string> SpawnedWeapons { get; set; } = new();
    [JsonPropertyName("upgradeLevels")] public Dictionary<string, int> UpgradeLevels { get; set; } = new();
    [JsonPropertyName("upgrades")] public UpgradeStateDto Upgrades { get; set; } = new();
    [JsonPropertyName("bossDefeated")] public bool BossDefeated { get; set; }
}

public sealed class UpgradeStateDto
{
    [JsonPropertyName("damageMult")] public float DamageMult { get; set; }
    [JsonPropertyName("cooldownMult")] public float CooldownMult { get; set; } = 1f;
    [JsonPropertyName("speedMult")] public float SpeedMult { get; set; } = 1f;
    [JsonPropertyName("spreadMult")] public float SpreadMult { get; set; } = 1f;
    [JsonPropertyName("bulletSpeedMult")] public float BulletSpeedMult { get; set; } = 1f;
    [JsonPropertyName("critChance")] public float CritChance { get; set; }
    [JsonPropertyName("critDamage")] public float CritDamage { get; set; }
    [JsonPropertyName("bloomReduction")] public float BloomReduction { get; set; }
    [JsonPropertyName("extraBulletChance")] public float ExtraBulletChance { get; set; }
    [JsonPropertyName("hitStun")] public float HitStun { get; set; }
    [JsonPropertyName("incendiaryChance")] public float IncendiaryChance { get; set; }
    [JsonPropertyName("freezeChance")] public float FreezeChance { get; set; }
    [JsonPropertyName("penetrate")] public int Penetrate { get; set; }
    [JsonPropertyName("shield")] public int Shield { get; set; }
    [JsonPropertyName("retreat")] public float Retreat { get; set; }
    [JsonPropertyName("killAccel")] public bool KillAccel { get; set; }
    [JsonPropertyName("killAccelPercent")] public float KillAccelPercent { get; set; }
    [JsonPropertyName("enhancedPierce")] public bool EnhancedPierce { get; set; }
    [JsonPropertyName("infinitePenetrate")] public bool InfinitePenetrate { get; set; }
    [JsonPropertyName("infiniteRange")] public bool InfiniteRange { get; set; }
    [JsonPropertyName("ricochet")] public bool Ricochet { get; set; }
    [JsonPropertyName("lastLife")] public bool LastLife { get; set; }
    [JsonPropertyName("battleSpeed")] public bool BattleSpeed { get; set; }
    [JsonPropertyName("freeze")] public bool Freeze { get; set; }
    [JsonPropertyName("randomBonus")] public bool RandomBonus { get; set; }
    [JsonPropertyName("longRange")] public bool LongRange { get; set; }
    [JsonPropertyName("sniper")] public bool Sniper { get; set; }

    [JsonPropertyName("spatialReloadRooms")] public bool SpatialReloadRooms { get; set; }
    [JsonPropertyName("spatialReloadHearts")] public bool SpatialReloadHearts { get; set; }
    [JsonPropertyName("spatialRangeRooms")] public bool SpatialRangeRooms { get; set; }
    [JsonPropertyName("spatialRangeHearts")] public bool SpatialRangeHearts { get; set; }
    [JsonPropertyName("spatialAccuracyRooms")] public bool SpatialAccuracyRooms { get; set; }
    [JsonPropertyName("spatialAccuracyHearts")] public bool SpatialAccuracyHearts { get; set; }
    [JsonPropertyName("spatialBulletSpeedRooms")] public bool SpatialBulletSpeedRooms { get; set; }
    [JsonPropertyName("spatialBulletSpeedHearts")] public bool SpatialBulletSpeedHearts { get; set; }
    [JsonPropertyName("spatialSpeedRooms")] public bool SpatialSpeedRooms { get; set; }
    [JsonPropertyName("spatialSpeedHearts")] public bool SpatialSpeedHearts { get; set; }
    [JsonPropertyName("spatialCritChanceRooms")] public bool SpatialCritChanceRooms { get; set; }
    [JsonPropertyName("spatialCritChanceHearts")] public bool SpatialCritChanceHearts { get; set; }
    [JsonPropertyName("spatialCritDamageRooms")] public bool SpatialCritDamageRooms { get; set; }
    [JsonPropertyName("spatialCritDamageHearts")] public bool SpatialCritDamageHearts { get; set; }
    [JsonPropertyName("spatialPenetrateRooms")] public bool SpatialPenetrateRooms { get; set; }
    [JsonPropertyName("spatialPenetrateHearts")] public bool SpatialPenetrateHearts { get; set; }
}

public sealed class LevelStateDto
{
    [JsonPropertyName("level")] public int Level { get; set; }
    [JsonPropertyName("seed")] public long Seed { get; set; }
    [JsonPropertyName("gridSize")] public int GridSize { get; set; }

    [JsonPropertyName("rooms")] public List<RoomDataDto> Rooms { get; set; } = new();
    [JsonPropertyName("blobCells")] public List<int[]> BlobCells { get; set; } = new();
    [JsonPropertyName("openCells")] public List<int[]> OpenCells { get; set; } = new();
    [JsonPropertyName("removedWalls")] public List<int[]> RemovedWalls { get; set; } = new();
    [JsonPropertyName("internalWalls")] public List<int[]> InternalWalls { get; set; } = new();
    [JsonPropertyName("fixedWalls")] public List<int[]> FixedWalls { get; set; } = new();
    [JsonPropertyName("permanentlyClosed")] public List<int[]> PermanentlyClosed { get; set; } = new();
    [JsonPropertyName("disabledCells")] public List<int[]> DisabledCells { get; set; } = new();

    [JsonPropertyName("cellContents")] public List<CellContentEntryDto> CellContents { get; set; } = new();
    [JsonPropertyName("cellToRoom")] public List<int[]> CellToRoom { get; set; } = new();
    [JsonPropertyName("roomColors")] public List<RoomColorEntryDto> RoomColors { get; set; } = new();

    [JsonPropertyName("startCell")] public int[] StartCell { get; set; } = new int[2];
    [JsonPropertyName("exitCell")] public int[]? ExitCell { get; set; }

    [JsonPropertyName("everRevealedCells")] public List<int[]> EverRevealedCells { get; set; } = new();
    [JsonPropertyName("everOpenedCells")] public List<int[]> EverOpenedCells { get; set; } = new();
    [JsonPropertyName("purified")] public List<int> Purified { get; set; } = new();

    [JsonPropertyName("hearts")] public List<HeartDataDto> Hearts { get; set; } = new();
    [JsonPropertyName("heartsCollected")] public int HeartsCollected { get; set; }
    [JsonPropertyName("summonSphere")] public SummonSphereDto? SummonSphere { get; set; }
    [JsonPropertyName("summonSphereCollected")] public bool SummonSphereCollected { get; set; }
    [JsonPropertyName("upgradeChests")] public List<ChestDataDto> UpgradeChests { get; set; } = new();
    [JsonPropertyName("spatialChests")] public List<ChestDataDto> SpatialChests { get; set; } = new();
    [JsonPropertyName("droppedWeapons")] public List<DroppedWeaponDto> DroppedWeapons { get; set; } = new();
    [JsonPropertyName("revealedExit")] public bool RevealedExit { get; set; }

    [JsonPropertyName("trappedSpiders")] public List<StasisEnemyDto> TrappedSpiders { get; set; } = new();
    [JsonPropertyName("roomAltars")] public List<AltarDto> RoomAltars { get; set; } = new();
    [JsonPropertyName("roomBonusAltars")] public List<RoomBonusAltarDto> RoomBonusAltars { get; set; } = new();
    [JsonPropertyName("roomBonuses")] public List<RoomBonusAssignmentDto> RoomBonuses { get; set; } = new();

    [JsonPropertyName("playerRemovedWalls")] public int PlayerRemovedWalls { get; set; }
    [JsonPropertyName("bossDefeated")] public bool BossDefeated { get; set; }
    [JsonPropertyName("bossSummonReady")] public bool BossSummonReady { get; set; }
    [JsonPropertyName("souls")] public int Souls { get; set; }

    [JsonPropertyName("playerX")] public float PlayerX { get; set; }
    [JsonPropertyName("playerY")] public float PlayerY { get; set; }
}

public sealed class RoomDataDto
{
    [JsonPropertyName("idx")] public int Idx { get; set; }
    [JsonPropertyName("size")] public int Size { get; set; }
    [JsonPropertyName("centerCell")] public int[] CenterCell { get; set; } = new int[2];
    [JsonPropertyName("cells")] public List<int[]> Cells { get; set; } = new();
}

public sealed class CellContentEntryDto
{
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("type")] public int Type { get; set; }
    [JsonPropertyName("enemyPreset")] public List<int[]> EnemyPreset { get; set; } = new();
    [JsonPropertyName("enemyCount")] public int EnemyCount { get; set; }
    [JsonPropertyName("enemiesReleased")] public bool EnemiesReleased { get; set; }
    [JsonPropertyName("roomIdx")] public int RoomIdx { get; set; }
    [JsonPropertyName("weaponId")] public string? WeaponId { get; set; }
}

public sealed class RoomColorEntryDto
{
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("color")] public float[] Color { get; set; } = new float[3];
}

public sealed class HeartDataDto
{
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("collected")] public bool Collected { get; set; }
    [JsonPropertyName("spawned")] public bool Spawned { get; set; }
}

public sealed class SummonSphereDto
{
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("collected")] public bool Collected { get; set; }
    [JsonPropertyName("spawned")] public bool Spawned { get; set; }
}

public sealed class ChestDataDto
{
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("collected")] public bool Collected { get; set; }
    [JsonPropertyName("spawned")] public bool Spawned { get; set; }
}

public sealed class DroppedWeaponDto
{
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("weaponId")] public string WeaponId { get; set; } = "";
}

public sealed class StasisEnemyDto
{
    [JsonPropertyName("type")] public int Type { get; set; }
    [JsonPropertyName("x")] public float X { get; set; }
    [JsonPropertyName("y")] public float Y { get; set; }
    [JsonPropertyName("level")] public int Level { get; set; }
    [JsonPropertyName("roomIdx")] public int RoomIdx { get; set; }
    [JsonPropertyName("hp")] public float Hp { get; set; }
    [JsonPropertyName("radius")] public float Radius { get; set; }
    [JsonPropertyName("visualScale")] public float VisualScale { get; set; }
}

public sealed class AltarDto
{
    [JsonPropertyName("roomIdx")] public int RoomIdx { get; set; }
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("activated")] public bool Activated { get; set; }
}

public sealed class RoomBonusAltarDto
{
    [JsonPropertyName("roomIdx")] public int RoomIdx { get; set; }
    [JsonPropertyName("position")] public float[] Position { get; set; } = new float[2];
    [JsonPropertyName("cell")] public int[] Cell { get; set; } = new int[2];
    [JsonPropertyName("activated")] public bool Activated { get; set; }
    [JsonPropertyName("bonusType")] public string? BonusType { get; set; }
}

public sealed class RoomBonusAssignmentDto
{
    [JsonPropertyName("roomIdx")] public int RoomIdx { get; set; }
    [JsonPropertyName("bonusType")] public string BonusType { get; set; } = "";
}
