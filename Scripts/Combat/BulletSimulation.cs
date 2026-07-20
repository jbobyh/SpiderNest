using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Combat;

public sealed class BulletSimulation
{
    private readonly BulletPool _pool = new();
    private readonly List<Bullet> _bullets = new();

    public IReadOnlyList<Bullet> Bullets => _bullets;

    public void Spawn(BulletSpawnData data)
    {
        var b = _pool.Acquire(data);
        _bullets.Add(b);
    }

    public void Clear()
    {
        _pool.ReleaseAll(_bullets);
        _bullets.Clear();
    }

    public void Update(
        float dt,
        LevelState level,
        RoomBonusCatalog bonusCatalog,
        IReadOnlyList<IDamageable> targets,
        Vector2 playerPos,
        bool playerDashing,
        Action<IDamageable>? onEnemyKilled = null,
        Action<IDamageable>? onStasisHit = null,
        Action<Vector2, float, bool, float>? onEnemyHit = null,
        Action<Vector2, float>? onWallHit = null,
        Action<Vector2>? onRangeExpired = null)
    {
        var cellPx = GameConstants.CellPx;
        var removedWalls = level.RemovedWalls;
        var openCells = level.OpenCells;

        for (int i = _bullets.Count - 1; i >= 0; i--)
        {
            var b = _bullets[i];
            var prevPos = b.Position;

            b.Position += b.Velocity * dt;

            var delta = b.Position - prevPos;

            ApplyRoomBonuses(b, level, bonusCatalog, cellPx);

            b.DistanceTraveled += delta.Length() * b.RangeDecayMult;

            b.TrailTimer -= dt;

            if (b.DistanceTraveled >= b.MaxRange)
            {
                onRangeExpired?.Invoke(b.Position);
                RemoveBullet(i);
                continue;
            }

            var hitsWall = !WallTraversal.InRoom(b.Position, openCells, cellPx) ||
                           WallTraversal.CrossesWall(removedWalls, prevPos, b.Position, cellPx);

            if (hitsWall)
            {
                var prevCell = CellCoord.FromWorld(prevPos.X, prevPos.Y, cellPx);
                var prevBonus = RoomBonusHelper.GetRoomBonus(level, prevCell);
                var wasInRoom = WallTraversal.InRoom(prevPos, openCells, cellPx);
                var canRicochet = !b.Ricocheted && wasInRoom &&
                                  (b.BaseRicochet || prevBonus == "ricochet");

                var normalAngle = ComputeWallNormal(prevPos, b.Position, cellPx);

                if (canRicochet)
                {
                    HandleRicochet(b, prevPos, cellPx);
                    onWallHit?.Invoke(b.Position, normalAngle);
                }
                else
                {
                    onWallHit?.Invoke(b.Position, normalAngle);
                    RemoveBullet(i);
                    continue;
                }
            }
            else
            {
                b.Ricocheted = false;
            }

            if (b.Owner == BulletOwner.Player)
            {
                if (CheckEnemyCollisions(b, targets, onEnemyKilled, onStasisHit, onEnemyHit))
                {
                    RemoveBullet(i);
                    continue;
                }
            }
            else
            {
                if (CheckPlayerCollision(b, playerPos, playerDashing))
                {
                    RemoveBullet(i);
                    continue;
                }
            }
        }
    }

    private void RemoveBullet(int index)
    {
        var b = _bullets[index];
        _bullets.RemoveAt(index);
        _pool.Release(b);
    }

    private static void ApplyRoomBonuses(Bullet b, LevelState level, RoomBonusCatalog catalog, float cellPx)
    {
        var cell = CellCoord.FromWorld(b.Position.X, b.Position.Y, cellPx);
        var roomBonus = RoomBonusHelper.GetRoomBonus(level, cell);

        if (roomBonus == b.LastRoomBonus)
            return;

        if (roomBonus == "speeddown" || RoomBonusHelper.IsWindBonus(roomBonus))
        {
            var mult = RoomBonusHelper.GetRoomSpeedVectorMult(level, catalog, cell, b.BaseVelocity);
            b.Velocity = b.BaseVelocity * mult;
            b.LastSpeedMult = mult;
        }
        else if (b.LastRoomBonus == "speeddown" || RoomBonusHelper.IsWindBonus(b.LastRoomBonus))
        {
            b.Velocity = b.BaseVelocity;
            b.LastSpeedMult = 1f;
        }

        if (roomBonus == "ricochet")
        {
            b.Ricochet = true;
        }
        else if (b.LastRoomBonus == "ricochet")
        {
            b.Ricochet = b.BaseRicochet;
        }

        if (b.Owner == BulletOwner.Player)
        {
            if (roomBonus == "penetrate")
            {
                b.Penetrate = int.MaxValue;
            }
            else if (b.LastRoomBonus == "penetrate")
            {
                b.Penetrate = b.BasePenetrate;
            }
        }

        if (roomBonus == "longRange")
        {
            b.RangeDecayMult = 0.1f;
        }
        else if (b.LastRoomBonus == "longRange")
        {
            b.RangeDecayMult = 1f;
        }

        b.LastRoomBonus = roomBonus;
    }

