using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Combat;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.World;

public static class CollectibleSystem
{
    public static void UpdateCollectibles(
        LevelState state,
        PlayerProgress progress,
        Vector2 playerPos)
    {
        var pickupR = GameConstants.PlayerRadius + GameConstants.PickupDistance;

        for (int i = state.Hearts.Count - 1; i >= 0; i--)
        {
            var heart = state.Hearts[i];
            if (heart.Collected || !heart.Spawned)
                continue;
            if (playerPos.DistanceTo(heart.Position) < pickupR)
            {
                heart.Collected = true;
                state.HeartsCollected++;
                if (state.CellContents.ContainsKey(heart.Cell))
                    state.CellContents.Remove(heart.Cell);
                if (progress.Lives < GameConstants.MaxLives)
                {
                    progress.Lives++;
                    progress.TotalLives++;
                }
            }
        }

        if (state.SummonSphere != null && !state.SummonSphere.Collected && state.SummonSphere.Spawned)
        {
            if (playerPos.DistanceTo(state.SummonSphere.Position) < pickupR)
            {
                state.SummonSphere.Collected = true;
                state.SummonSphereCollected = true;
                if (state.CellContents.ContainsKey(state.SummonSphere.Cell))
                    state.CellContents.Remove(state.SummonSphere.Cell);
            }
        }

        state.BossSummonReady = state.SummonSphereCollected && !state.BossDefeated;
    }

    public static bool HandleWeaponPickup(
        LevelState state,
        PlayerProgress progress,
        WeaponCatalog catalog,
        Vector2 playerPos)
    {
        var pickupR = GameConstants.PlayerRadius + GameConstants.WeaponPickupDistance;

        for (int i = state.DroppedWeapons.Count - 1; i >= 0; i--)
        {
            var dw = state.DroppedWeapons[i];
            if (playerPos.DistanceTo(dw.Position) < pickupR)
            {
                CombatSystem.PickupWeapon(progress, catalog, dw.WeaponId, dw.Position, state);
                state.DroppedWeapons.RemoveAt(i);
                return true;
            }
        }

        return false;
    }

    public static bool CheckUpgradeChestActivation(
        LevelState state,
        PlayerProgress progress,
        UpgradeCatalog upgradeCatalog,
        Vector2 playerPos,
        Random rng)
    {
        if (state.PendingChoice != null && state.PendingChoice.Active)
            return false;

        var pickupR = GameConstants.PlayerRadius + GameConstants.PickupDistance;

        foreach (var chest in state.UpgradeChests)
        {
            if (chest.Collected || !chest.Spawned)
                continue;
            if (playerPos.DistanceTo(chest.Position) < pickupR)
            {
                var choices = UpgradeSystem.PickRandomChoices(
                    progress.Upgrades, progress, upgradeCatalog.Regular, 3, rng);

                state.PendingChoice = new PendingChoice
                {
                    Type = ChoiceType.Upgrade,
                    Chest = chest,
                    ChoiceIds = GetChoiceIds(choices),
                    Active = true
                };
                return true;
            }
        }

        return false;
    }

    public static bool CheckSpatialChestActivation(
        LevelState state,
        PlayerProgress progress,
        UpgradeCatalog upgradeCatalog,
        Vector2 playerPos,
        Random rng)
    {
        if (state.PendingChoice != null && state.PendingChoice.Active)
            return false;

        var pickupR = GameConstants.PlayerRadius + GameConstants.PickupDistance;

        foreach (var chest in state.SpatialChests)
        {
            if (chest.Collected || !chest.Spawned)
                continue;
            if (playerPos.DistanceTo(chest.Position) < pickupR)
            {
                var choices = UpgradeSystem.PickRandomChoices(
                    progress.Upgrades, progress, upgradeCatalog.Spatial, 3, rng);

                state.PendingChoice = new PendingChoice
                {
                    Type = ChoiceType.Spatial,
                    Chest = chest,
                    ChoiceIds = GetChoiceIds(choices),
                    Active = true
                };
                return true;
            }
        }

        return false;
    }

    public static bool CheckRoomBonusAltarActivation(
        LevelState state,
        PlayerProgress progress,
        RoomBonusCatalog bonusCatalog,
        Vector2 playerPos,
        Random rng)
    {
        if (state.PendingChoice != null && state.PendingChoice.Active)
            return false;

        var pickupR = GameConstants.PlayerRadius + GameConstants.PickupDistance;

        foreach (var altar in state.RoomBonusAltars)
        {
            if (altar.Activated)
                continue;
            if (!state.OpenCells.Contains(altar.Cell))
                continue;
            if (playerPos.DistanceTo(altar.Position) < pickupR)
            {
                var choices = PickRoomBonusChoices(bonusCatalog, 3, rng);

                state.PendingChoice = new PendingChoice
                {
                    Type = ChoiceType.RoomBonus,
                    Altar = altar,
                    ChoiceIds = choices,
                    Active = true
                };
                return true;
            }
        }

        return false;
    }

