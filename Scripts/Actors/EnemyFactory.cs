using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public static class EnemyFactory
{
    public static EnemyActor Create(
        EnemyKind kind,
        Vector2 pos,
        EnemyCatalog catalog,
        int level,
        int roomIdx,
        bool isBoss = false)
    {
        var def = catalog.GetByKind(kind);
        var hp = (def?.Hp ?? 120f) * GetHpMult(level);
        var radius = def?.Radius ?? 7f;
        var visualScale = def?.VisualScale ?? 2.9f;

        var behavior = CreateBehavior(kind);
        if (def != null)
            behavior.SetDefinition(def);

        var actor = new EnemyActor();
        actor.Setup(kind, hp, radius, visualScale, level, roomIdx, isBoss, behavior);
        actor.GlobalPosition = pos;
        return actor;
    }

    public static EnemyActor CreateBoss(
        BossDefinition bossDef,
        Vector2 pos,
        EnemyCatalog catalog,
        int level)
    {
        var bossBehavior = new BossBehavior();
        var soldierDef = catalog.GetByKind(EnemyKind.Soldier);
        var soldierRadius = soldierDef?.Radius ?? 7f;

        var hp = BattleSystem.CalculateBossHp(bossDef, catalog);
        var radius = soldierRadius * (bossDef.RadiusMult > 0f ? bossDef.RadiusMult : 2.25f);
        var visualScale = bossDef.VisualScale > 0f ? bossDef.VisualScale : 4.0f;

        var actor = new EnemyActor();
        actor.Setup(EnemyKind.BossPhase, hp, radius, visualScale, level, -1, true, bossBehavior);
        actor.SetBossDefinition(bossDef);
        actor.GlobalPosition = pos;
        return actor;
    }

    public static EnemyActor CreateFromStasis(
        StasisEnemyData data,
        EnemyCatalog catalog)
    {
        var actor = Create(data.Type, new Vector2(data.X, data.Y), catalog, data.Level, data.RoomIdx);
        actor.Stasis = true;
        return actor;
    }

    private static EnemyBehavior CreateBehavior(EnemyKind kind)
    {
        return kind switch
        {
            EnemyKind.Soldier => new ChaserBehavior(),
            EnemyKind.Tank => new ChaserBehavior(),
            EnemyKind.Bat => new ZigzagChaserBehavior(),
            EnemyKind.Shooter => new ShooterBehavior(),
            EnemyKind.Wallshooter => new WallShooterBehavior(),
            EnemyKind.Bull => new BullBehavior(),
            EnemyKind.Buldyga => new BuldygaBehavior(),
            EnemyKind.Bloated => new BloatedBehavior(),
            EnemyKind.Cocoon => new CocoonBehavior(),
            EnemyKind.Ghost => new GhostBehavior(),
            _ => new ChaserBehavior(),
        };
    }

    private static float GetHpMult(int level) => level switch
    {
        1 => 1f,
        2 => 2f,
        3 => 4f,
        _ => 1f,
    };
}
