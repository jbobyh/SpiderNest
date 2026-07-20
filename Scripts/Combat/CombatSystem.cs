using System;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Combat;

public static class CombatSystem
{
    public static WeaponDefinition? GetActiveWeapon(PlayerProgress progress, WeaponCatalog catalog)
    {
        if (progress.ActiveSlot < 0 || progress.ActiveSlot >= progress.WeaponSlots.Count)
            return null;

        var weaponId = progress.WeaponSlots[progress.ActiveSlot];
        if (string.IsNullOrEmpty(weaponId))
            return null;

        return catalog.GetById(weaponId);
    }

    public static float GetBulletRange(WeaponDefinition weapon, PlayerProgress progress, LevelState level)
    {
        var upg = progress.Upgrades;
        if (upg.InfiniteRange)
            return float.MaxValue;

        var rangeScale = GameConstants.CellPx / 10f;
        float range = weapon.Range * rangeScale;

        if (upg.Ricochet)
            range *= 1.5f;

        var spatialRange = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.Range);
        range *= 1f + spatialRange;

        if (upg.LongRange)
        {
            int roomCount = level.Battle != null
                ? UpgradeSystem.CountBattleRooms(level)
                : UpgradeSystem.CountOpenRooms(level);
            range *= 1f + 0.20f * roomCount;
        }

