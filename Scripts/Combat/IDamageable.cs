using Godot;

namespace SpaceOrLife.Combat;

public interface IDamageable
{
    Vector2 Position { get; }
    float Radius { get; }
    bool IsDead { get; }
    bool Stasis { get; }
    bool IsBoss { get; }
    void TakeDamage(float damage, bool isCrit);
    void ApplyStun(float duration);
}
