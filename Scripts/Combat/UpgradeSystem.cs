using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Actors;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Combat;

public static class UpgradeSystem
{
    public static void ApplyUpgrade(
        UpgradeState upgrades,
        PlayerProgress progress,
        UpgradeDefinition def,
        UpgradeCatalog? catalog,
        Random rng)
    {
        if (def == null)
            return;

        progress.UpgradeLevels[def.Id] = (progress.UpgradeLevels.TryGetValue(def.Id, out var cur) ? cur : 0) + 1;

        if (upgrades.HasFlag(def.Id))
            upgrades.SetFlag(def.Id, true);

        if (!string.IsNullOrEmpty(def.Blocks))
            upgrades.SetFlag(def.Blocks, false);

        if (def.Effects != null)
        {
            foreach (var (key, value) in def.Effects)
            {
                ApplyEffect(upgrades, progress, key, value);
            }
        }

        if (def.Id == "cooldown")
        {
            upgrades.CooldownMult = MathF.Max(0.1f, upgrades.CooldownMult);
        }

        if (!string.IsNullOrEmpty(def.OnApplyId))
        {
            ApplyCustomLogic(upgrades, progress, def.OnApplyId, catalog, rng);
        }

        if (def.Id == "randomBonus")
        {
            ApplyRandomBonus(upgrades, progress, catalog, rng);
        }
    }

    private static void ApplyEffect(UpgradeState upgrades, PlayerProgress progress, string key, Variant value)
    {
        if (value.VariantType == Variant.Type.Bool)
        {
            var b = value.AsBool();
            upgrades.SetFlag(key, b);
            return;
        }

        if (value.VariantType == Variant.Type.Int)
        {
            var n = value.AsInt32();
            ApplyNumericEffect(upgrades, key, n);
            return;
        }

        if (value.VariantType == Variant.Type.Float)
        {
            var f = value.AsSingle();
            ApplyNumericEffect(upgrades, key, f);
            return;
        }
    }

    private static void ApplyNumericEffect(UpgradeState upgrades, string key, float value)
    {
        switch (key)
        {
            case "damageMult": upgrades.DamageMult += value; break;
            case "cooldownMult": upgrades.CooldownMult += value; break;
            case "speedMult": upgrades.SpeedMult += value; break;
            case "spreadMult": upgrades.SpreadMult += value; break;
            case "bulletSpeedMult": upgrades.BulletSpeedMult += value; break;
            case "critChance": upgrades.CritChance += value; break;
            case "critDamage": upgrades.CritDamage += value; break;
            case "bloomReduction": upgrades.BloomReduction += value; break;
            case "extraBulletChance": upgrades.ExtraBulletChance += value; break;
            case "hitStun": upgrades.HitStun += value; break;
            case "incendiaryChance": upgrades.IncendiaryChance += value; break;
            case "freezeChance": upgrades.FreezeChance += value; break;
            case "penetrate": upgrades.Penetrate += (int)value; break;
            case "shield": upgrades.Shield += (int)value; break;
            case "retreat": upgrades.Retreat += value; break;
            case "killAccelPercent": upgrades.KillAccelPercent += value; break;
        }
    }

    private static void ApplyCustomLogic(
        UpgradeState upgrades,
        PlayerProgress progress,
        string onApplyId,
        UpgradeCatalog? catalog,
        Random rng)
    {
        switch (onApplyId)
        {
            case "weaponSlot":
                progress.MaxSlots++;
                while (progress.WeaponSlots.Count < progress.MaxSlots)
                    progress.WeaponSlots.Add(null!);
                while (progress.Ammo.Count < progress.MaxSlots)
                    progress.Ammo.Add(0);
                break;
        }
    }

    private static void ApplyRandomBonus(UpgradeState upgrades, PlayerProgress progress, UpgradeCatalog? catalog, Random rng)
    {
        if (catalog == null)
            return;

        var available = new List<UpgradeDefinition>();
        foreach (var u in catalog.Regular)
        {
            if (IsUpgradeAvailable(upgrades, progress, u))
                available.Add(u);
        }

        ShuffleInPlace(available, rng);
        var chosen = available.Count > 3 ? available.GetRange(0, 3) : available;

        foreach (var def in chosen)
            ApplyUpgrade(upgrades, progress, def, catalog, rng);
    }

    public static bool IsUpgradeAvailable(UpgradeState upgrades, PlayerProgress progress, UpgradeDefinition def)
    {
        if (def == null)
            return false;

        var count = progress.UpgradeLevels.TryGetValue(def.Id, out var c) ? c : 0;
        if (count >= def.Max)
            return false;

        if (upgrades.HasFlag(def.Id))
            return false;

        if (!string.IsNullOrEmpty(def.Blocks) && upgrades.HasFlag(def.Blocks))
            return false;

        return true;
    }

