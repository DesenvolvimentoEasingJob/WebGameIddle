namespace SkySpire.Api.DTOs;

public record RaritySummaryDto(
    string Id,
    string Label,
    int Order,
    double BaseStatMultiplier,
    int AffixRollMin,
    int AffixRollMax,
    string? SlotFrame);

public record AffixSummaryDto(
    string Id,
    string Label,
    string? Suffix);

public record GameLootConfigDto(
    IReadOnlyDictionary<string, RaritySummaryDto> Rarities,
    IReadOnlyDictionary<string, AffixSummaryDto> Affixes);
