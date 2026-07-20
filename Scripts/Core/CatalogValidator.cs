using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core;

public static class CatalogValidator
{
    public static IReadOnlyList<string> Validate(GameCatalog? catalog)
    {
        var errors = new List<string>();
        if (catalog == null)
        {
            errors.Add("GameCatalog is null — failed to load res://Data/GameCatalog.tres");
            return errors;
        }

        ValidateWeapons(catalog.Weapons, errors);
        ValidateEnemies(catalog.Enemies, errors);
        ValidateBosses(catalog.Bosses, errors);
        ValidateLevels(catalog.Levels, catalog.Enemies, errors);
        ValidateUpgrades(catalog.Upgrades, errors);
        ValidateRoomBonuses(catalog.RoomBonuses, errors);

        return errors;
    }

    private static void ValidateWeapons(WeaponCatalog? cat, List<string> errors)
    {
        if (cat == null) { errors.Add("WeaponCatalog missing"); return; }
        var seen = new HashSet<string>();
        foreach (var w in cat.Weapons)
        {
            if (w == null) continue;
            if (string.IsNullOrEmpty(w.Id))
                errors.Add($"WeaponDefinition has empty Id");
            else if (!seen.Add(w.Id))
                errors.Add($"Duplicate weapon Id: {w.Id}");
            if (w.Damage <= 0) errors.Add($"Weapon {w.Id}: damage must be > 0");
            if (w.Cooldown <= 0) errors.Add($"Weapon {w.Id}: cooldown must be > 0");
            if (w.MagazineSize <= 0) errors.Add($"Weapon {w.Id}: magazineSize must be > 0");
        }
    }

    private static void ValidateEnemies(EnemyCatalog? cat, List<string> errors)
    {
        if (cat == null) { errors.Add("EnemyCatalog missing"); return; }
        var seenKind = new HashSet<EnemyKind>();
        var seenId = new HashSet<string>();
        foreach (var e in cat.Enemies)
        {
            if (e == null) continue;
            if (!seenKind.Add(e.Kind))
                errors.Add($"Duplicate enemy Kind: {e.Kind}");
            if (!string.IsNullOrEmpty(e.Id) && !seenId.Add(e.Id))
                errors.Add($"Duplicate enemy Id: {e.Id}");
            if (e.Hp <= 0) errors.Add($"Enemy {e.Kind}: hp must be > 0");
            if (e.Radius <= 0) errors.Add($"Enemy {e.Kind}: radius must be > 0");
        }
    }

    private static void ValidateBosses(BossCatalog? cat, List<string> errors)
    {
        if (cat == null) { errors.Add("BossCatalog missing"); return; }
        var seen = new HashSet<int>();
        foreach (var b in cat.Bosses)
        {
            if (b == null) continue;
            if (!seen.Add(b.Level))
                errors.Add($"Duplicate boss Level: {b.Level}");
            if (b.Phases.Count == 0)
                errors.Add($"Boss Level {b.Level}: no phases defined");
            if (b.HpSource == BossHpSource.Fixed && b.HpFixed <= 0)
                errors.Add($"Boss level {b.Level}: fixed hp must be > 0");
            if (b.HpSource != BossHpSource.Fixed && b.HpMult <= 0)
                errors.Add($"Boss level {b.Level}: hpMult must be > 0");
        }
    }

    private static void ValidateLevels(LevelCatalog? cat, EnemyCatalog? enemies, List<string> errors)
    {
        if (cat == null) { errors.Add("LevelCatalog missing"); return; }
        var seen = new HashSet<int>();
        foreach (var l in cat.Levels)
        {
            if (l == null) continue;
            if (!seen.Add(l.Level))
                errors.Add($"Duplicate level: {l.Level}");
            if (l.RoomCount <= 0) errors.Add($"Level {l.Level}: roomCount must be > 0");
            if (l.SpawnKinds.Count != l.SpawnWeights.Count)
                errors.Add($"Level {l.Level}: spawnKinds/weights length mismatch");

            for (int i = 0; i < l.SpawnKinds.Count; i++)
            {
                var kind = l.SpawnKinds[i];
                if (enemies?.GetByKind(kind) == null)
                    errors.Add($"Level {l.Level}: spawn table references unknown enemy {kind}");
            }
        }
    }

    private static void ValidateUpgrades(UpgradeCatalog? cat, List<string> errors)
    {
        if (cat == null) { errors.Add("UpgradeCatalog missing"); return; }
        var seen = new HashSet<string>();
        ValidateUpgradeList(cat.Regular, seen, errors);
        ValidateUpgradeList(cat.Cursed, seen, errors);
        ValidateUpgradeList(cat.Spatial, seen, errors);
    }

    private static void ValidateUpgradeList(
        Godot.Collections.Array<UpgradeDefinition> list,
        HashSet<string> seen,
        List<string> errors)
    {
        foreach (var u in list)
        {
            if (u == null) continue;
            if (string.IsNullOrEmpty(u.Id))
                errors.Add("UpgradeDefinition has empty Id");
            else if (!seen.Add(u.Id))
                errors.Add($"Duplicate upgrade Id: {u.Id}");
            if (u.Max <= 0) errors.Add($"Upgrade {u.Id}: max must be > 0");
        }
    }

    private static void ValidateRoomBonuses(RoomBonusCatalog? cat, List<string> errors)
    {
        if (cat == null) { errors.Add("RoomBonusCatalog missing"); return; }
        var seen = new HashSet<string>();
        foreach (var b in cat.Bonuses)
        {
            if (b == null) continue;
            if (string.IsNullOrEmpty(b.Id))
                errors.Add("RoomBonusDefinition has empty Id");
            else if (!seen.Add(b.Id))
                errors.Add($"Duplicate room bonus Id: {b.Id}");
        }
    }
}
