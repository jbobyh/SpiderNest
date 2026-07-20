using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.Domain;

public sealed class SeededRng
{
    private readonly RandomNumberGenerator _rng = new();

    public SeededRng(ulong seed)
    {
        _rng.Seed = seed;
    }

    public ulong Seed => _rng.Seed;

    public int NextInt(int maxExclusive) => _rng.RandiRange(0, maxExclusive - 1);
    public int NextIntRange(int minInclusive, int maxInclusive) => _rng.RandiRange(minInclusive, maxInclusive);
    public float NextFloat() => _rng.Randf();
    public float NextFloatRange(float min, float max) => _rng.RandfRange(min, max);

    public void Shuffle<T>(List<T> list)
    {
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = NextInt(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    public T Pick<T>(IReadOnlyList<T> list) => list[NextInt(list.Count)];
}
