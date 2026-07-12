using System.Text.Json.Nodes;

namespace SkySpire.Api.Models.GameData;

public class MobDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public int Level { get; init; }
    public int Hp { get; init; }
    public int Attack { get; init; }
    public int Defense { get; init; }
    public int Xp { get; init; }
    public int Gold { get; init; }
    public JsonObject? Assets { get; init; }
    public MobLootProfile? Loot { get; init; }
}

public class TowerFloorDefinition
{
    public int Floor { get; init; }
    public required string Name { get; init; }
    public string? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public int MobCount { get; init; }
    public IReadOnlyList<MobDefinition> MobPool { get; init; } = [];
    public required MobDefinition Boss { get; init; }
    public string? LootPool { get; init; }
}
