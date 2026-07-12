namespace SkySpire.Api.Models.GameData;

using System.Text.Json.Nodes;

public class MobLootProfile
{
    public double DropChance { get; init; }
    public IReadOnlyDictionary<string, double> RarityWeights { get; init; }
        = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
}

public class RarityDefinition
{
    public int Order { get; init; }
    public double BaseStatMultiplier { get; init; }
    public int AffixRollMin { get; init; }
    public int AffixRollMax { get; init; }
    public string Label { get; init; } = "";
}

public class AffixDefinition
{
    public required string Id { get; init; }
    public required string Label { get; init; }
    public required string CategoryPath { get; init; }
    public required string Formula { get; init; }
    public int RangeMin { get; init; }
    public int RangeMax { get; init; }
    public int RarityRangeStep { get; init; }
    public string? Suffix { get; init; }
}

public class ItemTypeDefinition
{
    public required string Id { get; init; }
    public string? Slot { get; init; }
    public IReadOnlyList<string> Classes { get; init; } = [];
    public JsonObject BaseCategories { get; init; } = new();
    public IReadOnlyList<AffixPoolEntry> AffixPool { get; init; } = [];
}

public class AffixPoolEntry
{
    public required string AffixId { get; init; }
    public double Weight { get; init; }
}

public class LootPoolEntry
{
    public string? ItemId { get; init; }
    public string? ItemKind { get; init; }
    public double Weight { get; init; }
    public bool GenerateIfMissing { get; init; }
}

public class LootPoolDefinition
{
    public required string Id { get; init; }
    public IReadOnlyList<LootPoolEntry> Entries { get; init; } = [];
}
