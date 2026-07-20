using System;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Actors;

public sealed class BossBehavior : EnemyBehavior
{
    private BossDefinition _bossDef = null!;
    private BossPhase _currentPhase = null!;
    private int _phaseIndex;
    private float _phaseTimer;
    private int _dashCount;
    private float _strafeDir = 1f;
    private float _strafeSwitchTimer = GameConstants.BossStrafeSwitchTime;
    private float _currentSpeed;
    private float _speedAccumulator;
    private Vector2 _velocity;
    private float _shootCd;

    private enum BullState { Chase, Prepare, Dash, Rest }
    private BullState _bullState = BullState.Chase;
    private float _bullStateTimer;
    private Vector2 _dashDir;
    private float _dashDistance;

    public void SetBossDefinition(BossDefinition def)
    {
        _bossDef = def;
        _phaseIndex = 0;
        if (def.Phases.Count > 0)
        {
            _currentPhase = def.Phases[0];
            _phaseTimer = _currentPhase.Duration;
        }
    }

    public override void UpdateBehavior(float dt, EnemyActor actor)
    {
        if (_bossDef == null || _bossDef.Phases.Count == 0) return;

        AdvancePhaseTimer(dt);

        var phase = _bossDef.Phases[_phaseIndex];
        var bossSpd = GetBossSpeed();
        var dx = Ctx.PlayerPos.X - actor.GlobalPosition.X;
        var dy = Ctx.PlayerPos.Y - actor.GlobalPosition.Y;
        var dist = Mathf.Sqrt(dx * dx + dy * dy);

        switch (phase.Id)
        {
            case BossPhaseId.Pause:
                actor.Velocity = Vector2.Zero;
                break;

            case BossPhaseId.Soldier:
                UpdateSoldierPhase(actor, dx, dy, dist, bossSpd);
                break;

            case BossPhaseId.Buldyga:
                UpdateBuldygaPhase(dt, actor, phase, dx, dy, dist);
                break;

            case BossPhaseId.BullLimited:
                UpdateBullLimitedPhase(dt, actor, phase, dx, dy, dist);
                break;

            case BossPhaseId.Shooter:
                UpdateShooterPhase(dt, actor, phase, dx, dy, dist, bossSpd);
                break;
        }
    }

    public override void OnWallHit()
    {
        var phase = _bossDef?.Phases[_phaseIndex];
        if (phase == null) return;

        if (phase.Id == BossPhaseId.Buldyga)
        {
            _velocity = Vector2.Zero;
        }
        else if (phase.Id == BossPhaseId.BullLimited && _bullState == BullState.Dash)
        {
            OnDashFinished(phase);
        }
    }

    private void AdvancePhaseTimer(float dt)
    {
        var phase = _bossDef.Phases[_phaseIndex];
        if (phase.Id == BossPhaseId.BullLimited)
            return;

        if (phase.Duration <= 0f)
            return;

        _phaseTimer -= dt;
        if (_phaseTimer <= 0f)
            AdvancePhase();
    }

    private void AdvancePhase()
    {
        _phaseIndex = (_phaseIndex + 1) % _bossDef.Phases.Count;
        var next = _bossDef.Phases[_phaseIndex];
        _phaseTimer = next.Duration;
        _dashCount = 0;
        _bullState = BullState.Chase;
        _bullStateTimer = 0f;
        _strafeSwitchTimer = GameConstants.BossStrafeSwitchTime;
        _velocity = Vector2.Zero;
        _currentSpeed = 0f;
        _speedAccumulator = 0f;
    }

    private float GetBossSpeed()
    {
        var soldierDef = Ctx.EnemyCatalog.GetByKind(EnemyKind.Soldier);
        var baseSpeed = (soldierDef?.Speed ?? 1f) * GameConstants.EnemySpeedScale;
        return baseSpeed * (_bossDef.SpeedMult > 0f ? _bossDef.SpeedMult : 1f);
    }

