using System.Text.Json.Nodes;

namespace SkySpire.Api.Models.GameData;

public class ItemDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required string Type { get; init; }
    public string? Slot { get; init; }
    public required string Rarity { get; init; }
    public int Level { get; init; }
    public IReadOnlyList<string> Classes { get; init; } = [];
    public bool Stackable { get; init; }
    public int MaxStack { get; init; } = 1;
    public JsonObject Categories { get; init; } = new();
    public JsonObject? Assets { get; init; }
}

public class TowerMobDefinition
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
}

public class TowerFloorDefinition
{
    public int Floor { get; init; }
    public required string Name { get; init; }
    public string? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public int MobCount { get; init; }
    public IReadOnlyList<TowerMobDefinition> MobPool { get; init; } = [];
    public required TowerMobDefinition Boss { get; init; }
}
