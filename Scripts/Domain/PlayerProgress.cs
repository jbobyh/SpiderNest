using System.Collections.Generic;

namespace SpaceOrLife.Domain;

public sealed class PlayerProgress
{
    public int Level = 1;
    public int Lives = 3;
    public int TotalLives = 3;
    public int Souls;
    public List<string> WeaponSlots = new() { "pistol", null! };
    public int ActiveSlot;
    public int MaxSlots = 1;
    public List<int> Ammo = new() { 12, 0 };
    public List<string> SpawnedWeapons = new();
    public Dictionary<string, int> UpgradeLevels = new();
    public UpgradeState Upgrades = new();
    public bool BossDefeated;
}
