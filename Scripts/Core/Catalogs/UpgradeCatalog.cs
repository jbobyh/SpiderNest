using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class UpgradeCatalog : Resource
{
    [Export] public Godot.Collections.Array<UpgradeDefinition> Regular = new();
    [Export] public Godot.Collections.Array<UpgradeDefinition> Cursed = new();
    [Export] public Godot.Collections.Array<UpgradeDefinition> Spatial = new();

    private Dictionary<string, UpgradeDefinition>? _byId;

    public UpgradeDefinition? GetById(string id)
    {
        if (_byId == null) BuildIndex();
        return _byId!.GetValueOrDefault(id);
    }

    public IReadOnlyList<UpgradeDefinition> GetByCategory(UpgradeCategory cat)
    {
        return cat switch
        {
            UpgradeCategory.Regular => Regular,
            UpgradeCategory.Cursed => Cursed,
            UpgradeCategory.Spatial => Spatial,
            _ => Regular
        };
    }

    private void BuildIndex()
    {
        _byId = new Dictionary<string, UpgradeDefinition>();
        foreach (var u in Regular) IndexItem(u);
        foreach (var u in Cursed) IndexItem(u);
        foreach (var u in Spatial) IndexItem(u);
    }

    private void IndexItem(UpgradeDefinition? u)
    {
        if (u != null && !string.IsNullOrEmpty(u.Id))
            _byId![u.Id] = u;
    }
}
