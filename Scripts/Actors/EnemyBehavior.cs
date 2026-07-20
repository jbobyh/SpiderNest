using System;
using Godot;
using SpaceOrLife.Combat;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public readonly struct EnemyUpdateContext
{
    public readonly Vector2 PlayerPos;
    public readonly LevelState Level;
    public readonly FlowField? FlowField;
    public readonly BulletSimulation BulletSim;
    public readonly EnemyCatalog EnemyCatalog;
    public readonly float Time;
    public readonly Random Rng;
    public readonly Action<EnemyKind, Vector2>? OnSpawnRequested;

    public EnemyUpdateContext(
        Vector2 playerPos, LevelState level, FlowField? flowField,
        BulletSimulation bulletSim, EnemyCatalog enemyCatalog,
        float time, Random rng,
        Action<EnemyKind, Vector2>? onSpawnRequested)
    {
        PlayerPos = playerPos;
        Level = level;
        FlowField = flowField;
        BulletSim = bulletSim;
        EnemyCatalog = enemyCatalog;
        Time = time;
        Rng = rng;
        OnSpawnRequested = onSpawnRequested;
    }
}

public abstract class EnemyBehavior
{
    protected EnemyUpdateContext Ctx;
    protected EnemyDefinition Def = null!;

    public void SetDefinition(EnemyDefinition def) => Def = def;
    public void SetContext(EnemyUpdateContext ctx) => Ctx = ctx;

    protected float ScaledSpeed => Def.Speed * GameConstants.EnemySpeedScale;

    public abstract void UpdateBehavior(float dt, EnemyActor actor);

    public virtual void OnWallHit() { }

    protected float GetRoomSpeedMult(EnemyActor actor)
    {
        var mult = 1f;
        if (StatusSystem.HasStatus(actor, StatusKind.Freeze))
            mult *= 0.5f;
        return mult;
    }

    protected float GetRoomSpeedVectorMult(EnemyActor actor, float dirX, float dirY)
    {
        var mult = 1f;
        if (StatusSystem.HasStatus(actor, StatusKind.Freeze))
            mult *= 0.5f;
        return mult;
    }

    protected Vector2 GetMoveDir(EnemyActor actor)
    {
        return FlowField.GetEnemyMoveDir(
            actor.GlobalPosition, Ctx.PlayerPos,
            Ctx.FlowField, Ctx.Level.OpenCells, Ctx.Level.RemovedWalls);
    }

    protected bool HasLineOfSight(EnemyActor actor)
    {
        return FlowField.HasLineOfSight(
            Ctx.Level.OpenCells, Ctx.Level.RemovedWalls,
            actor.GlobalPosition, Ctx.PlayerPos);
    }

    protected static float EnemyBulletRange(float vx, float vy)
    {
        return Mathf.Sqrt(vx * vx + vy * vy) * GameConstants.EnemyBulletTime;
    }

    protected void SpawnEnemyBullet(EnemyActor actor, float vx, float vy)
    {
        Ctx.BulletSim.Spawn(new BulletSpawnData
        {
            Position = actor.GlobalPosition,
            Velocity = new Vector2(vx, vy),
            Owner = BulletOwner.Enemy,
            Damage = 10f,
            MaxRange = EnemyBulletRange(vx, vy),
            Color = new Color(1f, 0.27f, 0f),
        });
    }
}

public sealed class ChaserBehavior : EnemyBehavior
{
    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        if (actor.StunTimer > 0f)
        {
            actor.Velocity = Vector2.Zero;
            return;
        }

        var dist = actor.GlobalPosition.DistanceTo(Ctx.PlayerPos);
        if (dist <= 0f)
        {
            actor.Velocity = Vector2.Zero;
            return;
        }

        var dir = GetMoveDir(actor);
        var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
        var speed = ScaledSpeed;
        actor.Velocity = dir * speed * speedMult;
    }
}

