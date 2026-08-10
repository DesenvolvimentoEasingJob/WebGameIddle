using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

/// <summary>
/// Soma <c>levelGain</c> da raça e da classe em <c>baseStats</c> (persistido no JSON).
/// </summary>
public sealed class LevelGrowthService(ContentService content)
{
    public async Task ApplyLevelGainsAsync(JsonObject character, CancellationToken ct)
    {
        var raceId = character["raceId"]?.GetValue<string>();
        var classId = character["classId"]?.GetValue<string>();
        if (string.IsNullOrEmpty(raceId))
        {
            return;
        }

        var baseStats = character["baseStats"] as JsonObject ?? new JsonObject();
        character["baseStats"] = baseStats;

        var race = await content.GetByIdAsync("races", raceId, ct);
        if (race is not null)
        {
            ApplyGainObject(baseStats, race.Value, "levelGain");
        }

        if (!string.IsNullOrEmpty(classId))
        {
            var cls = await content.GetByIdAsync("classes", classId, ct);
            if (cls is not null)
            {
                ApplyGainObject(baseStats, cls.Value, "levelGain");
            }
        }
    }

    /// <summary>Aplica um mapa numérico de gains (para testes unitários).</summary>
    public static void ApplyGainMap(JsonObject baseStats, IReadOnlyDictionary<string, double> gains)
    {
        foreach (var (key, amount) in gains)
        {
            if (amount == 0)
            {
                continue;
            }

            var current = AsDouble(baseStats[key]);
            baseStats[key] = current + amount;
        }
    }

    private static void ApplyGainObject(JsonObject baseStats, JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var gains) || gains.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var map = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in gains.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Number)
            {
                map[prop.Name] = prop.Value.GetDouble();
            }
        }

        ApplyGainMap(baseStats, map);
    }

    private static double AsDouble(JsonNode? node)
    {
        if (node is not JsonValue)
        {
            return 0;
        }

        var raw = node.ToJsonString();
        return double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) ? n : 0;
    }
}
