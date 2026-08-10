using System.Text.Json;
using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class MonsterDropHelperTests
{
    private static JsonElement El(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public void EffectiveChance_LuckZero_EqualsBase()
    {
        Assert.Equal(0.1, MonsterDropHelper.EffectiveChance(0.1, 0), 12);
        Assert.Equal(0, MonsterDropHelper.EffectiveChance(0, 5), 12);
    }

    [Fact]
    public void EffectiveChance_LuckRaisesChance()
    {
        var boosted = MonsterDropHelper.EffectiveChance(0.1, 1);
        Assert.True(boosted > 0.1);
        Assert.True(boosted < 1);
        // 1 - 0.9^2 = 0.19
        Assert.Equal(0.19, boosted, 12);
    }

    [Fact]
    public void TryReadSkyCoinDrop_Absent_ReturnsFalse()
    {
        Assert.False(MonsterDropHelper.TryReadSkyCoinDrop(El("""{"id":"rat"}"""), out _, out _));
    }

    [Fact]
    public void TryReadSkyCoinDrop_ValidRange()
    {
        Assert.True(MonsterDropHelper.TryReadSkyCoinDrop(
            El("""{"skyCoinDrop":[2,5]}"""), out var min, out var max));
        Assert.Equal(2, min);
        Assert.Equal(5, max);
    }

    [Fact]
    public void RollSkyCoinDrop_FixedRange_AlwaysSame()
    {
        var monster = El("""{"skyCoinDrop":[5,5]}""");
        var amount = MonsterDropHelper.RollSkyCoinDrop(monster, new Random(1), out var defined);
        Assert.True(defined);
        Assert.Equal(5, amount);
    }

    [Fact]
    public void RollSkyCoinDrop_Absent_ZeroUndefined()
    {
        var amount = MonsterDropHelper.RollSkyCoinDrop(El("""{"id":"x"}"""), new Random(1), out var defined);
        Assert.False(defined);
        Assert.Equal(0, amount);
    }

    [Fact]
    public void ReadRarityLuck_DefaultsToZero()
    {
        Assert.Equal(0, MonsterDropHelper.ReadRarityLuck(El("""{"id":"x"}""")));
        Assert.Equal(2.5, MonsterDropHelper.ReadRarityLuck(El("""{"rarityLuck":2.5}""")));
    }
}