    public static List<UpgradeDefinition> PickRandomChoices(
        UpgradeState upgrades,
        PlayerProgress progress,
        IReadOnlyList<UpgradeDefinition> pool,
        int count,
        Random rng)
    {
        var available = new List<UpgradeDefinition>();
        for (int i = 0; i < pool.Count; i++)
        {
            if (IsUpgradeAvailable(upgrades, progress, pool[i]))
                available.Add(pool[i]);
        }

        ShuffleInPlace(available, rng);
        return available.Count > count ? available.GetRange(0, count) : available;
    }

    private static void ShuffleInPlace<T>(List<T> list, Random rng)
    {
        for (int i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    public static float GetSpatialBonus(UpgradeState upgrades, LevelState level, PlayerProgress progress, SpatialAxis axis)
    {
        int roomCount = CountOpenRooms(level);
        int heartCount = progress.Lives;

        float total = 0f;

        if (axis == SpatialAxis.Reload)
        {
            if (upgrades.SpatialReloadRooms) total += 0.10f * roomCount;
            if (upgrades.SpatialReloadHearts) total += 0.10f * heartCount;
        }
        else if (axis == SpatialAxis.Range)
        {
            if (upgrades.SpatialRangeRooms) total += 0.20f * roomCount;
            if (upgrades.SpatialRangeHearts) total += 0.20f * heartCount;
        }
        else if (axis == SpatialAxis.Accuracy)
        {
            if (upgrades.SpatialAccuracyRooms) total += 0.20f * roomCount;
            if (upgrades.SpatialAccuracyHearts) total += 0.20f * heartCount;
        }
        else if (axis == SpatialAxis.BulletSpeed)
        {
            if (upgrades.SpatialBulletSpeedRooms) total += 0.20f * roomCount;
            if (upgrades.SpatialBulletSpeedHearts) total += 0.20f * heartCount;
        }
        else if (axis == SpatialAxis.Speed)
        {
            if (upgrades.SpatialSpeedRooms) total += 0.10f * roomCount;
            if (upgrades.SpatialSpeedHearts) total += 0.10f * heartCount;
        }
        else if (axis == SpatialAxis.CritChance)
        {
            if (upgrades.SpatialCritChanceRooms) total += 0.05f * roomCount;
            if (upgrades.SpatialCritChanceHearts) total += 0.05f * heartCount;
        }
        else if (axis == SpatialAxis.CritDamage)
        {
            if (upgrades.SpatialCritDamageRooms) total += 0.50f * roomCount;
            if (upgrades.SpatialCritDamageHearts) total += 0.50f * heartCount;
        }
        else if (axis == SpatialAxis.Penetrate)
        {
            if (upgrades.SpatialPenetrateRooms) total += roomCount;
            if (upgrades.SpatialPenetrateHearts) total += heartCount;
        }

        return total;
    }

    public static int CountOpenRooms(LevelState level)
    {
        if (level.Rooms == null || level.OpenCells == null)
            return 1;

        int openedRooms = 0;
        for (int i = 0; i < level.Rooms.Count; i++)
        {
            var room = level.Rooms[i];
            for (int j = 0; j < room.Cells.Count; j++)
            {
                if (level.OpenCells.Contains(room.Cells[j]))
                {
                    openedRooms++;
                    break;
                }
            }
        }
        return Math.Max(1, openedRooms);
    }

    public static int CountBattleRooms(LevelState level)
    {
        if (level.Battle == null || level.Rooms == null)
            return CountOpenRooms(level);

        int participatingRooms = 0;
        for (int i = 0; i < level.Rooms.Count; i++)
        {
            var room = level.Rooms[i];
            for (int j = 0; j < room.Cells.Count; j++)
            {
                if (level.Battle.BattleCells.Contains(room.Cells[j]))
                {
                    participatingRooms++;
                    break;
                }
            }
        }
        return participatingRooms;
    }

    public static bool DealPlayerDamage(
        UpgradeState upgrades,
        PlayerProgress progress,
        PlayerActor player,
        Action onDead)
    {
        if (player.IsInvulnerable)
            return false;

        if (upgrades.Shield > 0)
        {
            upgrades.Shield--;
            player.SetInvulnerable(GameConstants.PlayerInvulnerableTime + upgrades.Retreat);
            return true;
        }

        if (upgrades.LastLife && progress.Lives <= 1)
        {
            upgrades.LastLife = false;
            player.SetInvulnerable(GameConstants.PlayerInvulnerableTime + upgrades.Retreat);
            return true;
        }

        progress.Lives--;
        player.SetInvulnerable(GameConstants.PlayerInvulnerableTime + upgrades.Retreat);

        if (progress.Lives <= 0)
        {
            progress.Lives = 0;
            onDead?.Invoke();
        }

        return true;
    }
}
