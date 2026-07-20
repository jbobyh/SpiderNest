using Godot;

namespace SpaceOrLife.Domain;

[GlobalClass]
public partial class LevelDefinition : Resource
{
    [Export] public int Level = 1;
    [Export] public GenerationType GenType = GenerationType.Grid;
    [Export] public int RoomCount = 25;

    [ExportGroup("Room Quotas")]
    [Export] public int Size4 = 1;
    [Export] public int Size3 = 2;
    [Export] public int Size2 = 3;

    [ExportGroup("Content")]
    [Export] public int Weapons = 1;
    [Export] public int Upgrades = 4;
    [Export] public int Cursed = 1;
    [Export] public int Bonuses = 3;
    [Export] public int Hearts = 1;
    [Export(PropertyHint.Range, "0,1,0.05")] public float EnemyRoomPercent = 0.4f;

    [ExportGroup("Enemy Spawn Table")]
    [Export] public Godot.Collections.Array<EnemyKind> SpawnKinds = new();
    [Export] public Godot.Collections.Array<int> SpawnWeights = new();

    public int GetWeight(EnemyKind kind)
    {
        for (int i = 0; i < SpawnKinds.Count; i++)
        {
            if (SpawnKinds[i] == kind)
                return i < SpawnWeights.Count ? SpawnWeights[i] : 0;
        }
        return 0;
    }
}