    private static void HandleRicochet(Bullet b, Vector2 prevPos, float cellPx)
    {
        b.Ricocheted = true;

        var c0 = CellCoord.FromWorld(prevPos.X, prevPos.Y, cellPx);
        var c1 = CellCoord.FromWorld(b.Position.X, b.Position.Y, cellPx);

        if (c0.X != c1.X && c0.Y != c1.Y)
        {
            b.Velocity = new Vector2(-b.Velocity.X, -b.Velocity.Y);
            b.Position = prevPos;
        }
        else if (c0.X != c1.X)
        {
            b.Velocity = new Vector2(-b.Velocity.X, b.Velocity.Y);
            b.Position = new Vector2(prevPos.X, b.Position.Y);
        }
        else
        {
            b.Velocity = new Vector2(b.Velocity.X, -b.Velocity.Y);
            b.Position = new Vector2(b.Position.X, prevPos.Y);
        }

        b.SyncBaseVelocity();
        b.HitEntities.Clear();
    }

    private static bool CheckEnemyCollisions(Bullet b, IReadOnlyList<IDamageable> targets, Action<IDamageable>? onEnemyKilled, Action<IDamageable>? onStasisHit, Action<Vector2, float, bool, float>? onEnemyHit)
    {
        for (int j = targets.Count - 1; j >= 0; j--)
        {
            var g = targets[j];
            if (b.HitEntities.Contains(g) || g.IsDead)
                continue;

            var dist = b.Position.DistanceTo(g.Position);
            if (dist >= g.Radius + GameConstants.BulletRadius)
                continue;

            var isCritHit = b.IsCrit || (!b.IsCrit && b.AimCritTarget == g);
            var damage = b.Damage;

            if (!b.IsCrit && isCritHit)
                damage *= b.AimCritMult;

            g.TakeDamage(damage, isCritHit);

            if (!g.IsBoss && b.HitStun > 0f)
                g.ApplyStun(b.HitStun);

            if (g is IStatusTarget statusTarget)
            {
                if (b.IsIncendiary)
                    StatusSystem.ApplyStatus(statusTarget, StatusKind.Burn, StatusSystem.GetBurnDuration(), b.Damage / 10f);
                if (b.IsFreeze)
                    StatusSystem.ApplyStatus(statusTarget, StatusKind.Freeze, StatusSystem.GetFreezeDuration());
            }

            onEnemyHit?.Invoke(g.Position, Mathf.Atan2(b.Velocity.Y, b.Velocity.X), isCritHit, damage);

            b.HitCount++;
            b.HitEntities.Add(g);

            if (g.Stasis)
                onStasisHit?.Invoke(g);

            if (g.IsDead)
                onEnemyKilled?.Invoke(g);

            if (b.HitCount > b.Penetrate)
                return true;
        }

        return false;
    }

    private static bool CheckPlayerCollision(Bullet b, Vector2 playerPos, bool playerDashing)
    {
        var dist = b.Position.DistanceTo(playerPos);
        if (dist < GameConstants.PlayerRadius + GameConstants.BulletRadius)
        {
            if (!playerDashing)
                return true;
        }

        return false;
    }

    private static float ComputeWallNormal(Vector2 prevPos, Vector2 curPos, float cellPx)
    {
        var c0 = CellCoord.FromWorld(prevPos.X, prevPos.Y, cellPx);
        var c1 = CellCoord.FromWorld(curPos.X, curPos.Y, cellPx);

        if (c0.X != c1.X && c0.Y == c1.Y)
        {
            return c1.X > c0.X ? Mathf.Pi : 0f;
        }
        if (c0.Y != c1.Y && c0.X == c1.X)
        {
            return c1.Y > c0.Y ? -Mathf.Pi / 2f : Mathf.Pi / 2f;
        }

        return Mathf.Atan2(prevPos.Y - curPos.Y, prevPos.X - curPos.X);
    }

}
