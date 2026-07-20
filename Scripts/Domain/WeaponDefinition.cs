using Godot;

namespace SpaceOrLife.Domain;

[GlobalClass]
public partial class WeaponDefinition : Resource
{
    [Export] public string Id = "";
    [Export] public string Label = "";
    [Export] public string Description = "";
    [Export] public Color Color = Colors.White;

    [ExportGroup("Combat")]
    [Export(PropertyHint.Range, "0,1000,0.1")] public float Damage = 20f;
    [Export(PropertyHint.Range, "0,5,0.01")] public float Cooldown = 0.2f;
    [Export(PropertyHint.Range, "0,10,0.01")] public float ReloadTime = 1.5f;
    [Export(PropertyHint.Range, "0,2000,1")] public float BulletSpeed = 400f;
    [Export(PropertyHint.Range, "0,100,0.1")] public float Range = 13f;
    [Export] public int Pellets = 1;
    [Export] public int Penetrate = 0;
    [Export] public int MagazineSize = 12;
    [Export(PropertyHint.Range, "0,2,0.01")] public float Spread = 0.05f;
    [Export(PropertyHint.Range, "0,2,0.01")] public float MaxSpread = 0.8f;
    [Export(PropertyHint.Range, "0,2,0.01")] public float BloomPerShot = 0.08f;
    [Export(PropertyHint.Range, "0,5,0.01")] public float BloomRecoveryTime = 0.4f;
    [Export(PropertyHint.Range, "0,2,0.01")] public float ShakeAmount = 0f;

    [ExportGroup("Burst")]
    [Export] public int BurstSize = 1;
    [Export(PropertyHint.Range, "0,5,0.01")] public float BurstDuration = 0f;

    [ExportGroup("Render")]
    [Export] public float SpriteAngle = 0f;
    [Export] public float SpriteScale = 0.5f;
    [Export] public float SpriteOffset = 0.4f;
    [Export] public float SpritePivotY = 0f;
    [Export] public int SpriteWidth = 64;
    [Export] public int ReloadSpriteWidth = 64;
    [Export(PropertyHint.Range, "0,1,0.01")] public float ReloadAnchorX = 0.5f;
    [Export(PropertyHint.Range, "0,1,0.01")] public float ReloadAnchorY = 0.5f;
    [Export] public Vector2 GripLeft = Vector2.Zero;
    [Export] public Vector2 GripRight = Vector2.Zero;
    [Export(PropertyHint.Range, "0,1,0.01")] public float FlipThreshold = 0.10f;
    [Export(PropertyHint.Range, "0,1,0.01")] public float ShootAnimRatio = 0.3f;
    [Export(PropertyHint.Range, "0,1,0.01")] public float ReloadAnimRatio = 1.0f;

    public bool IsBurst => BurstSize > 1;
}
