using System;
using Godot;
using SpaceOrLife.Actors;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.Combat;

public static class ContactDamageSystem
{
    public static void CheckContact(
        PlayerActor player,
        EnemyManager enemies,
        PlayerProgress progress,
        Action onPlayerDead)
    {
        if (player.IsDashing || player.IsInvulnerable)
            return;

        var playerPos = player.GlobalPosition;
        var playerRadius = GameConstants.PlayerRadius;

        foreach (var enemy in enemies.Enemies)
        {
            if (!GodotObject.IsInstanceValid(enemy) || enemy.IsDead || enemy.Stasis)
                continue;

            if (enemy.IsShooter && !enemy.IsBoss)
                continue;

            var dist = playerPos.DistanceTo(enemy.GlobalPosition);
            var contactDist = playerRadius + enemy.Radius;

            if (dist < contactDist)
            {
                UpgradeSystem.DealPlayerDamage(progress.Upgrades, progress, player, onPlayerDead);
                return;
            }
        }
    }
}
