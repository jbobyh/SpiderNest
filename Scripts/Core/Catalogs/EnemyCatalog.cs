using System.Collections.Generic;
using Godot;
using SpaceOrLife.Domain;

namespace SpaceOrLife.Core.Catalogs;

[GlobalClass]
public partial class EnemyCatalog : Resource
{
    [Export] public Godot.Collections.Array<EnemyDefinition> Enemies = new();

    private Dictionary<EnemyKind, EnemyDefinition>? _byKind;
    private Dictionary<string, EnemyDefinition>? _byId;

    public EnemyDefinition? GetByKind(EnemyKind kind)
    {
        if (_byKind == null) BuildIndex();
        return _byKind!.GetValueOrDefault(kind);
    }

    public EnemyDefinition? GetById(string id)
    {
        if (_byId == null) BuildIndex();
        return _byId!.GetValueOrDefault(id);
    }

    private void BuildIndex()
    {
        _byKind = new Dictionary<EnemyKind, EnemyDefinition>();
        _byId = new Dictionary<string, EnemyDefinition>();
        foreach (var e in Enemies)
        {
            if (e == null) continue;
            _byKind[e.Kind] = e;
            if (!string.IsNullOrEmpty(e.Id))
                _byId[e.Id] = e;
        }
    }
}
