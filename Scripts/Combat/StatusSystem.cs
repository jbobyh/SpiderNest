using System.Collections.Generic;

namespace SpaceOrLife.Combat;

public enum StatusKind
{
    Freeze,
    Burn
}

public sealed class StatusEffect
{
    public float Remaining;
    public float TickTimer;
    public float TickInterval;
    public float DamagePerTick;
}

public interface IStatusTarget
{
    Dictionary<StatusKind, StatusEffect> Statuses { get; }
    bool IsDead { get; }
    void TakeDamage(float damage, bool isCrit);
}

public static class StatusSystem
{
    private const float FreezeDuration = 2f;
    private const float BurnDuration = 2f;
    private const float BurnTickInterval = 0.2f;

    public static System.Action<IStatusTarget, float>? OnBurnTick;

    public static void ApplyStatus(IStatusTarget target, StatusKind kind, float duration, float damagePerTick = 0f)
    {
        if (target.Statuses == null)
            return;

        if (target.Statuses.TryGetValue(kind, out var existing))
        {
            existing.Remaining = duration;
            if (kind == StatusKind.Burn)
                existing.DamagePerTick = damagePerTick;
        }
        else
        {
            var status = new StatusEffect
            {
                Remaining = duration,
                TickTimer = 0f,
                TickInterval = kind == StatusKind.Burn ? BurnTickInterval : 0f,
                DamagePerTick = damagePerTick,
            };
            target.Statuses[kind] = status;
        }
    }

    public static void UpdateStatuses(IStatusTarget target, float dt)
    {
        if (target.Statuses == null || target.Statuses.Count == 0)
            return;

        var keys = new List<StatusKind>(target.Statuses.Keys);
        for (int i = keys.Count - 1; i >= 0; i--)
        {
            if (target.IsDead)
                return;

            var kind = keys[i];
            var status = target.Statuses[kind];

            status.Remaining -= dt;
            if (status.Remaining <= 0f)
            {
                target.Statuses.Remove(kind);
                continue;
            }

            if (kind == StatusKind.Burn && status.TickInterval > 0f)
            {
                status.TickTimer += dt;
                while (status.TickTimer >= status.TickInterval)
                {
                    status.TickTimer -= status.TickInterval;
                    target.TakeDamage(status.DamagePerTick, false);
                    OnBurnTick?.Invoke(target, status.DamagePerTick);
                    if (target.IsDead)
                        return;
                }
            }
        }
    }

    public static bool HasStatus(IStatusTarget target, StatusKind kind)
    {
        return target.Statuses != null && target.Statuses.ContainsKey(kind);
    }

    public static void ClearStatuses(IStatusTarget target)
    {
        target.Statuses?.Clear();
    }

    public static float GetFreezeDuration() => FreezeDuration;
    public static float GetBurnDuration() => BurnDuration;
}
