using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Domain;

public sealed class StasisEnemyData
{
    public EnemyKind Type;
    public float X, Y;
    public int Level;
    public int RoomIdx;
    public float Hp;
    public float Radius;
    public float VisualScale;
}

public sealed class HeartData
{
    public Vector2 Position;
    public CellCoord Cell;
    public bool Collected;
    public bool Spawned;
}

public sealed class ChestData
{
    public Vector2 Position;
    public CellCoord Cell;
    public bool Collected;
    public bool Spawned = true;
}

public sealed class DroppedWeaponData
{
    public Vector2 Position;
    public CellCoord Cell;
    public string WeaponId = "";
}

public class AltarData
{
    public int RoomIdx;
    public Vector2 Position;
    public CellCoord Cell;
    public bool Activated;
}

public sealed class RoomBonusAltarData : AltarData
{
    public string? BonusType;
}

public sealed class SummonSphereData
{
    public Vector2 Position;
    public CellCoord Cell;
    public bool Collected;
    public bool Spawned;
}

public sealed class RoomBonusAssignment
{
    public int RoomIdx;
    public string BonusType = "";
}

public sealed class LevelState
{
    public int Level;
    public ulong Seed;
    public int GridSize;

    public List<RoomData> Rooms = new();
    public HashSet<CellCoord> BlobCells = new();
    public HashSet<CellCoord> OpenCells = new();
    public HashSet<WallId> RemovedWalls = new();
    public HashSet<WallId> InternalWalls = new();
    public HashSet<WallId> FixedWalls = new();
    public HashSet<CellCoord> PermanentlyClosed = new();
    public HashSet<CellCoord> DisabledCells = new();

    public Dictionary<CellCoord, CellContent> CellContents = new();
    public Dictionary<CellCoord, int> CellToRoom = new();
    public Dictionary<CellCoord, Color> RoomColors = new();

    public CellCoord StartCell;
    public CellCoord? ExitCell;

    public HashSet<CellCoord> EverRevealedCells = new();
    public HashSet<CellCoord> EverOpenedCells = new();
    public HashSet<int> Purified = new();

    public List<HeartData> Hearts = new();
    public int HeartsCollected;
    public SummonSphereData? SummonSphere;
    public bool SummonSphereCollected;
    public List<ChestData> UpgradeChests = new();
    public List<ChestData> SpatialChests = new();
    public List<DroppedWeaponData> DroppedWeapons = new();
    public bool RevealedExit;

    public List<StasisEnemyData> TrappedSpiders = new();
    public List<AltarData> RoomAltars = new();
    public List<RoomBonusAltarData> RoomBonusAltars = new();
    public List<RoomBonusAssignment> RoomBonuses = new();

    public int PlayerRemovedWalls;

    public BattleState? Battle;
    public bool BossDefeated;
    public bool BossSummonReady;
    public int Souls;

    public PendingChoice? PendingChoice;
}
