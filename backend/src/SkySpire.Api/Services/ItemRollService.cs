using System.Text.Json;

using System.Text.Json.Nodes;



namespace SkySpire.Api.Services;



/// <summary>

/// Cria snapshots de item para a bag: materiais stackáveis ou equipamentos com raridade/estrelas bakeados.

/// Ordem: escala de andar primeiro, depois raridade/estrelas.

/// <c>leveled = base × (1 + itemLevel/10)</c>; <c>final = leveled × (stars + multiplier)</c>.

/// Qualidade (estrelas 1–5) traz <c>colorStart</c>/<c>colorEnd</c> RGB de <c>content/qualities</c>.
/// Affixes: <c>itemAttributes</c> conforme <c>rarity.attributeCount</c> e catálogo item-attributes
/// (<c>value = minValue × stars</c>). Bags legadas não são migradas.

/// </summary>

public sealed class ItemRollService(ContentService content, RarityService rarities, QualityService qualities)

{

    /// <summary>Pesos para stars 1..5 (enviesado para baixo).</summary>

    public static readonly int[] StarWeights = [40, 30, 18, 9, 3];



    /// <summary>Primeira escala: <c>base + base×(lv/10)</c>.</summary>

    public static double ApplyFloorLevel(double baseValue, int itemLevel)

    {

        var lv = Math.Max(1, itemLevel);

        return baseValue * (1.0 + lv / 10.0);

    }



    public static double BakeStat(double baseValue, int stars, double multiplier, int itemLevel = 1) =>

        ApplyFloorLevel(baseValue, itemLevel) * (stars + multiplier);



    public async Task<JsonObject> CreateFromTemplateAsync(

        string templateId,

        Random rng,

        CancellationToken ct,

        int itemLevel = 1,

        int? fixedStars = null,

        int? fixedRarityId = null,

        double rarityLuck = 0)

    {

        var template = await content.GetByIdAsync("items", templateId, ct)

            ?? throw new ItemRollException($"Unknown item template '{templateId}'.");



        var stackable = template.TryGetProperty("stackable", out var st) &&

                        st.ValueKind == JsonValueKind.True;



        if (stackable)

        {

            return await CreateMaterialSnapshotAsync(templateId, 1, ct);

        }



        var stars = fixedStars ?? PickStars(rng);

        RarityDefinition rarity;

        if (fixedRarityId is int rid)

        {

            rarity = await rarities.GetByIdAsync(rid, ct)

                ?? throw new ItemRollException($"Unknown rarity id {rid}.");

        }

        else

        {

            rarity = await rarities.PickAsync(rng, ct, rarityLuck);

        }



        var quality = await ResolveQualityAsync(stars, ct);

        var snap = BuildEquipmentSnapshot(template, templateId, stars, rarity, quality, Math.Max(1, itemLevel));

        var itemType = template.TryGetProperty("type", out var typeEl) ? typeEl.GetString() : null;
        var catalog = await content.GetByIdAsync("attributes", ItemAttributeRoll.CatalogId, ct);
        if (catalog is not null && rarity.AttributeCount > 0)
        {
            var rolled = ItemAttributeRoll.Roll(
                catalog.Value,
                itemType,
                rarity.AttributeCount,
                stars,
                rng);
            ItemAttributeRoll.ApplyToSnapshot(snap, rolled);
        }

        return snap;

    }



    public async Task<JsonObject> CreateMaterialSnapshotAsync(string templateId, int qty, CancellationToken ct)

    {

        var template = await content.GetByIdAsync("items", templateId, ct)

            ?? throw new ItemRollException($"Unknown item template '{templateId}'.");



        var snap = CloneTemplateFields(template, templateId);

        snap["stackable"] = true;

        snap["qty"] = Math.Max(1, qty);

        snap["instanceId"] = Guid.NewGuid().ToString();

        return snap;

    }



    /// <summary>

    /// Expande legado <c>{ itemId, qty }</c> para snapshot completo (sem re-roll se já tiver stats bakeados).

    /// Equipamentos legados recebem Comum 1★ itemLevel 1 bakeado a partir do template.

    /// </summary>

    public async Task<JsonObject> ExpandLegacyOrPassthroughAsync(JsonObject item, CancellationToken ct)

    {

        if (item["stats"] is JsonObject &&

            (item["instanceId"] is not null || item["rarityId"] is not null || IsStackable(item)))

        {

            EnsureTemplateId(item);

            await EnsureQualityColorsAsync(item, ct);

            return item;

        }



        if (item["stats"] is JsonObject && item["templateId"] is not null && !NeedsLegacyExpand(item))

        {

            EnsureTemplateId(item);

            if (item["instanceId"] is null)

            {

                item["instanceId"] = Guid.NewGuid().ToString();

            }



            await EnsureQualityColorsAsync(item, ct);

            return item;

        }



        var templateId = ResolveTemplateId(item);

        if (string.IsNullOrWhiteSpace(templateId))

        {

            if (item["instanceId"] is null)

            {

                item["instanceId"] = Guid.NewGuid().ToString();

            }



            await EnsureQualityColorsAsync(item, ct);

            return item;

        }



        var template = await content.GetByIdAsync("items", templateId, ct);

        if (template is null)

        {

            EnsureTemplateId(item);

            if (item["instanceId"] is null)

            {

                item["instanceId"] = Guid.NewGuid().ToString();

            }



            await EnsureQualityColorsAsync(item, ct);

            return item;

        }



        var qty = item["qty"]?.GetValue<int>() ?? 1;

        var templateEl = template.Value;

        var stackable = templateEl.TryGetProperty("stackable", out var st) &&

                        st.ValueKind == JsonValueKind.True;



        if (stackable)

        {

            var material = await CreateMaterialSnapshotAsync(templateId, qty, ct);

            if (item["instanceId"]?.GetValue<string>() is { } existingId && !string.IsNullOrWhiteSpace(existingId))

            {

                material["instanceId"] = existingId;

            }



            return material;

        }



        var common = await rarities.GetByIdAsync(1, ct)

            ?? new RarityDefinition { Id = 1, Name = "Comum", Chance = 0, Multiplier = 1 };

        var legacyLevel = item["itemLevel"]?.GetValueKind() == JsonValueKind.Number

            ? Math.Max(1, item["itemLevel"]!.GetValue<int>())

            : 1;

        var quality = await ResolveQualityAsync(1, ct);

        var snap = BuildEquipmentSnapshot(templateEl, templateId, stars: 1, common, quality, legacyLevel);

        snap["qty"] = 1;

        return snap;

    }



