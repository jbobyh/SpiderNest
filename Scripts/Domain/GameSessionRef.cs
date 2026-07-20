using Godot;

namespace SpaceOrLife.Domain;

public sealed class GameSessionRef
{
    public Godot.Node Session;
    public GameSessionRef(Godot.Node session) => Session = session;

    public void RequestBattle(CellCoord cell)
    {
        Session.Call("RequestBattle", cell.X, cell.Y);
    }

    public void RequestBossBattle()
    {
        Session.Call("RequestBossBattle");
    }
}