public sealed class ZigzagChaserBehavior : EnemyBehavior
{
    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var speedMult = GetRoomSpeedMult(actor);
        actor.AdvanceBatAnim(dt * speedMult);

        if (actor.StunTimer > 0f)
        {
            actor.Velocity = Vector2.Zero;
            return;
        }

        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        if (dist <= 0f)
        {
            actor.Velocity = Vector2.Zero;
            return;
        }

        var baseSpeed = ScaledSpeed;
        var hasLos = HasLineOfSight(actor);

        Vector2 moveDir;
        if (hasLos)
        {
            var dirX = dx / dist;
            var dirY = dy / dist;
            var perpX = -dirY;
            var perpY = dirX;
            var freq = Def.ZigzagFreq;
            var amp = Def.ZigzagAmp;
            var offset = Mathf.Sin(Ctx.Time * freq) * amp;

            moveDir = new Vector2(dirX + perpX * offset, dirY + perpY * offset);
            var moveLen = moveDir.Length();
            if (moveLen > 0f)
                moveDir /= moveLen;
        }
        else
        {
            moveDir = GetMoveDir(actor);
        }

        var moveSpeedMult = GetRoomSpeedVectorMult(actor, moveDir.X, moveDir.Y);
        actor.Velocity = moveDir * baseSpeed * moveSpeedMult;
    }
}

public sealed class ShooterBehavior : EnemyBehavior
{
    private float _shootCd;

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        var speedMult = GetRoomSpeedMult(actor);
        var hasLos = HasLineOfSight(actor);
        var isStunned = actor.StunTimer > 0f;

        if (actor.AnimState == null)
            actor.AnimState = "idle";

        if (_shootCd > 0f)
            _shootCd -= dt;

        var shootRange = Def.ShootRangeCells * GameConstants.CellPx;
        var stopDist = Def.StopDistCells * GameConstants.CellPx;

        if (hasLos && dist <= shootRange && _shootCd <= 0f && dist > 0f)
        {
            _shootCd = Def.ShootCd;
            actor.AnimState = "shoot";
            actor.AnimFrame = 0;
            var ebx = (dx / dist) * Def.BulletSpeed;
            var eby = (dy / dist) * Def.BulletSpeed;
            SpawnEnemyBullet(actor, ebx, eby);
        }

        if (isStunned)
        {
            actor.Velocity = Vector2.Zero;
        }
        else if (!hasLos || dist > stopDist)
        {
            if (dist > 0f)
            {
                var dir = GetMoveDir(actor);
                actor.Velocity = dir * ScaledSpeed * speedMult;
                if (actor.AnimState != "shoot")
                    actor.AnimState = "run";
            }
        }
        else
        {
            actor.Velocity = Vector2.Zero;
            if (actor.AnimState != "shoot")
                actor.AnimState = "idle";
        }

        actor.AdvanceShooterAnim(dt * speedMult);
    }
}

public sealed class WallShooterBehavior : EnemyBehavior
{
    private float _shootCd;

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        var hasLos = HasLineOfSight(actor);
        var isStunned = actor.StunTimer > 0f;

        if (_shootCd > 0f)
            _shootCd -= dt;

        var shootRange = Def.ShootRangeCells * GameConstants.CellPx;
        var stopDist = Def.StopDistCells * GameConstants.CellPx;

        if (hasLos && dist <= shootRange && _shootCd <= 0f && dist > 0f)
        {
            _shootCd = Def.ShootCd;

            var dirX = dx / dist;
            var dirY = dy / dist;
            var perpX = -dirY;
            var perpY = dirX;
            var count = Def.WallBulletCount;
            var spacing = Def.WallBulletSpacing;
            var offset = (count - 1) / 2f;

            for (int i = 0; i < count; i++)
            {
                var ox = perpX * spacing * (i - offset);
                var oy = perpY * spacing * (i - offset);
                var vx = dirX * Def.BulletSpeed;
                var vy = dirY * Def.BulletSpeed;
                Ctx.BulletSim.Spawn(new BulletSpawnData
                {
                    Position = actor.GlobalPosition + new Vector2(ox, oy),
                    Velocity = new Vector2(vx, vy),
                    Owner = BulletOwner.Enemy,
                    Damage = 10f,
                    MaxRange = EnemyBulletRange(vx, vy),
                    Color = new Color(1f, 0.27f, 0f),
                });
            }
        }

