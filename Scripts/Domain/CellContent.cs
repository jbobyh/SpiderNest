using System.Collections.Generic;

namespace SpaceOrLife.Domain;

public sealed class CellContent
{
    public RoomContentKind Type = RoomContentKind.Empty;
    public Dictionary<EnemyKind, int> EnemyPreset = new();
    public int EnemyCount;
    public bool EnemiesReleased;
    public int RoomIdx;
    public string? WeaponId;
}
