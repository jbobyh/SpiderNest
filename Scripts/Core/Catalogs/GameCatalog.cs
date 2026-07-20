using Godot;
using SpaceOrLife.Core;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class GameCatalog : Resource
{
    [Export] public WeaponCatalog? Weapons;
    [Export] public EnemyCatalog? Enemies;
    [Export] public BossCatalog? Bosses;
    [Export] public LevelCatalog? Levels;
    [Export] public UpgradeCatalog? Upgrades;
    [Export] public RoomBonusCatalog? RoomBonuses;

    public static GameCatalog Load()
    {
        if (ResourceLoader.Exists("res://Data/GameCatalog.tres"))
        {
            var catalog = ResourceLoader.Load<GameCatalog>("res://Data/GameCatalog.tres");
            if (catalog != null)
            {
                var errors = CatalogValidator.Validate(catalog);
                if (errors.Count > 0)
                {
                    GD.Print($"GameCatalog: loaded .tres has {errors.Count} validation errors, using fallback");
                    return BuildFallback();
                }
                return catalog;
            }
        }

        GD.Print("GameCatalog: res://Data/GameCatalog.tres not found, building in-memory fallback");
        return BuildFallback();
    }

    private static GameCatalog BuildFallback()
    {
        return new GameCatalog
        {
            Weapons = FallbackCatalogs.BuildWeapons(),
            Enemies = FallbackCatalogs.BuildEnemies(),
            Bosses = FallbackCatalogs.BuildBosses(),
            Levels = FallbackCatalogs.BuildLevels(),
            Upgrades = FallbackCatalogs.BuildUpgrades(),
            RoomBonuses = FallbackCatalogs.BuildRoomBonuses()
        };
    }
}
