using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class LevelCatalog : Resource
{
    [Export] public Godot.Collections.Array<LevelDefinition> Levels = new();

    private Dictionary<int, LevelDefinition>? _byLevel;

    public LevelDefinition? GetByLevel(int level)
    {
        if (_byLevel == null) BuildIndex();
        return _byLevel!.GetValueOrDefault(level);
    }

    private void BuildIndex()
    {
        _byLevel = new Dictionary<int, LevelDefinition>();
        foreach (var l in Levels)
        {
            if (l != null)
                _byLevel[l.Level] = l;
        }
    }
}
