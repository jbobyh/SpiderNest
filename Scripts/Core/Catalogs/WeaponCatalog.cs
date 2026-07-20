using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class WeaponCatalog : Resource
{
    [Export] public Godot.Collections.Array<WeaponDefinition> Weapons = new();

    private Dictionary<string, WeaponDefinition>? _byId;

    public WeaponDefinition? GetById(string id)
    {
        if (_byId == null) BuildIndex();
        return _byId!.GetValueOrDefault(id);
    }

    private void BuildIndex()
    {
        _byId = new Dictionary<string, WeaponDefinition>();
        foreach (var w in Weapons)
        {
            if (w != null && !string.IsNullOrEmpty(w.Id))
                _byId[w.Id] = w;
        }
    }
}