    public static void OpenBossCursedChoice(
        LevelState state,
        PlayerProgress progress,
        UpgradeCatalog upgradeCatalog,
        Random rng)
    {
        if (state.PendingChoice != null && state.PendingChoice.Active)
            return;

        var choices = UpgradeSystem.PickRandomChoices(
            progress.Upgrades, progress, upgradeCatalog.Cursed, 3, rng);

        state.PendingChoice = new PendingChoice
        {
            Type = ChoiceType.Cursed,
            ChoiceIds = GetChoiceIds(choices),
            Active = true
        };
    }

    public static CellCoord? ResolvePendingChoice(
        LevelState state,
        PlayerProgress progress,
        UpgradeCatalog upgradeCatalog,
        Random rng)
    {
        var pc = state.PendingChoice;
        if (pc == null || !pc.Active)
            return null;

        string? chosenId = pc.ChoiceIds.Count > 0 ? pc.ChoiceIds[0] : null;

        if (pc.Chest != null)
            pc.Chest.Collected = true;

        if (pc.Altar != null)
        {
            pc.Altar.Activated = true;
            pc.Altar.BonusType = chosenId;
            if (chosenId != null)
            {
                state.RoomBonuses.Add(new RoomBonusAssignment
                {
                    RoomIdx = pc.Altar.RoomIdx,
                    BonusType = chosenId
                });
            }
        }

        if (chosenId != null)
        {
            var def = upgradeCatalog.GetById(chosenId);
            if (def != null)
                UpgradeSystem.ApplyUpgrade(progress.Upgrades, progress, def, upgradeCatalog, rng);
        }

        CellCoord? battleCell = null;
        if (pc.Chest != null)
            battleCell = pc.Chest.Cell;
        else if (pc.Altar != null)
            battleCell = pc.Altar.Cell;

        state.PendingChoice = null;
        return battleCell;
    }

    public static bool IsNearAnyInteractible(LevelState state, Vector2 playerPos)
    {
        var pickupR = GameConstants.PlayerRadius + GameConstants.PickupDistance;

        foreach (var chest in state.UpgradeChests)
        {
            if (chest.Collected || !chest.Spawned) continue;
            if (playerPos.DistanceTo(chest.Position) < pickupR) return true;
        }

        foreach (var chest in state.SpatialChests)
        {
            if (chest.Collected || !chest.Spawned) continue;
            if (playerPos.DistanceTo(chest.Position) < pickupR) return true;
        }

        foreach (var altar in state.RoomBonusAltars)
        {
            if (altar.Activated) continue;
            if (!state.OpenCells.Contains(altar.Cell)) continue;
            if (playerPos.DistanceTo(altar.Position) < pickupR) return true;
        }

        foreach (var altar in state.RoomAltars)
        {
            if (altar.Activated) continue;
            if (!state.OpenCells.Contains(altar.Cell)) continue;
            if (state.CellContents.TryGetValue(altar.Cell, out var content) &&
                content.EnemyCount > 0 && !content.EnemiesReleased)
            {
                if (playerPos.DistanceTo(altar.Position) < pickupR) return true;
            }
        }

        foreach (var dw in state.DroppedWeapons)
        {
            if (playerPos.DistanceTo(dw.Position) < GameConstants.PlayerRadius + GameConstants.WeaponPickupDistance)
                return true;
        }

        return false;
    }

    private static List<string> GetChoiceIds(List<UpgradeDefinition> choices)
    {
        var ids = new List<string>();
        foreach (var c in choices)
            ids.Add(c.Id);
        return ids;
    }

    private static List<string> PickRoomBonusChoices(RoomBonusCatalog catalog, int count, Random rng)
    {
        var available = new List<RoomBonusDefinition>();
        foreach (var b in catalog.Bonuses)
            available.Add(b);

        for (int i = available.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (available[i], available[j]) = (available[j], available[i]);
        }

        var result = new List<string>();
        var take = Math.Min(count, available.Count);
        for (int i = 0; i < take; i++)
            result.Add(available[i].Id);
        return result;
    }
}
