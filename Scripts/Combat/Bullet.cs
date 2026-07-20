using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Combat;

public sealed class Bullet
{
    public Vector2 Position;
    public Vector2 Velocity;
    public Vector2 BaseVelocity;
    public float Speed;

    public BulletOwner Owner = BulletOwner.Player;
    public float Damage;
    public int Penetrate;
    public int BasePenetrate;
    public bool Ricochet;
    public bool BaseRicochet;

    public Color Color = Colors.White;
    public float MaxRange = 1000f;
    public float DistanceTraveled;
    public int HitCount;

    public bool IsCrit;
    public bool IsIncendiary;
    public bool IsFreeze;
    public float HitStun;
    public IDamageable? AimCritTarget;
    public float AimCritMult = 1f;

    public bool IsDead;
    public float TrailTimer;
    public float RangeDecayMult = 1f;
    public string? LastRoomBonus;
    public bool Ricocheted;
    public float LastSpeedMult = 1f;

    public readonly HashSet<IDamageable> HitEntities = new();

    public void Init(BulletSpawnData data)
    {
        Position = data.Position;
        Velocity = data.Velocity;
        BaseVelocity = data.Velocity;
        Speed = data.Velocity.Length();

        Owner = data.Owner;
        Damage = data.Damage;
        Penetrate = data.Penetrate;
        BasePenetrate = data.Penetrate;
        Ricochet = data.Ricochet;
        BaseRicochet = data.Ricochet;

        Color = data.Color;
        MaxRange = data.MaxRange;

        IsCrit = data.IsCrit;
        IsIncendiary = data.IsIncendiary;
        IsFreeze = data.IsFreeze;
        HitStun = data.HitStun;
        AimCritTarget = data.AimCritTarget;
        AimCritMult = data.AimCritMult;

        IsDead = false;
        DistanceTraveled = 0f;
        HitCount = 0;
        TrailTimer = 0f;
        RangeDecayMult = 1f;
        LastRoomBonus = null;
        Ricocheted = false;
        LastSpeedMult = 1f;
        HitEntities.Clear();
    }

    public void Reset()
    {
        Position = Vector2.Zero;
        Velocity = Vector2.Zero;
        BaseVelocity = Vector2.Zero;
        Speed = 0f;

        Owner = BulletOwner.Player;
        Damage = 0f;
        Penetrate = 0;
        BasePenetrate = 0;
        Ricochet = false;
        BaseRicochet = false;

        Color = Colors.White;
        MaxRange = 1000f;
        DistanceTraveled = 0f;
        HitCount = 0;

        IsCrit = false;
        IsIncendiary = false;
        IsFreeze = false;
        HitStun = 0f;
        AimCritTarget = null;
        AimCritMult = 1f;

        IsDead = true;
        TrailTimer = 0f;
        RangeDecayMult = 1f;
        LastRoomBonus = null;
        Ricocheted = false;
        LastSpeedMult = 1f;
        HitEntities.Clear();
    }

    public void SyncBaseVelocity()
    {
        if (LastRoomBonus == "speeddown" || IsWindBonus(LastRoomBonus))
        {
            var mult = LastSpeedMult != 0f ? LastSpeedMult : 1f;
            BaseVelocity = Velocity / mult;
        }
        else
        {
            BaseVelocity = Velocity;
        }
    }

    private static bool IsWindBonus(string? bonus)
    {
        return bonus == "wind_east" || bonus == "wind_west" ||
               bonus == "wind_north" || bonus == "wind_south";
    }
}

public sealed class BulletSpawnData
{
    public Vector2 Position;
    public Vector2 Velocity;
    public BulletOwner Owner = BulletOwner.Player;
    public float Damage = 1f;
    public int Penetrate;
    public bool Ricochet;
    public Color Color = Colors.White;
    public float MaxRange = 1000f;
    public bool IsCrit;
    public bool IsIncendiary;
    public bool IsFreeze;
    public float HitStun;
    public IDamageable? AimCritTarget;
    public float AimCritMult = 1f;
}
