using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class ItemRollServiceTests
{
    [Theory]
    [InlineData(10, 1, 11)]
    [InlineData(10, 2, 12)]
    [InlineData(10, 5, 15)]
    [InlineData(10, 10, 20)]
    public void ApplyFloorLevel_Adds_Base_Times_Level_Over_Ten(double bas, int lv, double expected)
    {
        Assert.Equal(expected, ItemRollService.ApplyFloorLevel(bas, lv));
    }

    [Theory]
    // leveled(9,1)=9.9; × (5+99)=9.9×104=1029.6
    [InlineData(9, 5, 99, 1, 1029.6)]
    // leveled(3,1)=3.3; × (1+1)=6.6
    [InlineData(3, 1, 1, 1, 6.6)]
    // leveled(10,10)=20; × (3+0)=60
    [InlineData(10, 3, 0, 10, 60)]
    public void BakeStat_Floor_Then_Stars_Plus_Multiplier(
        double bas,
        int stars,
        double mult,
        int itemLevel,
        double expected)
    {
        Assert.Equal(expected, ItemRollService.BakeStat(bas, stars, mult, itemLevel), precision: 10);
    }

    [Fact]
    public void PickStars_Respects_Weights_Range()
    {
        var rng = new Random(42);
        for (var i = 0; i < 200; i++)
        {
            var stars = ItemRollService.PickStars(rng);
            Assert.InRange(stars, 1, 5);
        }
    }
}
