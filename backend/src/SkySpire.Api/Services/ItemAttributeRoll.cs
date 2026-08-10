using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

/// <summary>
/// Affixes de item: elegibilidade por <c>typeRoles[item.type]</c> × <c>compatibility</c> do atributo.
/// Valor = <c>minValue * stars</c>. Contagem vem de <c>rarity.attributeCount</c>.
/// </summary>
public static class ItemAttributeRoll
{
    public const string CatalogId = "item-attributes";

    public static int DefaultAttributeCountCurve(int rarityId)
    {
        if (rarityId <= 1)
        {
            return 0;
        }

        if (rarityId <= 11)
        {
            return 1 + (rarityId - 2) * 2 / 9;
        }

        return 3 + (rarityId - 11) * 17 / 88;
    }

    public static IReadOnlyList<string> ResolveRoles(JsonElement catalog, string? itemType)
    {
        if (string.IsNullOrWhiteSpace(itemType) ||
            !catalog.TryGetProperty("typeRoles", out var roles) ||
            roles.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        if (!roles.TryGetProperty(itemType, out var arr) || arr.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var list = new List<string>();
        foreach (var el in arr.EnumerateArray())
        {
            var s = el.GetString();
            if (!string.IsNullOrWhiteSpace(s))
            {
                list.Add(s);
            }
        }

        return list;
    }

    public static IReadOnlyList<string> EligibleAttributeIds(
        JsonElement catalog,
        IReadOnlyList<string> roles)
    {
        if (roles.Count == 0)
        {
            return [];
        }

        var roleSet = new HashSet<string>(roles, StringComparer.OrdinalIgnoreCase);
        var ids = new List<string>();

        foreach (var prop in catalog.EnumerateObject())
        {
            if (prop.NameEquals("id") || prop.NameEquals("typeRoles"))
            {
                continue;
            }

            if (prop.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!prop.Value.TryGetProperty("compatibility", out var compat) ||
                compat.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            var ok = false;
            foreach (var c in compat.EnumerateArray())
            {
                var s = c.GetString();
                if (!string.IsNullOrWhiteSpace(s) && roleSet.Contains(s))
                {
                    ok = true;
                    break;
                }
            }

            if (ok)
            {
                ids.Add(prop.Name);
            }
        }

        return ids;
    }

    public static double ReadMinValue(JsonElement catalog, string attributeId)
    {
        if (!catalog.TryGetProperty(attributeId, out var node) ||
            node.ValueKind != JsonValueKind.Object)
        {
            return 0;
        }

        if (node.TryGetProperty("minValue", out var mv) && mv.ValueKind == JsonValueKind.Number)
        {
            return mv.GetDouble();
        }

        return 0;
    }

    /// <summary>
    /// Escolhe até <paramref name="count"/> ids únicos (sem reposição) e calcula
    /// <c>value = minValue * stars</c>.
    /// </summary>
    public static IReadOnlyList<(string Id, double Value)> Roll(
        JsonElement catalog,
        string? itemType,
        int attributeCount,
        int stars,
        Random rng)
    {
        if (attributeCount <= 0)
        {
            return [];
        }

        var roles = ResolveRoles(catalog, itemType);
        var pool = EligibleAttributeIds(catalog, roles).ToList();
        if (pool.Count == 0)
        {
            return [];
        }

        Shuffle(pool, rng);
        var take = Math.Min(attributeCount, pool.Count);
        var starMult = Math.Max(1, stars);
        var result = new List<(string Id, double Value)>(take);

        for (var i = 0; i < take; i++)
        {
            var id = pool[i];
            var min = ReadMinValue(catalog, id);
            result.Add((id, min * starMult));
        }

        return result;
    }

    public static void ApplyToSnapshot(JsonObject snap, IReadOnlyList<(string Id, double Value)> rolled)
    {
        var arr = new JsonArray();
        var stats = snap["stats"] as JsonObject ?? new JsonObject();
        snap["stats"] = stats;

        foreach (var (id, value) in rolled)
        {
            arr.Add(new JsonObject
            {
                ["id"] = id,
                ["value"] = value
            });

            if (stats.TryGetPropertyValue(id, out var existing) &&
                existing is JsonValue jv &&
                jv.TryGetValue<double>(out var prev))
            {
                stats[id] = prev + value;
            }
            else
            {
                stats[id] = value;
            }
        }

        snap["itemAttributes"] = arr;
    }

    private static void Shuffle<T>(IList<T> list, Random rng)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }
}
