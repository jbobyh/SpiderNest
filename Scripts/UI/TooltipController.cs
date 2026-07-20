using System;
using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.UI;

public partial class TooltipController : Control
{
    private const float BoxWidth = 240f;
    private const float Pad = 10f;
    private const float LineGap = 6f;
    private const float StatGap = 3f;

    private CameraController? _camera;
    private Func<LevelState?>? _getLevel;
    private Func<WeaponCatalog?>? _getWeaponCatalog;
    private Func<bool>? _isPlayPhase;

    private FontFile? _font;
    private Panel? _panel;
    private Label? _label;
    private Label? _desc;
    private VBoxContainer? _statsContainer;

    private bool _show;

    public override void _Ready()
    {
        MouseFilter = MouseFilterEnum.Ignore;
        ZIndex = 60;

        _font = ResourceLoader.Load<FontFile>("res://Assets/Fonts/boldpixels.ttf");

        _panel = new Panel();
        var style = new StyleBoxFlat
        {
            BgColor = new Color(0.02f, 0.04f, 0.06f, 0.95f),
            BorderWidthLeft = 2,
            BorderWidthRight = 2,
            BorderWidthTop = 2,
            BorderWidthBottom = 2,
            ContentMarginLeft = Pad,
            ContentMarginRight = Pad,
            ContentMarginTop = Pad,
            ContentMarginBottom = Pad,
        };
        _panel.AddThemeStyleboxOverride("panel", style);
        _panel.CustomMinimumSize = new Vector2(BoxWidth, 40);
        _panel.Visible = false;
        AddChild(_panel);

        var vbox = new VBoxContainer();
        _panel.AddChild(vbox);

        _label = CreateLabel(14, Colors.White);
        vbox.AddChild(_label);

        _desc = CreateLabel(11, new Color(0.75f, 0.75f, 0.75f));
        _desc.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        _desc.CustomMinimumSize = new Vector2(BoxWidth - Pad * 2, 0);
        vbox.AddChild(_desc);

        _statsContainer = new VBoxContainer();
        vbox.AddChild(_statsContainer);
    }

    public void Setup(
        CameraController camera,
        Func<LevelState?> getLevel,
        Func<WeaponCatalog?> getWeaponCatalog,
        Func<bool> isPlayPhase)
    {
        _camera = camera;
        _getLevel = getLevel;
        _getWeaponCatalog = getWeaponCatalog;
        _isPlayPhase = isPlayPhase;
    }

    public override void _Process(double delta)
    {
        UpdateTooltip();
    }

    private void UpdateTooltip()
    {
        _show = false;

        if (_camera == null || _getLevel == null || _getWeaponCatalog == null || _isPlayPhase == null)
        {
            if (_panel != null) _panel.Visible = false;
            return;
        }

        if (!_isPlayPhase())
        {
            if (_panel != null) _panel.Visible = false;
            return;
        }

        var level = _getLevel();
        var weaponCatalog = _getWeaponCatalog();
        if (level == null || weaponCatalog == null)
        {
            if (_panel != null) _panel.Visible = false;
            return;
        }

        var mouseWorld = _camera.ScreenToWorld(GetGlobalMousePosition());
        var hoverR = GameConstants.CellPx * 0.2f;

        foreach (var dw in level.DroppedWeapons)
        {
            if (!IsRevealed(level, dw.Cell)) continue;

            var dist = mouseWorld.DistanceTo(dw.Position);
            if (dist < hoverR)
            {
                var def = weaponCatalog.GetById(dw.WeaponId);
                if (def != null)
                {
                    ShowTooltip(def);
                    PositionNearMouse();
                    _show = true;
                    break;
                }
            }
        }

        if (_panel != null)
            _panel.Visible = _show;
    }

    private static bool IsRevealed(LevelState state, CellCoord cell)
    {
        return state.EverRevealedCells.Contains(cell);
    }

    private void ShowTooltip(WeaponDefinition def)
    {
        if (_label == null || _desc == null || _statsContainer == null || _panel == null) return;

        _label.Text = def.Label;
        _desc.Text = def.Description;

        var style = new StyleBoxFlat
        {
            BgColor = new Color(0.02f, 0.04f, 0.06f, 0.95f),
            BorderWidthLeft = 2,
            BorderWidthRight = 2,
            BorderWidthTop = 2,
            BorderWidthBottom = 2,
            BorderColor = def.Color,
            ContentMarginLeft = Pad,
            ContentMarginRight = Pad,
            ContentMarginTop = Pad,
            ContentMarginBottom = Pad,
        };
        _panel.AddThemeStyleboxOverride("panel", style);

        foreach (var child in _statsContainer.GetChildren())
            child.QueueFree();

        var stats = BuildWeaponStats(def);
        foreach (var (statLabel, statValue) in stats)
        {
            var row = new HBoxContainer();
            row.CustomMinimumSize = new Vector2(BoxWidth - Pad * 2, 0);

            var lbl = CreateLabel(10, new Color(0.6f, 0.6f, 0.6f));
            lbl.Text = statLabel;
            row.AddChild(lbl);

            var val = CreateLabel(10, Colors.White);
            val.Text = statValue;
            val.HorizontalAlignment = HorizontalAlignment.Right;
            val.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            row.AddChild(val);

            _statsContainer.AddChild(row);
        }
    }

    private void PositionNearMouse()
    {
        if (_panel == null) return;

        var mousePos = GetGlobalMousePosition();
        var screenW = (float)DisplayServer.WindowGetSize().X;
        var screenH = (float)DisplayServer.WindowGetSize().Y;

        var boxW = BoxWidth;
        var boxH = _panel.GetMinimumSize().Y;

        var tx = mousePos.X + 24f;
        var ty = mousePos.Y - boxH * 0.5f;

        if (tx + boxW > screenW - 4f)
            tx = mousePos.X - boxW - 24f;
        if (ty < 4f)
            ty = 4f;
        if (ty + boxH > screenH - 4f)
            ty = screenH - 4f - boxH;

        _panel.Position = new Vector2(tx, ty);
    }

    private Label CreateLabel(int fontSize, Color color)
    {
        var label = new Label();
        if (_font != null)
            label.AddThemeFontOverride("font", _font);
        label.AddThemeFontSizeOverride("font_size", fontSize);
        label.AddThemeColorOverride("font_color", color);
        return label;
    }

    private static List<(string, string)> BuildWeaponStats(WeaponDefinition def)
    {
        var stats = new List<(string, string)>
        {
            ("Damage", def.Damage.ToString("F0")),
            ("Pellets", def.Pellets.ToString()),
            ("Spread", $"{Mathf.RoundToInt(def.Spread * 180f / Mathf.Pi)}°"),
            ("Bullet Speed", def.BulletSpeed.ToString("F0")),
            ("Range", $"{def.Range} cells"),
            ("Penetrate", def.Penetrate.ToString()),
            ("Magazine", def.MagazineSize.ToString()),
            ("Reload", $"{def.ReloadTime:F1}s"),
        };

        if (def.BurstSize > 1)
            stats.Add(("Burst", def.BurstSize.ToString()));

        return stats;
    }
}
