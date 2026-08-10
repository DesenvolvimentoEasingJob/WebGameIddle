using System.Text.Json;
using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class ItemAttributeRollTests
{
    private static readonly JsonDocument CatalogDoc = JsonDocument.Parse(
        """
        {
          "id": "item-attributes",
          "typeRoles": {
            "weapon": ["offense"],
            "armor": ["defense"],
            "ring": ["utility", "offense"]
          },
          "lifeSteal": {
            "compatibility": ["offense"],
            "minValue": 1
          },
          "guardBonus": {
            "compatibility": ["defense"],
            "minValue": 2
          },
          "vitalWire": {
            "compatibility": ["utility"],
            "minValue": 0.2
          },
          "swiftStrike": {
            "compatibility": ["offense"],
            "minValue": 1
          }
        }
        """);

    private static JsonElement Catalog() => CatalogDoc.RootElement;

    [Theory]
    [InlineData(1, 0)]
    [InlineData(2, 1)]
    [InlineData(11, 3)]
    [InlineData(99, 20)]
    public void DefaultAttributeCountCurve_Legendary_Min3_Max20(int rarityId, int expected)
    {
        Assert.Equal(expected, ItemAttributeRoll.DefaultAttributeCountCurve(rarityId));
    }

    [Fact]
    public void Roll_Weapon_OnlyOffense_And_ValueTimesStars()
    {
        var catalog = Catalog();
        var rolled = ItemAttributeRoll.Roll(catalog, "weapon", attributeCount: 10, stars: 5, rng: new Random(1));

        Assert.NotEmpty(rolled);
        Assert.All(rolled, r => Assert.Contains(r.Id, new[] { "lifeSteal", "swiftStrike" }));
        Assert.Contains(rolled, r => r.Id == "lifeSteal" && r.Value == 5);
        Assert.DoesNotContain(rolled, r => r.Id == "guardBonus");
    }

    [Fact]
    public void Roll_Armor_OnlyDefense()
    {
        var catalog = Catalog();
        var rolled = ItemAttributeRoll.Roll(catalog, "armor", attributeCount: 5, stars: 2, rng: new Random(2));

        Assert.Single(rolled);
        Assert.Equal("guardBonus", rolled[0].Id);
        Assert.Equal(4, rolled[0].Value);
    }

    [Fact]
    public void Roll_CommonCountZero_Empty()
    {
        var catalog = Catalog();
        var rolled = ItemAttributeRoll.Roll(catalog, "weapon", attributeCount: 0, stars: 5, rng: new Random(3));
        Assert.Empty(rolled);
    }

    [Fact]
    public void Roll_DoesNotDuplicateIds()
    {
        var catalog = Catalog();
        var rolled = ItemAttributeRoll.Roll(catalog, "weapon", attributeCount: 50, stars: 1, rng: new Random(4));
        Assert.Equal(rolled.Select(r => r.Id).Distinct().Count(), rolled.Count);
    }
}
