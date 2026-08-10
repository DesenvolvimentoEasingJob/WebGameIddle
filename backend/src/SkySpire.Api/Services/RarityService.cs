using System.Text.Json;

namespace SkySpire.Api.Services;

public sealed class RarityDefinition
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    /// <summary>Chance independente 0–1 de “passar” no roll (Comum = 0, só fallback).</summary>
    public double Chance { get; init; }
    public double Multiplier { get; init; }
    /// <summary>Quantidade de affixes rolados no drop (Comum 0 … id 99 = 20).</summary>
    public int AttributeCount { get; init; }
}

/// <summary>
/// Carrega <c>content/rarities/rarities.json</c> e faz pick por sucesso máximo:
/// cada raridade com <c>chance</c> &gt; 0 rola de forma independente; vence a de maior <c>id</c> que passar.
/// Se nenhuma passar → Comum (id 1). <c>rarityLuck</c> do monstro eleva as chances via
/// <see cref="MonsterDropHelper.EffectiveChance"/>.
/// </summary>
public sealed class RarityService(ContentService content)
{
    private IReadOnlyList<RarityDefinition>? _cache;
    private IReadOnlyList<RarityDefinition>? _pickOrder;

    public async Task<IReadOnlyList<RarityDefinition>> GetAllAsync(CancellationToken ct)
    {
        await EnsureLoadedAsync(ct);
        return _cache!;
    }

    public Task<RarityDefinition> PickAsync(Random rng, CancellationToken ct) =>
        PickAsync(rng, ct, rarityLuck: 0);

    public async Task<RarityDefinition> PickAsync(Random rng, CancellationToken ct, double rarityLuck)
    {
        await EnsureLoadedAsync(ct);
        return PickFrom(_pickOrder!, _cache!, rng, rarityLuck);
    }

    /// <summary>
    /// Top-down: do maior id ao menor com chance &gt; 0; primeiro sucesso vence; senão Comum.
    /// </summary>
    public static RarityDefinition PickFrom(
        IReadOnlyList<RarityDefinition> pickOrderHighestFirst,
        IReadOnlyList<RarityDefinition> allSortedById,
        Random rng,
        double rarityLuck = 0)
    {
        foreach (var rarity in pickOrderHighestFirst)
        {
            if (rarity.Chance <= 0)
            {
                continue;
            }

            var chance = MonsterDropHelper.EffectiveChance(rarity.Chance, rarityLuck);
            if (rng.NextDouble() < chance)
            {
                return rarity;
            }
        }

        return allSortedById.FirstOrDefault(r => r.Id == 1)
            ?? allSortedById[0];
    }

    public async Task<RarityDefinition?> GetByIdAsync(int id, CancellationToken ct)
    {
        await EnsureLoadedAsync(ct);
        return _cache!.FirstOrDefault(r => r.Id == id);
    }

    private async Task EnsureLoadedAsync(CancellationToken ct)
    {
        if (_cache is not null)
        {
            return;
        }

        var doc = await content.GetByIdAsync("rarities", "rarities", ct)
            ?? throw new InvalidOperationException("Missing content/rarities/rarities.json");

        if (!doc.TryGetProperty("rarities", out var arr) || arr.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("rarities.json missing rarities array.");
        }

        var list = new List<RarityDefinition>();
        foreach (var el in arr.EnumerateArray())
        {
            var chance = 0.0;
            if (el.TryGetProperty("chance", out var chanceEl) && chanceEl.ValueKind == JsonValueKind.Number)
            {
                chance = chanceEl.GetDouble();
            }

            var id = el.GetProperty("id").GetInt32();
            var attributeCount = ItemAttributeRoll.DefaultAttributeCountCurve(id);
            if (el.TryGetProperty("attributeCount", out var ac) && ac.ValueKind == JsonValueKind.Number)
            {
                attributeCount = Math.Max(0, ac.GetInt32());
            }

            list.Add(new RarityDefinition
            {
                Id = id,
                Name = el.GetProperty("name").GetString() ?? "",
                Chance = Math.Clamp(chance, 0, 1),
                Multiplier = el.GetProperty("multiplier").GetDouble(),
                AttributeCount = attributeCount
            });
        }

        if (list.Count == 0)
        {
            throw new InvalidOperationException("No rarities defined.");
        }

        list.Sort((a, b) => a.Id.CompareTo(b.Id));
        _cache = list;
        _pickOrder = list.OrderByDescending(r => r.Id).ToList();
    }
}
