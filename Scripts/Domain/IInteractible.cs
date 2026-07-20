using Godot;

namespace SpaceOrLife.Domain;

public readonly struct BattleTriggerContext
{
    public readonly GameSessionRef Session;
    public readonly CellCoord TriggerCell;

    public BattleTriggerContext(GameSessionRef session, CellCoord triggerCell)
    {
        Session = session;
        TriggerCell = triggerCell;
    }
}

public interface IInteractible
{
    bool IsAvailable { get; }
    CellCoord Cell { get; }
    bool CanInteract(LevelState state, Vector2 playerPos);
    void Interact(BattleTriggerContext ctx);
}
