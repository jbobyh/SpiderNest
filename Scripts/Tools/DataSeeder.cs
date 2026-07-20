using Godot;
using SpaceOrLife.Core.Catalogs;

namespace SpaceOrLife.Tools;

[Tool]
public partial class DataSeeder : EditorScript
{
    public override void _Run()
    {
        var weapons = FallbackCatalogs.BuildWeapons();
        var enemies = FallbackCatalogs.BuildEnemies();
        var bosses = FallbackCatalogs.BuildBosses();
        var levels = FallbackCatalogs.BuildLevels();
        var upgrades = FallbackCatalogs.BuildUpgrades();
        var roomBonuses = FallbackCatalogs.BuildRoomBonuses();

        ResourceSaver.Save(weapons, "res://Data/Weapons/WeaponCatalog.tres");
        ResourceSaver.Save(enemies, "res://Data/Enemies/EnemyCatalog.tres");
        ResourceSaver.Save(bosses, "res://Data/Bosses/BossCatalog.tres");
        ResourceSaver.Save(levels, "res://Data/Levels/LevelCatalog.tres");
        ResourceSaver.Save(upgrades, "res://Data/Upgrades/UpgradeCatalog.tres");
        ResourceSaver.Save(roomBonuses, "res://Data/RoomBonuses/RoomBonusCatalog.tres");

        var catalog = new GameCatalog
        {
            Weapons = weapons,
            Enemies = enemies,
            Bosses = bosses,
            Levels = levels,
            Upgrades = upgrades,
            RoomBonuses = roomBonuses
        };

        ResourceSaver.Save(catalog, "res://Data/GameCatalog.tres");
        GD.Print("DataSeeder: All catalogs saved to res://Data/");
    }
}
