using Godot;

namespace SpaceOrLife.Domain;

public enum BossPhaseId
{
    Pause,
    Soldier,
    Buldyga,
    BullLimited,
    Shooter
}

public enum BossHpSource
{
    Soldier,
    Buldyga,
    Fixed
}

[GlobalClass]
public partial class BossPhase : Resource
{
    [Export] public BossPhaseId Id = BossPhaseId.Pause;
    [Export] public float Duration = 5f;

    [ExportGroup("Buldyga")]
    [Export] public float AccelMult = 1f;
    [Export] public float FrictionMult = 1f;

    [ExportGroup("Shooter")]
    [Export] public float ShootCdMult = 1f;
    [Export] public float BulletSpeedMult = 1f;

    [ExportGroup("BullLimited")]
    [Export] public int MaxDashes = 3;
    [Export] public float DashCells = 5f;
    [Export] public float DashSpeedMult = 1.5f;
}

[GlobalClass]
public partial class BossDefinition : Resource
{
    [Export] public int Level = 1;
    [Export] public string Id = "";
    [Export] public string Name = "";
    [Export] public BossHpSource HpSource = BossHpSource.Soldier;
    [Export] public float HpMult = 30f;
    [Export] public int HpFixed = 0;
    [Export] public float RadiusMult = 2.25f;
    [Export] public float SpeedMult = 1.1f;
    [Export] public float VisualScale = 4.0f;
    [Export] public Godot.Collections.Array<BossPhase> Phases = new();
}
