using System.Collections.Generic;

namespace SpaceOrLife.Combat;

public sealed class BulletPool
{
    private readonly Stack<Bullet> _pool = new();

    public Bullet Acquire(BulletSpawnData data)
    {
        var b = _pool.Count > 0 ? _pool.Pop() : new Bullet();
        b.Init(data);
        return b;
    }

    public void Release(Bullet b)
    {
        b.Reset();
        _pool.Push(b);
    }

    public void ReleaseAll(IEnumerable<Bullet> bullets)
    {
        foreach (var b in bullets)
            Release(b);
    }
}
