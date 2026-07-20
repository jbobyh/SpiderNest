namespace SpaceOrLife.Combat;

public sealed class CombatState
{
    public float ShootCooldown;
    public float MaxShootCooldown;
    public float BurstCooldown;
    public int BurstRemaining;
    public string? BurstWeaponId;

    public bool IsReloading;
    public int ReloadingSlot = -1;
    public float ReloadCooldown;

    public float BloomSpread;

    public float WeaponShootAnim;
    public float WeaponShootAnimMax;
    public float WeaponReloadAnim;
    public float WeaponReloadAnimMax;
}