    private void UpdateSoldierPhase(EnemyActor actor, float dx, float dy, float dist, float bossSpd)
    {
        if (actor.StunTimer > 0f || dist <= 0f)
        {
            actor.Velocity = Vector2.Zero;
            return;
        }
        var dir = GetMoveDir(actor);
        var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
        actor.Velocity = dir * bossSpd * speedMult;
    }

    private void UpdateBuldygaPhase(float dt, EnemyActor actor, BossPhase phase, float dx, float dy, float dist)
    {
        var accelMult = phase.AccelMult > 0f ? phase.AccelMult : 1f;
        var frictionMult = phase.FrictionMult > 0f ? phase.FrictionMult : 1f;

        var buldygaDef = Ctx.EnemyCatalog.GetByKind(EnemyKind.Buldyga);
        var baseSpeed = (buldygaDef?.Speed ?? 1f) * GameConstants.EnemySpeedScale;
        if (_currentSpeed <= 0f)
            _currentSpeed = baseSpeed;

        _speedAccumulator += dt;
        if (_speedAccumulator >= 1.0f)
        {
            var secs = Mathf.Floor(_speedAccumulator);
            var increment = (buldygaDef?.SpeedIncrement ?? 0.1f) * GameConstants.EnemySpeedScale;
            _currentSpeed += increment * secs;
            _speedAccumulator -= secs;
        }

        if (actor.StunTimer > 0f)
        {
            _velocity = Vector2.Zero;
            actor.Velocity = Vector2.Zero;
            return;
        }

        if (dist > 0f)
        {
            var speedMult = GetRoomSpeedVectorMult(actor, dx, dy);
            var effectiveSpeed = _currentSpeed * speedMult;
            var tvx = (dx / dist) * effectiveSpeed;
            var tvy = (dy / dist) * effectiveSpeed;
            var accel = (buldygaDef?.Accel ?? 40f) * GameConstants.EnemySpeedScale * accelMult * 0.1f * dt;
            var dvx = tvx - _velocity.X;
            var dvy = tvy - _velocity.Y;
            var dLen = Mathf.Sqrt(dvx * dvx + dvy * dvy);
            if (dLen > 0f)
            {
                var step = Mathf.Min(dLen, accel);
                _velocity = new Vector2(
                    _velocity.X + (dvx / dLen) * step,
                    _velocity.Y + (dvy / dLen) * step);
            }
        }
        else
        {
            var friction = 1f - (buldygaDef?.Friction ?? 3.5f) * frictionMult * dt;
            _velocity *= Mathf.Max(0f, friction);
        }

        actor.Velocity = _velocity;
    }

    private void UpdateShooterPhase(float dt, EnemyActor actor, BossPhase phase, float dx, float dy, float dist, float bossSpd)
    {
        var shootCdMult = phase.ShootCdMult > 0f ? phase.ShootCdMult : 0.5f;
        var bulletSpeedMult = phase.BulletSpeedMult > 0f ? phase.BulletSpeedMult : 1f;

        if (actor.StunTimer <= 0f)
        {
            _strafeSwitchTimer -= dt;
            if (_strafeSwitchTimer <= 0f)
            {
                _strafeDir *= -1f;
                _strafeSwitchTimer = GameConstants.BossStrafeSwitchTime;
            }

            if (dist > 0f)
            {
                var hitWall = actor.Velocity.Length() < bossSpd * 0.3f;
                if (hitWall && _strafeSwitchTimer < GameConstants.BossStrafeSwitchTime - 0.2f)
                {
                    _strafeDir *= -1f;
                    _strafeSwitchTimer = GameConstants.BossStrafeSwitchTime;
                }

                var strafeDirX = (-dy / dist) * _strafeDir;
                var strafeDirY = (dx / dist) * _strafeDir;
                var speedMult = GetRoomSpeedVectorMult(actor, strafeDirX, strafeDirY);
                actor.Velocity = new Vector2(strafeDirX * bossSpd * speedMult, strafeDirY * bossSpd * speedMult);
            }
        }
        else
        {
            actor.Velocity = Vector2.Zero;
        }

        if (_shootCd > 0f)
            _shootCd -= dt;

        var shooterDef = Ctx.EnemyCatalog.GetByKind(EnemyKind.Shooter);
        var shootRange = (shooterDef?.ShootRangeCells ?? 2f) * GameConstants.CellPx * 10f;
        var shootCdBase = shooterDef?.ShootCd ?? 1.5f;
        var bulletSpeed = (shooterDef?.BulletSpeed ?? 100f) * bulletSpeedMult;

        if (dist <= shootRange && _shootCd <= 0f && dist > 0f)
        {
            _shootCd = shootCdBase * shootCdMult;
            var ebx = (dx / dist) * bulletSpeed;
            var eby = (dy / dist) * bulletSpeed;
            SpawnEnemyBullet(actor, ebx, eby);
        }
    }

