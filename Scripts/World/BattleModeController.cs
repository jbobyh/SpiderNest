using System;
using Godot;
using SpaceOrLife.Actors;
using SpaceOrLife.Combat;
using SpaceOrLife.Core;
using SpaceOrLife.Domain;
using SpaceOrLife.Presentation;
using SpaceOrLife.UI;

namespace SpaceOrLife.World;

public partial class BattleModeController : Node
{
    private GameSession? _session;
    private PlayModeController? _playMode;
    private EnemyManager? _enemyManager;
    private CameraController? _camera;
    private AudioSystem? _audio;
    private ChoiceOverlay? _choiceOverlay;
    private bool _choiceOverlayWired;
    private bool _bossMusicPlaying;

    public void Setup(
        GameSession session,
        PlayModeController playMode,
        EnemyManager enemyManager,
        CameraController camera)
    {
        _session = session;
        _playMode = playMode;
        _enemyManager = enemyManager;
        _camera = camera;
    }

    public void SetPresentation(AudioSystem audio, ChoiceOverlay choiceOverlay)
    {
        _audio = audio;
        _choiceOverlay = choiceOverlay;

        if (_choiceOverlay != null && !_choiceOverlayWired)
        {
            _choiceOverlay.ChoiceSelected += OnBossChoiceSelected;
            _choiceOverlayWired = true;
        }
    }

    public override void _ExitTree()
    {
        if (_choiceOverlay != null && _choiceOverlayWired)
        {
            _choiceOverlay.ChoiceSelected -= OnBossChoiceSelected;
            _choiceOverlayWired = false;
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_session == null || _playMode == null || _enemyManager == null) return;
        if (_session.Phase != GamePhase.Battle) return;

        var state = _session.CurrentLevel;
        if (state == null || state.Battle == null) return;

        if (!_bossMusicPlaying)
        {
            _audio?.PlayBossMusic();
            _bossMusicPlaying = true;
        }

        var dt = (float)delta;

        if (state.Battle.FreezeTimer > 0f)
            state.Battle.FreezeTimer -= dt;

        _enemyManager.ProcessPendingSpawns(state.Battle.PendingSpawns, dt);

        _playMode.TickShared(dt);

        if (_camera != null)
        {
            _camera.SetTransitionTarget(state.Battle.Zoom,
                new Vector2(state.Battle.CenterX, state.Battle.CenterY));
            _camera.Update(dt);
        }

        var won = state.Battle.PendingSpawns.Count == 0 && _enemyManager.ActiveEnemyCount == 0;
        if (won)
        {
            if (state.Battle.IsBossBattle)
            {
                if (state.PendingChoice != null && state.PendingChoice.Active)
                {
                    if (_choiceOverlay != null && !_choiceOverlay.IsActive)
                    {
                        _choiceOverlay.ShowChoices(
                            state.PendingChoice.Type,
                            state.PendingChoice.ChoiceIds,
                            _session.Catalog?.Upgrades,
                            _session.Catalog?.RoomBonuses);
                    }
                    return;
                }

                if (state.PendingChoice == null)
                {
                    _bossMusicPlaying = false;
                    _audio?.StopBossMusic();
                    _audio?.LevelComplete();
                    _session?.OnBattleWon();
                }
            }
            else
            {
                _bossMusicPlaying = false;
                _audio?.StopBossMusic();
                _session.OnBattleWon();
            }
        }
    }

    private void OnBossChoiceSelected(string choiceId)
    {
        if (_session == null) return;
        var state = _session.CurrentLevel;
        var progress = _session.Progress;
        if (state == null || progress == null) return;
        if (state.PendingChoice == null || !state.PendingChoice.Active) return;

        var upgradeCatalog = _session.Catalog?.Upgrades;
        if (upgradeCatalog == null) return;

        if (!string.IsNullOrEmpty(choiceId))
        {
            var idx = state.PendingChoice.ChoiceIds.IndexOf(choiceId);
            if (idx > 0)
            {
                state.PendingChoice.ChoiceIds.RemoveAt(idx);
                state.PendingChoice.ChoiceIds.Insert(0, choiceId);
            }
        }
        else
        {
            state.PendingChoice.ChoiceIds.Clear();
        }

        CollectibleSystem.ResolvePendingChoice(
            state, progress, upgradeCatalog, new System.Random());

        _audio?.UpgradeCollect();

        _bossMusicPlaying = false;
        _audio?.StopBossMusic();
        _audio?.LevelComplete();
        _session.OnBattleWon();
    }
}
