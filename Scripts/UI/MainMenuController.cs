using Godot;
using SpaceOrLife.Core;

namespace SpaceOrLife.UI;

public partial class MainMenuController : CanvasLayer
{
    private Button? _newGameButton;
    private Button? _continueButton;
    private GameSession? _session;

    public override void _Ready()
    {
        _newGameButton = GetNode<Button>("%NewGameButton");
        _continueButton = GetNode<Button>("%ContinueButton");
        _session = GetNode<GameSession>("/root/Main/GameSession");

        _newGameButton.Pressed += OnNewGame;
        _continueButton.Pressed += OnContinue;

        _continueButton.Visible = _session.SaveManager.HasSave();
    }

    public override void _ExitTree()
    {
        if (_newGameButton != null)
            _newGameButton.Pressed -= OnNewGame;
        if (_continueButton != null)
            _continueButton.Pressed -= OnContinue;
    }

    private void OnNewGame()
    {
        _session?.StartNewGame();
        Visible = false;
    }

    private void OnContinue()
    {
        _session?.ContinueGame();
        Visible = false;
    }
}