    public static string? ResolveTemplateId(JsonObject item) =>

        item["templateId"]?.GetValue<string>() ?? item["itemId"]?.GetValue<string>();



    public static bool IsStackable(JsonObject item) =>

        item["stackable"]?.GetValueKind() == JsonValueKind.True ||

        string.Equals(item["type"]?.GetValue<string>(), "material", StringComparison.OrdinalIgnoreCase);



    private static bool NeedsLegacyExpand(JsonObject item) =>

        item["itemId"] is not null && item["templateId"] is null && item["stats"] is null;



    private static void EnsureTemplateId(JsonObject item)

    {

        if (item["templateId"] is null && item["itemId"] is not null)

        {

            item["templateId"] = item["itemId"]!.DeepClone();

        }

    }



    private async Task EnsureQualityColorsAsync(JsonObject item, CancellationToken ct)

    {

        if (IsStackable(item))

        {

            return;

        }



        var starsNode = item["stars"];

        if (starsNode is null || starsNode.GetValueKind() != JsonValueKind.Number)

        {

            return;

        }



        if (item["colorStart"] is JsonObject && item["colorEnd"] is JsonObject)

        {

            return;

        }



        var stars = Math.Clamp(starsNode.GetValue<int>(), 1, 5);

        ApplyQuality(item, await ResolveQualityAsync(stars, ct));

    }



    private async Task<QualityDefinition> ResolveQualityAsync(int stars, CancellationToken ct)

    {

        return await qualities.GetByStarsAsync(stars, ct)

            ?? new QualityDefinition

            {

                Stars = Math.Clamp(stars, 1, 5),

                Name = "Simples",

                ColorStart = new RgbColor { R = 157, G = 157, B = 157 },

                ColorEnd = new RgbColor { R = 220, G = 220, B = 220 }

            };

    }



    private static JsonObject BuildEquipmentSnapshot(

        JsonElement template,

        string templateId,

        int stars,

        RarityDefinition rarity,

        QualityDefinition quality,

        int itemLevel)

    {

        var snap = CloneTemplateFields(template, templateId);

        snap["stackable"] = false;

        snap["qty"] = 1;

        snap["instanceId"] = Guid.NewGuid().ToString();

        snap["rarityId"] = rarity.Id;

        snap["rarityName"] = rarity.Name;

        snap["stars"] = stars;

        snap["itemLevel"] = Math.Max(1, itemLevel);

        ApplyQuality(snap, quality);



        var baseStats = new JsonObject();

        var baked = new JsonObject();

        if (template.TryGetProperty("stats", out var stats) && stats.ValueKind == JsonValueKind.Object)

        {

            foreach (var prop in stats.EnumerateObject())

            {

                if (prop.Value.ValueKind != JsonValueKind.Number)

                {

                    continue;

                }



                var baseVal = prop.Value.GetDouble();

                baseStats[prop.Name] = baseVal;

                baked[prop.Name] = BakeStat(baseVal, stars, rarity.Multiplier, itemLevel);

            }

        }



        snap["baseStats"] = baseStats;

        snap["stats"] = baked;

        snap.Remove("itemId");

        return snap;

    }



    private static void ApplyQuality(JsonObject snap, QualityDefinition quality)

    {

        snap["qualityName"] = quality.Name;

        snap["colorStart"] = ToRgbNode(quality.ColorStart);

        snap["colorEnd"] = ToRgbNode(quality.ColorEnd);

    }



    private static JsonObject ToRgbNode(RgbColor c) =>

        new()

        {

            ["r"] = c.R,

            ["g"] = c.G,

            ["b"] = c.B

        };



    private static JsonObject CloneTemplateFields(JsonElement template, string templateId)

    {

        var snap = new JsonObject

        {

            ["templateId"] = templateId

        };



        CopyString(template, snap, "name");

        CopyString(template, snap, "description");

        CopyString(template, snap, "type");

        CopyString(template, snap, "grip");

        if (template.TryGetProperty("handSlots", out var handSlots) &&
            handSlots.ValueKind == JsonValueKind.Number)
        {
            snap["handSlots"] = handSlots.GetInt32();
        }

        if (template.TryGetProperty("assets", out var assets))

        {

            snap["assets"] = JsonNode.Parse(assets.GetRawText());

        }



        return snap;

    }



    private static void CopyString(JsonElement template, JsonObject snap, string name)

    {

        if (template.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String)

        {

            snap[name] = el.GetString();

        }

    }



    public static int PickStars(Random rng)

    {

        var total = StarWeights.Sum();

        var roll = rng.Next(total);

        var acc = 0;

        for (var i = 0; i < StarWeights.Length; i++)

        {

            acc += StarWeights[i];

            if (roll < acc)

            {

                return i + 1;

            }

        }



        return StarWeights.Length;

    }

}



public sealed class ItemRollException(string message) : Exception(message);

