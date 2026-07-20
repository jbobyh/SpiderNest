namespace SpaceOrLife.Domain;

public sealed class UpgradeState
{
    public float DamageMult;
    public float CooldownMult = 1f;
    public float SpeedMult = 1f;
    public float SpreadMult = 1f;
    public float BulletSpeedMult = 1f;
    public float CritChance;
    public float CritDamage;
    public float BloomReduction;
    public float ExtraBulletChance;
    public float HitStun;
    public float IncendiaryChance;
    public float FreezeChance;
    public int Penetrate;
    public int Shield;
    public float Retreat;
    public bool KillAccel;
    public float KillAccelPercent;
    public bool EnhancedPierce;
    public bool InfinitePenetrate;
    public bool InfiniteRange;
    public bool Ricochet;
    public bool LastLife;
    public bool BattleSpeed;
    public bool Freeze;
    public bool RandomBonus;
    public bool LongRange;
    public bool Sniper;

    public bool SpatialReloadRooms;
    public bool SpatialReloadHearts;
    public bool SpatialRangeRooms;
    public bool SpatialRangeHearts;
    public bool SpatialAccuracyRooms;
    public bool SpatialAccuracyHearts;
    public bool SpatialBulletSpeedRooms;
    public bool SpatialBulletSpeedHearts;
    public bool SpatialSpeedRooms;
    public bool SpatialSpeedHearts;
    public bool SpatialCritChanceRooms;
    public bool SpatialCritChanceHearts;
    public bool SpatialCritDamageRooms;
    public bool SpatialCritDamageHearts;
    public bool SpatialPenetrateRooms;
    public bool SpatialPenetrateHearts;

    public bool HasFlag(string id)
    {
        return id switch
        {
            "killAccel" => KillAccel,
            "enhancedPierce" => EnhancedPierce,
            "infinitePenetrate" => InfinitePenetrate,
            "infiniteRange" => InfiniteRange,
            "ricochet" => Ricochet,
            "lastLife" => LastLife,
            "battleSpeed" => BattleSpeed,
            "freeze" => Freeze,
            "randomBonus" => RandomBonus,
            "longRange" => LongRange,
            "sniper" => Sniper,
            "spatialReloadRooms" => SpatialReloadRooms,
            "spatialReloadHearts" => SpatialReloadHearts,
            "spatialRangeRooms" => SpatialRangeRooms,
            "spatialRangeHearts" => SpatialRangeHearts,
            "spatialAccuracyRooms" => SpatialAccuracyRooms,
            "spatialAccuracyHearts" => SpatialAccuracyHearts,
            "spatialBulletSpeedRooms" => SpatialBulletSpeedRooms,
            "spatialBulletSpeedHearts" => SpatialBulletSpeedHearts,
            "spatialSpeedRooms" => SpatialSpeedRooms,
            "spatialSpeedHearts" => SpatialSpeedHearts,
            "spatialCritChanceRooms" => SpatialCritChanceRooms,
            "spatialCritChanceHearts" => SpatialCritChanceHearts,
            "spatialCritDamageRooms" => SpatialCritDamageRooms,
            "spatialCritDamageHearts" => SpatialCritDamageHearts,
            "spatialPenetrateRooms" => SpatialPenetrateRooms,
            "spatialPenetrateHearts" => SpatialPenetrateHearts,
            _ => false
        };
    }

    public void SetFlag(string id, bool value)
    {
        switch (id)
        {
            case "killAccel": KillAccel = value; break;
            case "enhancedPierce": EnhancedPierce = value; break;
            case "infinitePenetrate": InfinitePenetrate = value; break;
            case "infiniteRange": InfiniteRange = value; break;
            case "ricochet": Ricochet = value; break;
            case "lastLife": LastLife = value; break;
            case "battleSpeed": BattleSpeed = value; break;
            case "freeze": Freeze = value; break;
            case "randomBonus": RandomBonus = value; break;
            case "longRange": LongRange = value; break;
            case "sniper": Sniper = value; break;
            case "spatialReloadRooms": SpatialReloadRooms = value; break;
            case "spatialReloadHearts": SpatialReloadHearts = value; break;
            case "spatialRangeRooms": SpatialRangeRooms = value; break;
            case "spatialRangeHearts": SpatialRangeHearts = value; break;
            case "spatialAccuracyRooms": SpatialAccuracyRooms = value; break;
            case "spatialAccuracyHearts": SpatialAccuracyHearts = value; break;
            case "spatialBulletSpeedRooms": SpatialBulletSpeedRooms = value; break;
            case "spatialBulletSpeedHearts": SpatialBulletSpeedHearts = value; break;
            case "spatialSpeedRooms": SpatialSpeedRooms = value; break;
            case "spatialSpeedHearts": SpatialSpeedHearts = value; break;
            case "spatialCritChanceRooms": SpatialCritChanceRooms = value; break;
            case "spatialCritChanceHearts": SpatialCritChanceHearts = value; break;
            case "spatialCritDamageRooms": SpatialCritDamageRooms = value; break;
            case "spatialCritDamageHearts": SpatialCritDamageHearts = value; break;
            case "spatialPenetrateRooms": SpatialPenetrateRooms = value; break;
            case "spatialPenetrateHearts": SpatialPenetrateHearts = value; break;
        }
    }
}
