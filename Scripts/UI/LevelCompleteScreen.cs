using Godot;
using SpaceOrLife.Core;

namespace SpaceOrLife.UI;

public partial class LevelCompleteScreen : CanvasLayer
{
    private GameSession? _session;
    private Button? _nextButton;
    private Label? _titleLabel;
    private Label? _soulsLabel;

    public override void _Ready()
    {
        _session = GetNodeOrNull<GameSession>("/root/Main/GameSession");
        Visible = false;
        BuildLayout();
    }

    public override void _ExitTree()
    {
        if (_nextButton != null)
            _nextButton.Pressed -= OnNext;
    }

    private void BuildLayout()
    {
        var bg = new Panel();
        bg.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        bg.AddThemeStyleboxOverride("panel", new StyleBoxFlat
        {
            BgColor = new Color(0.02f, 0.04f, 0.02f, 0.8f)
        });
        AddChild(bg);

        var center = new CenterContainer();
        center.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        bg.AddChild(center);

        var vbox = new VBoxContainer();
        vbox.CustomMinimumSize = new Vector2(300, 200);
        center.AddChild(vbox);

        _titleLabel = new Label { Text = "Level Complete!" };
        _titleLabel.HorizontalAlignment = HorizontalAlignment.Center;
        _titleLabel.AddThemeFontSizeOverride("font_size", 26);
        _titleLabel.AddThemeColorOverride("font_color", new Color(0.3f, 1f, 0.3f));
        vbox.AddChild(_titleLabel);

        vbox.AddChild(new Control { CustomMinimumSize = new Vector2(0, 12) });

        _soulsLabel = new Label { Text = "Souls earned: 0" };
        _soulsLabel.HorizontalAlignment = HorizontalAlignment.Center;
        _soulsLabel.AddThemeFontSizeOverride("font_size", 14);
        vbox.AddChild(_soulsLabel);

        vbox.AddChild(new Control { CustomMinimumSize = new Vector2(0, 20) });

        _nextButton = new Button { Text = "Next Level" };
        _nextButton.CustomMinimumSize = new Vector2(200, 36);
        vbox.AddChild(_nextButton);

        _nextButton.Pressed += OnNext;
    }

    public void Show(int level, int souls)
    {
        if (_titleLabel != null)
            _titleLabel.Text = $"Level {level} Complete!";
        if (_soulsLabel != null)
            _soulsLabel.Text = $"Souls earned: {souls}";
        Visible = true;
    }

    public new void Hide()
    {
        Visible = false;
    }

    private void OnNext()
    {
        _session?.AdvanceLevel();
        Visible = false;
    }
}
