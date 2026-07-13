using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using SkySpire.Api.Models.GameData;
using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class LootScalingTests
{
    [Fact]
    public void LevelMultiplier_Level1_IsHalf()
    {
        Assert.Equal(0.5, LootScaling.LevelMultiplier(1), 2);
    }

    [Fact]
    public void LevelMultiplier_Level10_IsFiveTimes()
    {
        Assert.Equal(5.0, LootScaling.LevelMultiplier(10), 2);
    }

    [Fact]
    public void LevelMultiplier_Level60_IsThirtyTimes()
    {
        Assert.Equal(30.0, LootScaling.LevelMultiplier(60), 2);
    }

    [Fact]
    public void CombinedStatMultiplier_AppliesLevelAndRarity()
    {
        var mult = LootScaling.CombinedStatMultiplier(order: 2, level: 10);
        Assert.True(mult > 5.0);
    }

    [Fact]
    public void AffixRollRange_Common_IsZero()
    {
        var (min, max) = LootScaling.AffixRollRange(0);
        Assert.Equal(0, min);
        Assert.Equal(0, max);
    }
}

public class ItemInstanceBuilderTests
{
    [Fact]
    public void Build_AppliesLevelMultiplierToCategories()
    {
        var integrity = new ItemIntegrityService(BuildConfig());
        var gameData = new GameDataLoader(new FakeEnvironment());
        var affixRoller = new ItemAffixRoller(gameData);
        var builder = new ItemInstanceBuilder(integrity, affixRoller);

        var itemDef = new ItemDefinition
        {
            Id = "test-sword",
            Name = "Test",
            Type = "weapon",
            ItemKind = "sword",
            Slot = "weapon",
            Rarity = "common",
            Level = 1,
            Categories = new JsonObject
            {
                ["attributes"] = new JsonObject
                {
                    ["strength"] = new JsonObject { ["base"] = 10 },
                },
            },
        };

        var rarity = new RarityDefinition
        {
            Order = 0,
            BaseStatMultiplier = 1,
            DropWeight = 1,
            AffixRollMin = 0,
            AffixRollMax = 0,
            Label = "Comum",
        };

        var instance = builder.Build(itemDef, rarity, "common", floorLevel: 10, new Random(42));

        var strength = instance["rolledCategories"]?["attributes"]?["strength"]?["base"]?.GetValue<int>();
        Assert.Equal(50, strength);
        Assert.Equal(10, instance["level"]?.GetValue<int>());
        Assert.NotNull(instance["integrity"]);
    }

    private static IConfiguration BuildConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "test-secret-key-for-unit-tests-only",
            })
            .Build();
}

internal sealed class FakeEnvironment : IWebHostEnvironment
{
    public string WebRootPath { get; set; } = "";
    public string ApplicationName { get; set; } = "Tests";
    public IFileProvider WebRootFileProvider { get; set; } = null!;
    public string EnvironmentName { get; set; } = "Development";
    public string ContentRootPath { get; set; } = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "SkySpire.Api"));
    public IFileProvider ContentRootFileProvider { get; set; } = null!;
}
