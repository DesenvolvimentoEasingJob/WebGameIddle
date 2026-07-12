using SkySpire.Api.DTOs;

namespace SkySpire.Api.Services;

public static class LootConfigBuilder
{
    public static GameLootConfigDto Build(GameDataLoader gameData)
    {
        var rarities = gameData.Rarities
            .OrderBy(pair => pair.Value.Order)
            .ToDictionary(
                pair => pair.Key,
                pair => new RaritySummaryDto(
                    pair.Key,
                    pair.Value.Label,
                    pair.Value.Order,
                    pair.Value.BaseStatMultiplier,
                    pair.Value.DropWeight,
                    pair.Value.AffixRollMin,
                    pair.Value.AffixRollMax,
                    ResolveSlotFrame(pair.Key)),
                StringComparer.OrdinalIgnoreCase);

        var affixes = gameData.Affixes
            .ToDictionary(
                pair => pair.Key,
                pair => new AffixSummaryDto(
                    pair.Key,
                    pair.Value.Label,
                    pair.Value.Suffix),
                StringComparer.OrdinalIgnoreCase);

        return new GameLootConfigDto(rarities, affixes);
    }

    private static string? ResolveSlotFrame(string rarityId) =>
        rarityId.Equals("common", StringComparison.OrdinalIgnoreCase)
            ? "slot-common"
            : $"slot-{rarityId.ToLowerInvariant()}";
}
