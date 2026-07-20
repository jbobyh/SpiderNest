using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Domain;

public sealed class PendingSpawn
{
	public EnemyKind Kind;
	public Vector2 Pos;
	public float Delay;
	public int RoomIdx = -1;
}

public sealed class BattleState
{
	public HashSet<CellCoord> BattleCells = new();
	public CellCoord? OpenedCellKey;
	public CellCoord? RoomCellKey;
	public bool IsBossBattle;
	public List<PendingSpawn> PendingSpawns = new();
	public float FreezeTimer;
	public float Zoom;
	public float CenterX;
	public float CenterY;
}
