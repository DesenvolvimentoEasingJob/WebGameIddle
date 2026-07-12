using System.Text.Json.Nodes;

namespace SkySpire.Api.Models.GameData;

public class ItemDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required string Type { get; init; }
    public string? ItemKind { get; init; }
    public string? Slot { get; init; }
    public required string Rarity { get; init; }
    public int Level { get; init; }
    public IReadOnlyList<string> Classes { get; init; } = [];
    public bool Stackable { get; init; }
    public int MaxStack { get; init; } = 1;
    public JsonObject Categories { get; init; } = new();
    public JsonObject? Assets { get; init; }
}