        if (isStunned)
        {
            actor.Velocity = Vector2.Zero;
        }
        else if (!hasLos || dist > stopDist)
        {
            if (dist > 0f)
            {
                var dir = GetMoveDir(actor);
                var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
                actor.Velocity = dir * ScaledSpeed * speedMult;
            }
        }
        else
        {
            actor.Velocity = Vector2.Zero;
        }
    }
}

public sealed class BullBehavior : EnemyBehavior
{
    private enum BullState { Chase, Prepare, Dash, Rest }

    private BullState _state = BullState.Chase;
    private float _stateTimer;
    private Vector2 _dashDir;
    private float _dashDistance;

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        var chargeDist = Def.ChargeDistCells * GameConstants.CellPx;
        var dashDistMax = Def.DashDistCells * GameConstants.CellPx;
        var hitDist = actor.Radius + GameConstants.PlayerRadius;
        var isStunned = actor.StunTimer > 0f;

        switch (_state)
        {
            case BullState.Chase:
                if (isStunned)
                {
                    actor.Velocity = Vector2.Zero;
                }
                else if (dist > chargeDist && dist > 0f)
                {
                    var dir = GetMoveDir(actor);
                    var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
                    actor.Velocity = dir * ScaledSpeed * speedMult;
                }
                else if (dist <= chargeDist)
                {
                    _state = BullState.Prepare;
                    _stateTimer = Def.PrepareTime;
                    actor.Velocity = Vector2.Zero;
                }
                break;

            case BullState.Prepare:
                _stateTimer -= dt;
                if (_stateTimer <= 0f)
                {
                    _state = BullState.Dash;
                    if (dist > 0f)
                    {
                        _dashDir = new Vector2(dx / dist, dy / dist);
                    }
                    else
                    {
                        _dashDir = new Vector2(dx / Mathf.Max(dist, 1f), dy / Mathf.Max(dist, 1f));
                    }
                    _dashDistance = dashDistMax;
                    _stateTimer = 0f;
                }
                break;

            case BullState.Dash:
            {
                var dashSpeed = ScaledSpeed * 4f;
                var speedMult = GetRoomSpeedVectorMult(actor, _dashDir.X, _dashDir.Y);

                var speedBefore = actor.Velocity.Length();
                actor.Velocity = _dashDir * dashSpeed * speedMult;
                _stateTimer += dashSpeed * speedMult * dt;

                if (_stateTimer >= _dashDistance || dist < hitDist)
                {
                    _state = BullState.Rest;
                    _stateTimer = Def.RestTime;
                    actor.Velocity = Vector2.Zero;
                }
                break;
            }

            case BullState.Rest:
                _stateTimer -= dt;
                actor.Velocity = Vector2.Zero;
                if (_stateTimer <= 0f)
                    _state = BullState.Chase;
                break;
        }
    }

    public override void OnWallHit()
    {
        if (_state == BullState.Dash)
        {
            _state = BullState.Rest;
            _stateTimer = Def.RestTime;
        }
    }
}

public sealed class BuldygaBehavior : EnemyBehavior
{
    private float _currentSpeed;
    private float _speedAccumulator;
    private Vector2 _velocity;

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        _currentSpeed = ScaledSpeed;

        if (actor.StunTimer > 0f)
        {
            _velocity = Vector2.Zero;
            actor.Velocity = Vector2.Zero;
            return;
        }

