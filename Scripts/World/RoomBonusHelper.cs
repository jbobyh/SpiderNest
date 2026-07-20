using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;

namespace SpaceOrLife.World;

public static class RoomBonusHelper
{
    public static string? GetRoomBonus(LevelState level, CellCoord cell)
    {
        if (!level.CellToRoom.TryGetValue(cell, out var roomIdx))
            return null;

        for (int i = 0; i < level.RoomBonuses.Count; i++)
        {
            if (level.RoomBonuses[i].RoomIdx == roomIdx)
                return level.RoomBonuses[i].BonusType;
        }

        return null;
    }

    public static bool IsWindBonus(string? bonus)
    {
        return bonus == "wind_east" || bonus == "wind_west" ||
               bonus == "wind_north" || bonus == "wind_south";
    }

    public static float GetRoomSpeedScalar(LevelState level, RoomBonusCatalog catalog, CellCoord cell)
    {
        var bonus = GetRoomBonus(level, cell);
        if (bonus == null)
            return 1f;

        if (bonus == "speeddown")
        {
            var def = catalog.GetById(bonus);
            return def?.SpeedMult ?? 0.5f;
        }

        return 1f;
    }

    public static float GetRoomSpeedVectorMult(LevelState level, RoomBonusCatalog catalog, CellCoord cell, Vector2 dir)
    {
        var bonus = GetRoomBonus(level, cell);
        if (bonus == null)
            return 1f;

        if (bonus == "speeddown")
        {
            var def = catalog.GetById(bonus);
            return def?.SpeedMult ?? 0.5f;
        }

        if (!IsWindBonus(bonus))
            return 1f;

        var len = dir.Length();
        if (len < 1e-9f)
            return 1f;

        var def2 = catalog.GetById(bonus);
        if (def2 == null || def2.WindDir == Vector2.Zero)
            return 1f;

        var nd = dir / len;
        var dot = nd.X * def2.WindDir.X + nd.Y * def2.WindDir.Y;
        var strength = def2.WindStrength != 0f ? def2.WindStrength : 0.5f;
        return 1f + strength * dot;
    }
}
