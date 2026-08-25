using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class RarityServiceTests
{
    private static List<RarityDefinition> Sample(params (int id, string name, double chance)[] rows) =>
        rows.Select(r => new RarityDefinition
        {
            Id = r.id,
            Name = r.name,
            Chance = r.chance,
            Multiplier = r.id
        }).OrderBy(r => r.Id).ToList();

    private static List<RarityDefinition> HighestFirst(IReadOnlyList<RarityDefinition> all) =>
        all.OrderByDescending(r => r.Id).ToList();

    /// <summary>RNG that returns fixed NextDouble values in sequence.</summary>
    private sealed class ScriptedRandom(params double[] values) : Random
    {
        private int _i;

        public override double NextDouble()
        {
            if (_i >= values.Length)
            {
                return 1.0;
            }

            return values[_i++];
        }
    }

    [Fact]
    public void PickFrom_AllChancesZero_ReturnsCommon()
    {
        var all = Sample((1, "Comum", 0), (2, "Incomum", 0), (4, "Raro", 0));
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0));
        Assert.Equal(1, picked.Id);
    }

    [Fact]
    public void PickFrom_OnlyUncommonAlways_ReturnsUncommon()
    {
        var all = Sample((1, "Comum", 0), (2, "Incomum", 1.0), (4, "Raro", 0));
        // Top-down hits Raro (skip 0), then Incomum with roll 0.5 < 1.0
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.5));
        Assert.Equal(2, picked.Id);
    }

    [Fact]
    public void PickFrom_HigherIdWinsWhenBothWouldSucceed()
    {
        var all = Sample((1, "Comum", 0), (2, "Incomum", 1.0), (4, "Raro", 1.0));
        // First checked is Raro (id 4); roll 0.1 < 1.0 → Raro, never rolls Incomum
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.1));
        Assert.Equal(4, picked.Id);
    }

    [Fact]
    public void PickFrom_HigherFails_LowerSucceeds()
    {
        var all = Sample((1, "Comum", 0), (2, "Incomum", 0.5), (4, "Raro", 0.1));
        // Raro: 0.5 >= 0.1 fail; Incomum: 0.2 < 0.5 succeed
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.5, 0.2));
        Assert.Equal(2, picked.Id);
    }

    [Fact]
    public void PickFrom_AllFail_FallsBackToCommon()
    {
        var all = Sample((1, "Comum", 0), (2, "Incomum", 0.2), (4, "Raro", 0.1));
        // Both fail (rolls >= chance)
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.5, 0.9));
        Assert.Equal(1, picked.Id);
    }

    [Fact]
    public void PickFrom_LuckZero_SameAsBaseChance()
    {
        var all = Sample((1, "Comum", 0), (4, "Raro", 0.1));
        // roll 0.05 < 0.1 → Raro with luck 0
        var picked = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.05), rarityLuck: 0);
        Assert.Equal(4, picked.Id);
    }

    [Fact]
    public void PickFrom_LuckBoostsChance_SucceedsWhereBaseWouldFail()
    {
        var all = Sample((1, "Comum", 0), (4, "Raro", 0.1));
        // Base chance 0.1; roll 0.15 would fail.
        // With luck 1: effective = 0.19 → 0.15 < 0.19 succeeds.
        var without = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.15), rarityLuck: 0);
        var withLuck = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.15), rarityLuck: 1);
        Assert.Equal(1, without.Id);
        Assert.Equal(4, withLuck.Id);
    }

    [Fact]
    public void PickFrom_ChanceMult_BoostsRareWithoutFixingId()
    {
        var all = Sample((1, "Comum", 0), (4, "Raro", 0.1));
        // roll 0.5 fails base 0.1; with mult 7 → chance 0.7 → succeeds
        var basePick = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.5), chanceMult: 1);
        var boosted = RarityService.PickFrom(HighestFirst(all), all, new ScriptedRandom(0.5), chanceMult: 7);
        Assert.Equal(1, basePick.Id);
        Assert.Equal(4, boosted.Id);
    }
}
