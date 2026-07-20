using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class RoomBonusCatalog : Resource
{
    [Export] public Godot.Collections.Array<RoomBonusDefinition> Bonuses = new();

    private Dictionary<string, RoomBonusDefinition>? _byId;

    public RoomBonusDefinition? GetById(string id)
    {
        if (_byId == null) BuildIndex();
        return _byId!.GetValueOrDefault(id);
    }

    private void BuildIndex()
    {
        _byId = new Dictionary<string, RoomBonusDefinition>();
        foreach (var b in Bonuses)
        {
            if (b != null && !string.IsNullOrEmpty(b.Id))
                _byId[b.Id] = b;
        }
    }
}
