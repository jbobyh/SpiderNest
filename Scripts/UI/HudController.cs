using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;
using SpaceOrLife.World;

namespace SpaceOrLife.UI;

public partial class HudController : CanvasLayer
{
    private GameSession? _session;
    private FontFile? _font;

    private Label? _levelLabel;
    private HBoxContainer? _heartsRow;
    private HBoxContainer? _shieldsRow;
    private Label? _soulsLabel;
    private VBoxContainer? _upgradePanel;
    private HBoxContainer? _weaponSlots;
    private Label? _fpsLabel;
    private Label _interactionPrompt = new();
    private Label _bossSummonHint = new();
    private ProgressBar? _bossHpBar;
    private Panel? _statsPanel;
    private bool _statsVisible;
    private bool _fpsVisible;

    private static readonly Color PanelBg = new(0.08f, 0.06f, 0.12f, 0.85f);
    private static readonly Color TextColor = Colors.White;
    private static readonly Color HeartColor = new(1f, 0.2f, 0.3f);
    private static readonly Color ShieldColor = new(0.3f, 0.8f, 1f);
    private static readonly Color SoulsColor = new(0.7f, 0.55f, 1f);
    private static readonly Color ActiveSlotColor = new(1f, 0.85f, 0.2f);

    private static readonly Texture2D? HeartTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/heart.png");
    private static readonly Texture2D? ShieldTex = ResourceLoader.Load<Texture2D>("res://Assets/Sprites/Hud/shield.png");

    private static Texture2D? LoadWeaponIcon(string weaponId)
    {
        var path = weaponId switch
        {
            "pistol" => "res://Assets/Sprites/Hud/pistol.png",
            "shotgun" => "res://Assets/Sprites/Hud/shotgun.png",
            "smg" => "res://Assets/Sprites/Hud/smg.png",
            "rifle" => "res://Assets/Sprites/Hud/rifle.png",
            "revolver" => "res://Assets/Sprites/Hud/revolver.png",
            _ => null,
        };
        if (string.IsNullOrEmpty(path))
            return null;
        return ResourceLoader.Load<Texture2D>(path);
    }

    public override void _Ready()
    {
        _session = GetNodeOrNull<GameSession>("/root/Main/GameSession");
        _font = ResourceLoader.Load<FontFile>("res://Assets/Fonts/boldpixels.ttf");

        BuildLayout();
    }

