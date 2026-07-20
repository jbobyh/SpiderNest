using Godot;

namespace SpaceOrLife.Domain;

[GlobalClass]
public partial class EnemyDefinition : Resource
{
    [Export] public EnemyKind Kind = EnemyKind.Soldier;
    [Export] public string Id = "";

    [ExportGroup("Base Stats")]
    [Export] public float Hp = 120f;
    [Export] public float Speed = 1f;
    [Export] public float Radius = 7f;
    [Export] public float VisualScale = 2.9f;
    [Export] public int Cost = 30;

    [ExportGroup("Chaser / Wobble")]
    [Export] public float WobbleMin = 0f;
    [Export] public float WobbleMax = 0f;
    [Export] public float SpawnMargin = 10f;

    [ExportGroup("Bat")]
    [Export] public float AnimFps = 15f;
    [Export] public float ZigzagFreq = 0f;
    [Export] public float ZigzagAmp = 0f;

    [ExportGroup("Shooter")]
    [Export] public float BulletSpeed = 100f;
    [Export] public float ShootRangeCells = 2f;
    [Export] public float ShootCd = 1.5f;
    [Export] public float StopDistCells = 2f;

    [ExportGroup("Bull")]
    [Export] public float PrepareTime = 1f;
    [Export] public float RestTime = 1.5f;
    [Export] public float ChargeDistCells = 0.75f;
    [Export] public float DashDistCells = 0.02f;

    [ExportGroup("Buldyga")]
    [Export] public float Accel = 40f;
    [Export] public float Friction = 3.5f;
    [Export] public float SpeedIncrement = 0.1f;

    [ExportGroup("Cocoon")]
    [Export] public float SpawnInterval = 3.0f;

    [ExportGroup("Bloated")]
    [Export] public float DeathShotSpeed = 120f;

    [ExportGroup("WallShooter")]
    [Export] public int WallBulletCount = 5;
    [Export] public float WallBulletSpacing = 8f;
}
