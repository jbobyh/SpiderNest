using Godot;
using SpaceOrLife.Core;

namespace SpaceOrLife.UI;

public partial class DeathScreen : CanvasLayer
{
    private GameSession? _session;
    private Button? _restartButton;
    private Button? _menuButton;

    public override void _Ready()
    {
        _session = GetNodeOrNull<GameSession>("/root/Main/GameSession");
        Visible = false;
        BuildLayout();
    }

    public override void _ExitTree()
    {
        if (_restartButton != null)
            _restartButton.Pressed -= OnRestart;
        if (_menuButton != null)
            _menuButton.Pressed -= OnMenu;
    }

    private void BuildLayout()
    {
        var bg = new Panel();
        bg.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        bg.AddThemeStyleboxOverride("panel", new StyleBoxFlat
        {
            BgColor = new Color(0.02f, 0.01f, 0.04f, 0.8f)
        });
        AddChild(bg);

        var center = new CenterContainer();
        center.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        bg.AddChild(center);

        var vbox = new VBoxContainer();
        vbox.CustomMinimumSize = new Vector2(300, 200);
        center.AddChild(vbox);

        var title = new Label { Text = "Game Over" };
        title.HorizontalAlignment = HorizontalAlignment.Center;
        title.AddThemeFontSizeOverride("font_size", 28);
        title.AddThemeColorOverride("font_color", new Color(1f, 0.2f, 0.2f));
        vbox.AddChild(title);

        vbox.AddChild(new Control { CustomMinimumSize = new Vector2(0, 20) });

        _restartButton = new Button { Text = "Restart" };
        _restartButton.CustomMinimumSize = new Vector2(200, 36);
        vbox.AddChild(_restartButton);

        vbox.AddChild(new Control { CustomMinimumSize = new Vector2(0, 8) });

        _menuButton = new Button { Text = "Main Menu" };
        _menuButton.CustomMinimumSize = new Vector2(200, 36);
        vbox.AddChild(_menuButton);

        _restartButton.Pressed += OnRestart;
        _menuButton.Pressed += OnMenu;
    }

    public void ShowDeath()
    {
        Visible = true;
    }

    public void HideDeath()
    {
        Visible = false;
    }

    private void OnRestart()
    {
        _session?.RestartLevel();
        Visible = false;
    }

    private void OnMenu()
    {
        var menu = GetNodeOrNull<MainMenuController>("/root/Main/Menus/MainMenu");
        menu?.Show();
        Visible = false;
    }
}