        return range;
    }

    public static ShootResult Shoot(
        CombatState combatState,
        PlayerProgress progress,
        WeaponCatalog weaponCatalog,
        LevelState level,
        RoomBonusCatalog bonusCatalog,
        Vector2 playerPos,
        Vector2 mousePos,
        BulletSimulation bulletSim,
        Random rng)
    {
        var result = new ShootResult();

        if (combatState.ShootCooldown > 0f)
            return result;
        if (combatState.IsReloading)
            return result;

        var weapon = GetActiveWeapon(progress, weaponCatalog);
        if (weapon == null)
            return result;

        var slot = progress.ActiveSlot;

        var playerCell = CellCoord.FromWorld(playerPos.X, playerPos.Y, GameConstants.CellPx);
        var isFreeAmmo = RoomBonusHelper.GetRoomBonus(level, playerCell) == "freeAmmo";

        if (!isFreeAmmo && progress.Ammo[slot] <= 0)
        {
            StartReload(combatState, progress, weaponCatalog, level);
            return result;
        }

        if (combatState.BurstRemaining > 0 && combatState.BurstWeaponId == weapon.Id)
        {
            if (combatState.BurstCooldown > 0f)
                return result;
        }
        else if (combatState.BurstRemaining > 0)
        {
            combatState.BurstRemaining = 0;
            combatState.BurstWeaponId = null;
            combatState.BurstCooldown = 0f;
        }

        var upg = progress.Upgrades;

        var killAccelMult = upg.KillAccel
            ? MathF.Max(0.1f, 1f - upg.KillAccelPercent / 100f)
            : 1f;

        var spatialReload = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.Reload);
        var cooldown = weapon.Cooldown * upg.CooldownMult * killAccelMult * MathF.Max(0.1f, 1f - spatialReload);

        var dx = mousePos.X - playerPos.X;
        var dy = mousePos.Y - playerPos.Y;
        var baseAngle = Mathf.Atan2(dy, dx);

        var isBurstWeapon = weapon.IsBurst;
        var pellets = isBurstWeapon ? weapon.Pellets : weapon.Pellets;
        var burstTotal = isBurstWeapon ? weapon.BurstSize : weapon.BurstSize;
        var burstDelay = BurstStepDelay(weapon, burstTotal) * upg.CooldownMult * killAccelMult;

        var totalSpread = GetTotalSpread(combatState, weapon, upg, level, progress);

        var bloomReduction = upg.BloomReduction;
        var roomBloomBonus = RoomBonusHelper.GetRoomBonus(level, playerCell) == "bloomReduction";
        var bloomMult = MathF.Max(0f, 1f - bloomReduction) * (roomBloomBonus ? 0.6f : 1f);
        combatState.BloomSpread += weapon.BloomPerShot * bloomMult;

        var spatialBulletSpeed = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.BulletSpeed);
        var bulletSpeed = weapon.BulletSpeed * upg.BulletSpeedMult * (1f + spatialBulletSpeed);

        var extraBullets = 0;
        var extraChance = upg.ExtraBulletChance;
        while (extraChance > 0 && rng.NextDouble() < extraChance)
        {
            extraBullets++;
            extraChance--;
        }

        var totalPellets = pellets + extraBullets;

        var roomBonus = RoomBonusHelper.GetRoomBonus(level, playerCell);
        var incendiaryChance = upg.IncendiaryChance;
        if (roomBonus == "burnChance") incendiaryChance += 0.1f;
        var freezeChance = upg.FreezeChance;
        if (roomBonus == "freezeChance") freezeChance += 0.1f;

        for (int i = 0; i < totalPellets; i++)
        {
            var spread = (float)(rng.NextDouble() - 0.5) * totalSpread;
            SpawnPlayerBullet(bulletSim, weapon, baseAngle + spread, bulletSpeed, playerPos, rng,
                progress, level, incendiaryChance, freezeChance);
        }

        result.Fired = true;
        result.ShakeAmount = weapon.ShakeAmount;
        result.BaseAngle = baseAngle;

        ApplyBurstCooldown(combatState, weapon, isBurstWeapon, burstTotal, burstDelay, cooldown);

        if (weapon.Id == "pistol" || weapon.Id == "smg" || weapon.Id == "carbine" || weapon.Id == "rifle")
        {
            combatState.WeaponShootAnim = cooldown * weapon.ShootAnimRatio;
            combatState.WeaponShootAnimMax = combatState.WeaponShootAnim;
        }

        if (!isFreeAmmo)
        {
            progress.Ammo[slot]--;

            if (progress.Ammo[slot] <= 0)
                StartReload(combatState, progress, weaponCatalog, level);
        }

        return result;
    }

    public static void StartReload(CombatState combatState, PlayerProgress progress, WeaponCatalog catalog, LevelState? level = null)
    {
        var slot = progress.ActiveSlot;
        if (slot < 0 || slot >= progress.WeaponSlots.Count)
            return;

        var wId = progress.WeaponSlots[slot];
        if (string.IsNullOrEmpty(wId))
            return;

        var weapon = catalog.GetById(wId);
        if (weapon == null || weapon.MagazineSize == 0)
            return;

        if (combatState.IsReloading)
            return;
        if (progress.Ammo[slot] >= weapon.MagazineSize)
            return;

        var upg = progress.Upgrades;
        var killAccelMult = upg.KillAccel
            ? MathF.Max(0.1f, 1f - upg.KillAccelPercent / 100f)
            : 1f;
        var spatialReload = level != null
            ? UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.Reload)
            : 0f;
        var reloadTime = weapon.ReloadTime * upg.CooldownMult * killAccelMult * MathF.Max(0.1f, 1f - spatialReload);

        combatState.IsReloading = true;
        combatState.ReloadingSlot = slot;
        combatState.ReloadCooldown = reloadTime;
        combatState.BurstRemaining = 0;
        combatState.BurstWeaponId = null;

        if (weapon.Id == "pistol" || weapon.Id == "smg" || weapon.Id == "carbine" || weapon.Id == "rifle")
        {
            combatState.WeaponReloadAnim = reloadTime * weapon.ReloadAnimRatio;
            combatState.WeaponReloadAnimMax = combatState.WeaponReloadAnim;
        }
    }

    public static void FinishReload(CombatState combatState, PlayerProgress progress, WeaponCatalog catalog)
    {
        var slot = combatState.ReloadingSlot;
        if (slot < 0)
            return;

        if (slot < progress.WeaponSlots.Count)
        {
            var wId = progress.WeaponSlots[slot];
            if (!string.IsNullOrEmpty(wId))
            {
                var weapon = catalog.GetById(wId);
                if (weapon != null)
                    progress.Ammo[slot] = weapon.MagazineSize;
            }
        }

        combatState.IsReloading = false;
        combatState.ReloadingSlot = -1;
        combatState.ReloadCooldown = 0f;
    }

    public static void SwitchWeapon(PlayerProgress progress, CombatState combatState)
    {
        if (progress.MaxSlots <= 1)
            return;

        progress.ActiveSlot = (progress.ActiveSlot + 1) % progress.MaxSlots;
        combatState.IsReloading = false;
        combatState.ReloadingSlot = -1;
        combatState.ReloadCooldown = 0f;
        combatState.BurstRemaining = 0;
        combatState.BurstWeaponId = null;
    }

    public static void SelectSlot(PlayerProgress progress, CombatState combatState, int slot)
    {
        if (slot < 0 || slot >= progress.MaxSlots)
            return;
        if (string.IsNullOrEmpty(progress.WeaponSlots[slot]))
            return;

        progress.ActiveSlot = slot;
        combatState.IsReloading = false;
        combatState.ReloadingSlot = -1;
        combatState.ReloadCooldown = 0f;
        combatState.BurstRemaining = 0;
        combatState.BurstWeaponId = null;
    }

    public static void PickupWeapon(
        PlayerProgress progress,
        WeaponCatalog catalog,
        string weaponId,
        Vector2 dropPos,
        LevelState? level = null)
    {
        int freeSlot = -1;
        for (int i = 0; i < progress.MaxSlots; i++)
        {
            if (i >= progress.WeaponSlots.Count)
                break;
            if (string.IsNullOrEmpty(progress.WeaponSlots[i]))
            {
                freeSlot = i;
                break;
            }
        }

        if (freeSlot >= 0)
        {
            progress.WeaponSlots[freeSlot] = weaponId;
            progress.ActiveSlot = freeSlot;
        }
        else
        {
            var droppedId = progress.WeaponSlots[progress.ActiveSlot];
            if (!string.IsNullOrEmpty(droppedId))
            {
                var cell = CellCoord.FromWorld(dropPos.X, dropPos.Y, GameConstants.CellPx);
                progress.SpawnedWeapons.Add(droppedId);
                if (level != null)
                {
                    level.DroppedWeapons.Add(new DroppedWeaponData
                    {
                        Position = dropPos,
                        Cell = cell,
                        WeaponId = droppedId
                    });
                }
            }

            progress.WeaponSlots[progress.ActiveSlot] = weaponId;
        }

        var pickedWDef = catalog.GetById(weaponId);
        var targetSlot = progress.ActiveSlot;
        if (pickedWDef != null && pickedWDef.MagazineSize > 0)
        {
            while (progress.Ammo.Count <= targetSlot)
                progress.Ammo.Add(0);
            progress.Ammo[targetSlot] = pickedWDef.MagazineSize;
        }
    }

    public static void Tick(CombatState combatState, float dt, PlayerProgress? progress, WeaponCatalog? catalog)
    {
        combatState.ShootCooldown = MathF.Max(0f, combatState.ShootCooldown - dt);
        combatState.BurstCooldown = MathF.Max(0f, combatState.BurstCooldown - dt);
        combatState.WeaponShootAnim = MathF.Max(0f, combatState.WeaponShootAnim - dt);
        combatState.WeaponReloadAnim = MathF.Max(0f, combatState.WeaponReloadAnim - dt);

        if (combatState.BloomSpread > 0f)
        {
            if (catalog != null && progress != null)
            {
                var wDef = GetActiveWeapon(progress, catalog);
                if (wDef != null)
                {
                    var recoveryTime = wDef.BloomRecoveryTime > 0f ? wDef.BloomRecoveryTime : 1f;
                    combatState.BloomSpread *= MathF.Exp(-dt / recoveryTime);
                    if (combatState.BloomSpread < 0.001f)
                        combatState.BloomSpread = 0f;
                }
                else
                {
                    combatState.BloomSpread = 0f;
                }
            }
            else
            {
                combatState.BloomSpread = 0f;
            }
        }

        if (combatState.IsReloading)
        {
            combatState.ReloadCooldown -= dt;
            if (combatState.ReloadCooldown <= 0f && catalog != null && progress != null)
            {
                FinishReload(combatState, progress, catalog);
            }
        }
    }

    public static float GetTotalSpread(CombatState combatState, WeaponDefinition weapon,
        UpgradeState upg, LevelState level, PlayerProgress progress)
    {
        var totalSpread = (weapon.Spread + combatState.BloomSpread) * upg.SpreadMult;

        if (upg.Sniper)
        {
            int roomCount = level.Battle != null
                ? UpgradeSystem.CountBattleRooms(level)
                : UpgradeSystem.CountOpenRooms(level);
            if (roomCount <= 2)
                totalSpread = 0f;
            else
                totalSpread = weapon.Spread * 0.1f * (roomCount - 2);
        }

        var spatialAccuracy = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.Accuracy);
        totalSpread *= MathF.Max(0f, 1f - spatialAccuracy);

        var maxSpread = weapon.MaxSpread > 0f ? weapon.MaxSpread : GameConstants.MaxSpreadRad;
        return MathF.Min(maxSpread, MathF.Max(0f, totalSpread));
    }

    private static void SpawnPlayerBullet(
        BulletSimulation bulletSim,
        WeaponDefinition weapon,
        float angle,
        float bulletSpeed,
        Vector2 playerPos,
        Random rng,
        PlayerProgress progress,
        LevelState level,
        float incendiaryChance,
        float freezeChance)
    {
        var upg = progress.Upgrades;

        var spatialCritChance = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.CritChance);
        var isCrit = rng.NextDouble() < (upg.CritChance + spatialCritChance);

        var spatialCritDamage = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.CritDamage);
        var critMult = 2f + upg.CritDamage + spatialCritDamage;

        var damage = weapon.Damage * (1f + upg.DamageMult);
        if (isCrit)
            damage *= critMult;

        var spatialPenetrate = UpgradeSystem.GetSpatialBonus(upg, level, progress, SpatialAxis.Penetrate);
        var penetrate = upg.InfinitePenetrate
            ? int.MaxValue
            : weapon.Penetrate + upg.Penetrate + (int)spatialPenetrate;

        var vx = MathF.Cos(angle) * bulletSpeed;
        var vy = MathF.Sin(angle) * bulletSpeed;

        var isIncendiary = incendiaryChance > 0 && rng.NextDouble() < incendiaryChance;
        var isFreeze = freezeChance > 0 && rng.NextDouble() < freezeChance;

        bulletSim.Spawn(new BulletSpawnData
        {
            Position = playerPos,
            Velocity = new Vector2(vx, vy),
            Owner = BulletOwner.Player,
            Damage = damage,
            Penetrate = penetrate,
            Ricochet = upg.Ricochet,
            MaxRange = GetBulletRange(weapon, progress, level),
            Color = Colors.Yellow,
            IsCrit = isCrit,
            IsIncendiary = isIncendiary,
            IsFreeze = isFreeze,
            HitStun = upg.HitStun,
            AimCritTarget = null,
            AimCritMult = critMult
        });
    }

    private static float BurstStepDelay(WeaponDefinition weapon, int total)
    {
        if (weapon.BurstDuration <= 0f || total <= 1)
            return 0f;
        return weapon.BurstDuration / (total - 1);
    }

    private static void ApplyBurstCooldown(
        CombatState combatState,
        WeaponDefinition weapon,
        bool isBurstWeapon,
        int burstTotal,
        float burstDelay,
        float cooldown)
    {
        if (!isBurstWeapon)
        {
            combatState.ShootCooldown = cooldown;
            combatState.MaxShootCooldown = cooldown;
            return;
        }

        if (combatState.BurstRemaining == 0)
        {
            combatState.BurstRemaining = burstTotal - 1;
            combatState.BurstWeaponId = weapon.Id;
            combatState.BurstCooldown = burstDelay;
            combatState.ShootCooldown = 0f;
        }
        else
        {
            combatState.BurstRemaining--;
            if (combatState.BurstRemaining > 0)
            {
                combatState.BurstCooldown = burstDelay;
                combatState.ShootCooldown = 0f;
            }
            else
            {
                combatState.BurstWeaponId = null;
                combatState.ShootCooldown = cooldown;
                combatState.MaxShootCooldown = cooldown;
            }
        }
    }

}

public sealed class ShootResult
{
    public bool Fired;
    public float ShakeAmount;
    public float BaseAngle;
}