    private void UpdateBullLimitedPhase(float dt, EnemyActor actor, BossPhase phase, float dx, float dy, float dist)
    {
        var bullDef = Ctx.EnemyCatalog.GetByKind(EnemyKind.Bull);
        var dashDistMax = (phase.DashCells > 0f ? phase.DashCells : 5f) * GameConstants.CellPx;
        var chargeDist = (bullDef?.ChargeDistCells ?? 0.75f) * GameConstants.CellPx * 8f;
        var hitDist = actor.Radius + GameConstants.PlayerRadius;
        var bullSpeed = (bullDef?.Speed ?? 1f) * GameConstants.EnemySpeedScale;
        var dashSpeedMult = phase.DashSpeedMult > 0f ? phase.DashSpeedMult : 1.5f;

        switch (_bullState)
        {
            case BullState.Chase:
                if (actor.StunTimer <= 0f && dist > chargeDist && dist > 0f)
                {
                    var dir = GetMoveDir(actor);
                    var speedMult = GetRoomSpeedVectorMult(actor, dir.X, dir.Y);
                    actor.Velocity = dir * bullSpeed * speedMult;
                }
                else if (dist <= chargeDist)
                {
                    _bullState = BullState.Prepare;
                    _bullStateTimer = bullDef?.PrepareTime ?? 1f;
                    actor.Velocity = Vector2.Zero;
                }
                break;

            case BullState.Prepare:
                _bullStateTimer -= dt;
                if (_bullStateTimer <= 0f)
                {
                    _bullState = BullState.Dash;
                    if (dist > 0f)
                    {
                        _dashDir = new Vector2(dx / dist, dy / dist);
                    }
                    else
                    {
                        _dashDir = new Vector2(1f, 0f);
                    }
                    _dashDistance = dashDistMax;
                    _bullStateTimer = 0f;
                }
                break;

            case BullState.Dash:
            {
                var speedMult = GetRoomSpeedVectorMult(actor, _dashDir.X, _dashDir.Y);
                var dashSpeed = bullSpeed * 3f * dashSpeedMult * speedMult;
                actor.Velocity = _dashDir * dashSpeed;
                _bullStateTimer += dashSpeed * dt;
                if (_bullStateTimer >= _dashDistance || dist < hitDist)
                {
                    OnDashFinished(phase);
                }
                break;
            }

            case BullState.Rest:
                _bullStateTimer -= dt;
                actor.Velocity = Vector2.Zero;
                if (_bullStateTimer <= 0f)
                    _bullState = BullState.Chase;
                break;
        }
    }

    private void OnDashFinished(BossPhase phase)
    {
        _bullState = BullState.Rest;
        _bullStateTimer = 3f;
        _dashCount++;
        var maxDashes = phase.MaxDashes > 0 ? phase.MaxDashes : 3;
        if (_dashCount >= maxDashes)
        {
            AdvancePhase();
        }
    }
}