    public override void _Process(double delta)
    {
        if (_session == null) return;
        var state = _session.CurrentLevel;
        var progress = _session.Progress;
        if (progress == null) return;

        if (_levelLabel != null && state != null)
            _levelLabel.Text = $"Level {state.Level}";

        UpdateHearts(progress, state);
        UpdateShields(progress);
        UpdateSouls(progress);
        UpdateWeaponSlots(progress);
        UpdateUpgrades(progress);
        UpdateBossHp(state);
        UpdateInteractionPrompt(state, progress);
        UpdateFps();
        UpdateStatsPanel(progress);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventKey key && key.Pressed && !key.Echo)
        {
            if (key.Keycode == Key.F3)
            {
                _fpsVisible = !_fpsVisible;
                if (_fpsLabel != null) _fpsLabel.Visible = _fpsVisible;
            }
        }
    }

    private void BuildLayout()
    {
        _levelLabel = CreateLabel("Level 1", 18);
        _levelLabel.Position = new Vector2(8, 8);
        AddChild(_levelLabel);

        _heartsRow = new HBoxContainer();
        _heartsRow.Position = new Vector2(8, 32);
        AddChild(_heartsRow);

        _shieldsRow = new HBoxContainer();
        _shieldsRow.Position = new Vector2(8, 52);
        AddChild(_shieldsRow);

        _soulsLabel = CreateLabel("Souls: 0", 14, SoulsColor);
        _soulsLabel.Position = new Vector2(8, 74);
        AddChild(_soulsLabel);

        _upgradePanel = new VBoxContainer();
        _upgradePanel.Position = new Vector2(
            (float)DisplayServer.WindowGetSize().X - 200, 8);
        AddChild(_upgradePanel);

        _weaponSlots = new HBoxContainer();
        var screenH = (float)DisplayServer.WindowGetSize().Y;
        _weaponSlots.Position = new Vector2(8, screenH - 50);
        AddChild(_weaponSlots);

        _fpsLabel = CreateLabel("FPS: 0", 12);
        var screenW = (float)DisplayServer.WindowGetSize().X;
        _fpsLabel.Position = new Vector2(screenW - 80, screenH - 20);
        _fpsLabel.Visible = false;
        AddChild(_fpsLabel);

        _interactionPrompt = CreateLabel("Press F", 14, ActiveSlotColor);
        _interactionPrompt.HorizontalAlignment = HorizontalAlignment.Center;
        _interactionPrompt.Position = new Vector2(screenW * 0.5f - 50, screenH - 60);
        _interactionPrompt.Visible = false;
        AddChild(_interactionPrompt);

        _bossSummonHint = CreateLabel("Press SPACE to summon boss", 14, new Color(1f, 0.5f, 0.2f));
        _bossSummonHint.HorizontalAlignment = HorizontalAlignment.Center;
        _bossSummonHint.Position = new Vector2(screenW * 0.5f - 120, screenH - 80);
        _bossSummonHint.Visible = false;
        AddChild(_bossSummonHint);

        _bossHpBar = new ProgressBar
        {
            MinValue = 0,
            MaxValue = 1,
            Value = 1,
            CustomMinimumSize = new Vector2(300, 16),
            Position = new Vector2(screenW * 0.5f - 150, 8),
            Visible = false
        };
        AddChild(_bossHpBar);

        _statsPanel = new Panel
        {
            CustomMinimumSize = new Vector2(280, 300),
            Position = new Vector2(screenW * 0.5f - 140, 40),
            Visible = false
        };
        AddChild(_statsPanel);

        var statsVBox = new VBoxContainer();
        statsVBox.Position = new Vector2(8, 8);
        statsVBox.CustomMinimumSize = new Vector2(264, 284);
        _statsPanel.AddChild(statsVBox);

        var statsTitle = CreateLabel("Stats", 16);
        statsVBox.AddChild(statsTitle);
        _statsLabelsContainer = statsVBox;
    }

    private VBoxContainer? _statsLabelsContainer;

    private Label CreateLabel(string text, int fontSize, Color? color = null)
    {
        var label = new Label { Text = text };
        if (_font != null)
            label.AddThemeFontOverride("font", _font);
        label.AddThemeFontSizeOverride("font_size", fontSize);
        label.AddThemeColorOverride("font_color", color ?? TextColor);
        return label;
    }

    private void UpdateHearts(PlayerProgress progress, LevelState? state)
    {
        if (_heartsRow == null) return;
        var count = _heartsRow.GetChildCount();
        var needed = progress.Lives + (state?.PlayerRemovedWalls ?? 0);
        if (count != needed)
        {
            foreach (var child in _heartsRow.GetChildren())
                child.QueueFree();
            for (int i = 0; i < needed; i++)
            {
                if (HeartTex != null)
                {
                    var rect = new TextureRect
                    {
                        Texture = HeartTex,
                        CustomMinimumSize = new Vector2(16, 16),
                        ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
                        StretchMode = TextureRect.StretchModeEnum.KeepAspect
                    };
                    _heartsRow.AddChild(rect);
                }
                else
                {
                    var rect = new ColorRect
                    {
                        CustomMinimumSize = new Vector2(14, 14),
                        Color = HeartColor
                    };
                    _heartsRow.AddChild(rect);
                }
            }
        }

        for (int i = 0; i < _heartsRow.GetChildCount(); i++)
        {
            var child = _heartsRow.GetChild(i);
            var filled = i < progress.Lives;
            if (child is TextureRect texRect)
                texRect.Modulate = filled ? Colors.White : new Color(0.3f, 0.3f, 0.3f);
            else if (child is ColorRect rect)
                rect.Color = filled ? HeartColor : HeartColor.Darkened(0.6f);
        }
    }

    private void UpdateShields(PlayerProgress progress)
    {
        if (_shieldsRow == null) return;
        var shieldCount = progress.Upgrades.Shield;
        var count = _shieldsRow.GetChildCount();
        if (count != shieldCount)
        {
            foreach (var child in _shieldsRow.GetChildren())
                child.QueueFree();
            for (int i = 0; i < shieldCount; i++)
            {
                if (ShieldTex != null)
                {
                    var rect = new TextureRect
                    {
                        Texture = ShieldTex,
                        CustomMinimumSize = new Vector2(14, 14),
                        ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
                        StretchMode = TextureRect.StretchModeEnum.KeepAspect
                    };
                    _shieldsRow.AddChild(rect);
                }
                else
                {
                    var rect = new ColorRect
                    {
                        CustomMinimumSize = new Vector2(12, 12),
                        Color = ShieldColor
                    };
                    _shieldsRow.AddChild(rect);
                }
            }
        }
    }

    private void UpdateSouls(PlayerProgress progress)
    {
        if (_soulsLabel != null)
            _soulsLabel.Text = $"Souls: {progress.Souls}";
    }

    private void UpdateWeaponSlots(PlayerProgress progress)
    {
        if (_weaponSlots == null) return;
        var catalog = _session?.Catalog?.Weapons;
        if (catalog == null) return;

        var count = _weaponSlots.GetChildCount();
        if (count != progress.MaxSlots)
        {
            foreach (var child in _weaponSlots.GetChildren())
                child.QueueFree();
            for (int i = 0; i < progress.MaxSlots; i++)
            {
                var slotPanel = new Panel
                {
                    CustomMinimumSize = new Vector2(90, 40)
                };
                slotPanel.AddThemeStyleboxOverride("panel", new StyleBoxFlat
                {
                    BgColor = PanelBg,
                    BorderWidthLeft = 2,
                    BorderWidthRight = 2,
                    BorderWidthTop = 2,
                    BorderWidthBottom = 2
                });

                var slotLabel = CreateLabel("", 11);
                slotLabel.Position = new Vector2(28, 4);
                slotLabel.CustomMinimumSize = new Vector2(58, 32);
                slotPanel.AddChild(slotLabel);

                _weaponSlots.AddChild(slotPanel);
            }
        }

        for (int i = 0; i < _weaponSlots.GetChildCount() && i < progress.WeaponSlots.Count; i++)
        {
            if (_weaponSlots.GetChild(i) is Panel panel)
            {
                var label = panel.GetChildOrNull<Label>(0);
                if (label == null) continue;

                var wId = progress.WeaponSlots[i];
                var isActive = i == progress.ActiveSlot;

                if (string.IsNullOrEmpty(wId))
                {
                    label.Text = "Empty";
                    RemoveWeaponIcon(panel);
                }
                else
                {
                    var wDef = catalog.GetById(wId);
                    if (wDef != null)
                    {
                        var ammo = i < progress.Ammo.Count ? progress.Ammo[i] : 0;
                        label.Text = $"{wDef.Label}\n{ammo}/{wDef.MagazineSize}";
                        UpdateWeaponIcon(panel, wId);
                    }
                }

                var sb = new StyleBoxFlat
                {
                    BgColor = PanelBg,
                    BorderWidthLeft = 2,
                    BorderWidthRight = 2,
                    BorderWidthTop = 2,
                    BorderWidthBottom = 2,
                    BorderColor = isActive ? ActiveSlotColor : new Color(0.3f, 0.3f, 0.3f)
                };
                panel.AddThemeStyleboxOverride("panel", sb);
            }
        }
    }

    private static void UpdateWeaponIcon(Panel panel, string weaponId)
    {
        var existing = panel.GetChildOrNull<TextureRect>(1);
        var tex = LoadWeaponIcon(weaponId);
        if (tex == null)
        {
            if (existing != null)
                existing.Visible = false;
            return;
        }

        if (existing == null)
        {
            existing = new TextureRect
            {
                ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
                StretchMode = TextureRect.StretchModeEnum.KeepAspect
            };
            existing.Position = new Vector2(4, 6);
            existing.CustomMinimumSize = new Vector2(20, 28);
            panel.AddChild(existing);
        }

        existing.Texture = tex;
        existing.Visible = true;
    }

    private static void RemoveWeaponIcon(Panel panel)
    {
        var existing = panel.GetChildOrNull<TextureRect>(1);
        if (existing != null)
            existing.Visible = false;
    }

    private void UpdateUpgrades(PlayerProgress progress)
    {
        if (_upgradePanel == null) return;
        var catalog = _session?.Catalog?.Upgrades;
        if (catalog == null) return;

        var children = _upgradePanel.GetChildren();
        if (children.Count != progress.UpgradeLevels.Count)
        {
            foreach (var child in children)
                child.QueueFree();

            foreach (var (id, level) in progress.UpgradeLevels)
            {
                if (level <= 0) continue;
                var def = catalog.GetById(id);
                if (def == null) continue;

                var row = new HBoxContainer();
                var iconRect = new ColorRect
                {
                    CustomMinimumSize = new Vector2(12, 12),
                    Color = def.Color
                };
                row.AddChild(iconRect);

                var nameLabel = CreateLabel(def.Label, 10);
                row.AddChild(nameLabel);

                var lvlLabel = CreateLabel($" x{level}", 10, ActiveSlotColor);
                row.AddChild(lvlLabel);

                _upgradePanel.AddChild(row);
            }
        }
    }

    private void UpdateBossHp(LevelState? state)
    {
        if (_bossHpBar == null) return;
        if (state?.Battle == null || !state.Battle.IsBossBattle)
        {
            _bossHpBar.Visible = false;
            return;
        }

        var player = _session?.Player;
        if (player == null) return;

        var enemies = _session?.GetNodeOrNull<SpaceOrLife.Actors.EnemyManager>("/root/Main/World/EnemyManager");
        if (enemies == null) return;

        SpaceOrLife.Actors.EnemyActor? boss = null;
        foreach (var e in enemies.Enemies)
        {
            if (GodotObject.IsInstanceValid(e) && e.IsBoss && !e.IsDead)
            {
                boss = e;
                break;
            }
        }

        if (boss == null)
        {
            _bossHpBar.Visible = false;
            return;
        }

        _bossHpBar.Visible = true;
        _bossHpBar.MaxValue = boss.MaxHp;
        _bossHpBar.Value = boss.Hp;
    }

    private void UpdateInteractionPrompt(LevelState? state, PlayerProgress progress)
    {
        if (state == null || _session?.Player == null) return;
        var near = CollectibleSystem.IsNearAnyInteractible(state, _session.Player.GlobalPosition);
        _interactionPrompt.Visible = near;

        _bossSummonHint.Visible = state.BossSummonReady && !state.BossDefeated;
    }

    private void UpdateFps()
    {
        if (_fpsLabel != null && _fpsVisible)
            _fpsLabel.Text = $"FPS: {Engine.GetFramesPerSecond()}";
    }

    private void UpdateStatsPanel(PlayerProgress progress)
    {
        if (_statsPanel == null) return;
        var statsPressed = Input.IsActionPressed("stats");
        if (statsPressed != _statsVisible)
        {
            _statsVisible = statsPressed;
            _statsPanel.Visible = _statsVisible;
        }

        if (!_statsVisible || _statsLabelsContainer == null) return;

        var upg = progress.Upgrades;
        var lines = new[]
        {
            $"Damage: +{upg.DamageMult * 100:F0}%",
            $"Cooldown: x{upg.CooldownMult:F2}",
            $"Speed: x{upg.SpeedMult:F2}",
            $"Spread: x{upg.SpreadMult:F2}",
            $"Bullet Speed: x{upg.BulletSpeedMult:F2}",
            $"Crit Chance: {upg.CritChance * 100:F0}%",
            $"Crit Damage: +{upg.CritDamage * 100:F0}%",
            $"Penetrate: +{upg.Penetrate}",
            $"Shield: {upg.Shield}",
            $"Incendiary: {upg.IncendiaryChance * 100:F0}%",
            $"Freeze: {upg.FreezeChance * 100:F0}%",
            $"Extra Bullet: {upg.ExtraBulletChance * 100:F0}%",
            $"Bloom Reduction: {upg.BloomReduction * 100:F0}%",
            $"Retreat: {upg.Retreat:F1}s",
            $"Kill Accel: {(upg.KillAccel ? (upg.KillAccelPercent * 100).ToString("F0") + "%" : "No")}",
            $"Ricochet: {(upg.Ricochet ? "Yes" : "No")}",
            $"Infinite Penetrate: {(upg.InfinitePenetrate ? "Yes" : "No")}",
            $"Infinite Range: {(upg.InfiniteRange ? "Yes" : "No")}",
            $"Last Life: {(upg.LastLife ? "Yes" : "No")}",
            $"Sniper: {(upg.Sniper ? "Yes" : "No")}",
            $"Long Range: {(upg.LongRange ? "Yes" : "No")}"
        };

        var existing = _statsLabelsContainer.GetChildren();
        if (existing.Count != lines.Length + 1)
        {
            foreach (var child in existing)
                child.QueueFree();
            var title = CreateLabel("Stats", 16);
            _statsLabelsContainer.AddChild(title);
            foreach (var line in lines)
            {
                var label = CreateLabel(line, 11);
                _statsLabelsContainer.AddChild(label);
            }
        }
        else
        {
            for (int i = 0; i < lines.Length; i++)
            {
                if (_statsLabelsContainer.GetChild(i + 1) is Label label)
                    label.Text = lines[i];
            }
        }
    }
}
