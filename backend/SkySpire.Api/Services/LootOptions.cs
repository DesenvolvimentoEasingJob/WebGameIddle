namespace SkySpire.Api.Services;

public class LootOptions
{
    public const string SectionName = "Loot";

    public int AiNamingMinRarityOrder { get; init; } = 20;
    public int AiArtMinRarityOrder { get; init; } = 50;
    public int MaxCombatBatchSize { get; init; } = 10;
}
