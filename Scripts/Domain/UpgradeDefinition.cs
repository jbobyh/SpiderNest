using Godot;

namespace SpaceOrLife.Domain;

[GlobalClass]
public partial class UpgradeDefinition : Resource
{
    [Export] public string Id = "";
    [Export] public UpgradeCategory Category = UpgradeCategory.Regular;
    [Export] public string Label = "";
    [Export] public string Description = "";
    [Export] public Color Color = Colors.White;
    [Export] public string Icon = "";
    [Export] public int Max = 1;

    [ExportGroup("Spatial")]
    [Export] public SpatialAxis Axis = SpatialAxis.Reload;
    [Export] public SpatialSource Source = SpatialSource.Rooms;
    [Export] public string Blocks = "";

    [ExportGroup("Effects")]
    [Export] public Godot.Collections.Dictionary<string, Variant> Effects = new();

    [ExportGroup("Custom Logic")]
    [Export] public string OnApplyId = "";
}
