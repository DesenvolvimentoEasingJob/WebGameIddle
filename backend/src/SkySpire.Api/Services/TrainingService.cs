using System.Text.Json;
using System.Text.Json.Nodes;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

public sealed class TrainingService(
    CharacterService characters,
    EconomyService economy,
    StatsService stats,
    ContentService content,
    StatCalculator calculator,
    GameConfigService gameConfig)
{
    /// <summary>
    /// Próximo custo: sem lastCost → TRAINING_COST_BASE; senão lastCost × TRAINING_GOLD_SCALE.
    /// </summary>
    public static long NextCost(GameBalanceOptions opts, long? lastCost)
    {
        if (lastCost is null || lastCost <= 0)
        {
            return Math.Max(1, opts.TrainingCostBase);
        }

        return Math.Max(1, (long)Math.Round(lastCost.Value * opts.TrainingGoldScale));
    }

    /// <summary>
    /// Só atributos com fórmulas em <c>content/attributes/core.json</c> (ex.: strength).
    /// HP/dano/cap sobem no StatCalculator via essas fórmulas — não se treinam direto.
    /// </summary>
    public async Task<IReadOnlyList<string>> GetTrainableAttributesAsync(CancellationToken ct)
    {
        var doc = await content.GetByIdAsync("attributes", "core", ct)
            ?? throw new TrainingException("Missing content/attributes/core.json.");

        var keys = new List<string>();
        foreach (var prop in doc.EnumerateObject())
        {
            if (StatCalculator.TryGetFormulas(prop.Value, out _))
            {
                keys.Add(prop.Name);
            }
        }

        if (keys.Count == 0)
        {
            throw new TrainingException("attributes/core.json has no trainable attributes.");
        }

        return keys;
    }

    public async Task<object> PreviewAsync(string attribute, long? lastCost, CancellationToken ct)
    {
        await EnsureTrainableAsync(attribute, ct);
        return new { attribute, lastCost, cost = NextCost(gameConfig.GetBalance(), lastCost) };
    }

    public async Task<object> CostsAsync(Guid userId, CancellationToken ct)
    {
        var node = await characters.GetCharacterNodeAsync(userId, ct)
            ?? throw new TrainingException("No character.");
        var baseStats = node["baseStats"] as JsonObject
            ?? throw new TrainingException("Missing baseStats.");
        var trainingStats = node["trainingStats"] as JsonObject;
        var trainable = await GetTrainableAttributesAsync(ct);

        var core = await content.GetByIdAsync("attributes", "core", ct)
            ?? throw new TrainingException("Missing content/attributes/core.json.");

        var attributes = new List<object>();
        foreach (var attribute in trainable)
        {
            if (baseStats[attribute] is null)
            {
                continue;
            }

            var current = ReadDouble(baseStats[attribute]!);
            var entry = trainingStats?[attribute] as JsonObject;
            var amount = entry?["amount"]?.GetValue<int>() ?? 0;
            var lastCost = entry?["lastCost"]?.GetValue<long>();
            ReadAttributeDisplay(core, attribute, out var name, out var description, out var cardPath, out var formulas);
            attributes.Add(new
            {
                attribute,
                name,
                description,
                cardPath,
                formulas,
                currentValue = current,
                amount,
                lastCost,
                cost = NextCost(gameConfig.GetBalance(), lastCost)
            });
        }

        return new { attributes };
    }

    private static void ReadAttributeDisplay(
        JsonElement core,
        string attribute,
        out string? name,
        out string? description,
        out string? cardPath,
        out IReadOnlyList<string> formulas)
    {
        name = null;
        description = null;
        cardPath = null;
        formulas = Array.Empty<string>();

        if (!core.TryGetProperty(attribute, out var node))
        {
            return;
        }

        StatCalculator.TryGetFormulas(node, out formulas);

        if (node.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        if (node.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
        {
            name = nameEl.GetString();
        }

        if (node.TryGetProperty("description", out var descEl) && descEl.ValueKind == JsonValueKind.String)
        {
            description = descEl.GetString();
        }

        if (node.TryGetProperty("assets", out var assets) &&
            assets.ValueKind == JsonValueKind.Object &&
            assets.TryGetProperty("card", out var cardEl) &&
            cardEl.ValueKind == JsonValueKind.String)
        {
            cardPath = cardEl.GetString();
        }
    }

    public async Task<object> TrainAsync(Guid userId, string attribute, CancellationToken ct)
    {
        await EnsureTrainableAsync(attribute, ct);

        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var baseStats = node["baseStats"] as JsonObject
            ?? throw new TrainingException("Missing baseStats.");

        if (baseStats[attribute] is null)
        {
            throw new TrainingException("Character does not have this base attribute.");
        }

        var trainingStats = node["trainingStats"] as JsonObject ?? new JsonObject();
        var entry = trainingStats[attribute] as JsonObject ?? new JsonObject();
        var amount = entry["amount"]?.GetValue<int>() ?? 0;
        var lastCost = entry["lastCost"]?.GetValue<long>();
        var cost = NextCost(gameConfig.GetBalance(), lastCost);

        await economy.DebitAsync(userId, cost, "training", attribute, ct);

        var current = ReadDouble(baseStats[attribute]!);
        var nextValue = current + 1;
        baseStats[attribute] = nextValue;
        node["baseStats"] = baseStats;

        entry["amount"] = amount + 1;
        entry["lastCost"] = cost;
        trainingStats[attribute] = entry;
        node["trainingStats"] = trainingStats;

        await characters.SaveCharacterNodeAsync(path, node, ct);
        await stats.RecordProgressAsync(userId, node, 0, ct);

        // Stats efetivos (core.json → hp/dmg/cap etc.) após o treino.
        using var doc = JsonDocument.Parse(node.ToJsonString());
        var calculated = await calculator.CalculateFromCharacterAsync(doc.RootElement, ct);

        return new
        {
            attribute,
            value = nextValue,
            amount = amount + 1,
            cost,
            skyCoin = await economy.GetBalanceAsync(userId, ct),
            calculated
        };
    }

    private async Task EnsureTrainableAsync(string attribute, CancellationToken ct)
    {
        var trainable = await GetTrainableAttributesAsync(ct);
        if (!trainable.Any(a => string.Equals(a, attribute, StringComparison.OrdinalIgnoreCase)))
        {
            throw new TrainingException(
                $"Attribute '{attribute}' is not trainable. Only keys in attributes/core.json can be trained.");
        }
    }

    private static double ReadDouble(JsonNode node) =>
        node.GetValueKind() == JsonValueKind.Number
            ? node.GetValue<double>()
            : throw new TrainingException("Base attribute must be a number.");
}

public sealed class TrainingException(string message) : Exception(message);
