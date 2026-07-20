using System.Collections.Generic;

namespace SpaceOrLife.Domain;

public enum ChoiceType
{
    Upgrade,
    Spatial,
    Cursed,
    RoomBonus
}

public sealed class PendingChoice
{
    public ChoiceType Type;
    public ChestData? Chest;
    public RoomBonusAltarData? Altar;
    public List<string> ChoiceIds = new();
    public bool Active;
}
