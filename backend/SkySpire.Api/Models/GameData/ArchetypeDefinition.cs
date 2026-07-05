using System.Text.Json.Nodes;

namespace SkySpire.Api.Models.GameData;

public class ArchetypeDefinition
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public JsonObject? Assets { get; init; }
    public required JsonObject Categories { get; init; }
    public IReadOnlyList<string> EquipmentSlots { get; init; } = EquipmentSlotDefaults.Standard;
}
