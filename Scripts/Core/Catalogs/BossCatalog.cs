using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class BossCatalog : Resource
{
    [Export] public Godot.Collections.Array<BossDefinition> Bosses = new();

    private Dictionary<int, BossDefinition>? _byLevel;

    public BossDefinition? GetByLevel(int level)
    {
        if (_byLevel == null) BuildIndex();
        return _byLevel!.GetValueOrDefault(level);
    }

    private void BuildIndex()
    {
        _byLevel = new Dictionary<int, BossDefinition>();
        foreach (var b in Bosses)
        {
            if (b != null)
                _byLevel[b.Level] = b;
        }
    }
}
