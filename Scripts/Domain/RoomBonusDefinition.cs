using Godot;

namespace SpaceOrLife.Domain;

[GlobalClass]
public partial class RoomBonusDefinition : Resource
{
    [Export] public string Id = "";
    [Export] public string Label = "";
    [Export] public string Description = "";
    [Export] public Color Color = Colors.White;
    [Export] public string Icon = "";
    [Export] public int Max = 100;

    [ExportGroup("Wind")]
    [Export] public Vector2 WindDir = Vector2.Zero;
    [Export] public float WindStrength = 0.5f;

    [ExportGroup("Speed")]
    [Export] public float SpeedMult = 1f;

    public bool IsWind => WindDir != Vector2.Zero;
}