        _speedAccumulator += dt;
        if (_speedAccumulator >= 1.0f)
        {
            var secs = Mathf.Floor(_speedAccumulator);
            _currentSpeed += Def.SpeedIncrement * GameConstants.EnemySpeedScale * secs;
            _speedAccumulator -= secs;
        }

        var speedMult = GetRoomSpeedVectorMult(actor, dx, dy);
        var effectiveSpeed = _currentSpeed * speedMult;

        if (dist > 0f)
        {
            var tvx = (dx / dist) * effectiveSpeed;
            var tvy = (dy / dist) * effectiveSpeed;
            var acc = (Def.Accel * GameConstants.EnemySpeedScale * 0.1f) * dt;
            var dvx = tvx - _velocity.X;
            var dvy = tvy - _velocity.Y;
            var dLen = Mathf.Sqrt(dvx * dvx + dvy * dvy);

            if (dLen > 0f)
            {
                var step = Mathf.Min(dLen, acc);
                _velocity = new Vector2(
                    _velocity.X + (dvx / dLen) * step,
                    _velocity.Y + (dvy / dLen) * step);
            }
        }
        else
        {
            var friction = 1f - Def.Friction * dt;
            _velocity *= Mathf.Max(0f, friction);
        }

        actor.Velocity = _velocity;
    }

    public override void OnWallHit()
    {
        _velocity = Vector2.Zero;
    }
}

public sealed class BloatedBehavior : EnemyBehavior
{
    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        if (actor.StunTimer <= 0f && dist > 0f)
        {
            var dir = GetMoveDir(actor);
            var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
            actor.Velocity = dir * ScaledSpeed * speedMult;
        }
        else
        {
            actor.Velocity = Vector2.Zero;
        }
    }
}

public sealed class CocoonBehavior : EnemyBehavior
{
    private float _spawnTimer;

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var cell = CellCoord.FromWorld(actor.GlobalPosition.X, actor.GlobalPosition.Y, GameConstants.CellPx);
        if (!Ctx.Level.OpenCells.Contains(cell))
        {
            actor.Die();
            return;
        }

        actor.AnimTime += dt * GetRoomSpeedMult(actor);

        _spawnTimer -= dt;
        if (_spawnTimer <= 0f)
        {
            _spawnTimer = Def.SpawnInterval;
            var a = (float)(Ctx.Rng.NextDouble() * Math.PI * 2);
            var soldierDef = Ctx.EnemyCatalog.GetByKind(EnemyKind.Soldier);
            var soldierRadius = soldierDef?.Radius ?? 7f;
            var d = actor.Radius + soldierRadius + 5f;
            var spawnX = actor.GlobalPosition.X + Mathf.Cos(a) * d;
            var spawnY = actor.GlobalPosition.Y + Mathf.Sin(a) * d;

            Ctx.OnSpawnRequested?.Invoke(EnemyKind.Soldier, new Vector2(spawnX, spawnY));
        }

        actor.Velocity = Vector2.Zero;
    }
}

public sealed class GhostBehavior : EnemyBehavior
{
    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        var speedMult = GetRoomSpeedMult(actor);

        if (actor.AnimState == null)
            actor.AnimState = "move";

        if (actor.StunTimer > 0f)
        {
            actor.Velocity = Vector2.Zero;
            actor.AnimState = "idle";
            actor.AdvanceGhostAnim(dt * speedMult);
            return;
        }

        actor.AnimState = "move";
        actor.AdvanceGhostAnim(dt * speedMult);

        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        if (dist > 0f)
        {
            var speed = ScaledSpeed;
            var moveSpeedMult = GetRoomSpeedVectorMult(actor, dx, dy);
            actor.Velocity = new Vector2(
                (dx / dist) * speed * moveSpeedMult,
                (dy / dist) * speed * moveSpeedMult);
        }
        else
        {
            actor.Velocity = Vector2.Zero;
        }
    }
}
