using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Drafts content item JSON from a natural-language description via OpenAI.
/// Never writes files — caller (editor) reviews and saves.
/// </summary>
public sealed class ItemDraftService(
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ILogger<ItemDraftService> log)
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "weapon", "helmet", "armor", "ring", "amulet", "focus", "material", "shield"
    };

    private static readonly HashSet<string> AllowedStats = new(StringComparer.OrdinalIgnoreCase)
    {
        "dmgBase", "defBase", "hpBase", "mpBase", "capBase", "attackSpeed",
        "critChance", "critDamage", "dodgeChance", "hpRegenPerSec"
    };

    private const string SystemPrompt = """
        You design SkySpire game CONTENT item templates (not player drops).
        Return ONLY a JSON object with keys:
        id (kebab-case ascii), name, description, type, grip (optional), itemLevel (int >= 1),
        stackable (bool), stats (object of number values), assets.icon (string path).
        type must be one of: weapon, helmet, armor, ring, amulet, focus, material, shield.
        For weapon, shield, or focus: include grip as "oneHand" or "twoHand"
        (twoHand = needs 2 hand slots, e.g. spear, greatsword, heavy cleaver; otherwise oneHand).
        Omit grip for other types.
        stats keys only from: dmgBase, defBase, hpBase, mpBase, capBase, attackSpeed,
        critChance, critDamage, dodgeChance, hpRegenPerSec. Use modest base numbers.
        stackable true ONLY for material without combat stats; otherwise false.
        assets.icon = "/assets/items/{id}.png".
        Do not invent rarity. Language for name/description: Portuguese (Brazil).
        """;

    public async Task<ItemDraftResult> DraftAsync(string description, CancellationToken ct)
    {
        var key = secrets.Value.OpenAiApiKey;
        if (string.IsNullOrWhiteSpace(key))
        {
            return ItemDraftResult.Fail("OPENAI_API_KEY não configurada no backend.");
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return ItemDraftResult.Fail("description é obrigatória.");
        }

        try
        {
            var client = httpFactory.CreateClient("openai");
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            var body = new
            {
                model = "gpt-4o-mini",
                response_format = new { type = "json_object" },
                temperature = 0.4,
                messages = new object[]
                {
                    new { role = "system", content = SystemPrompt },
                    new { role = "user", content = description.Trim() }
                }
            };
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("OpenAI HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                return ItemDraftResult.Fail($"OpenAI HTTP {(int)res.StatusCode}");
            }

            using var doc = JsonDocument.Parse(raw);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return ItemDraftResult.Fail("OpenAI retornou conteúdo vazio.");
            }

            using var itemDoc = JsonDocument.Parse(content);
            var draft = Normalize(itemDoc.RootElement);
            return ItemDraftResult.Ok(draft);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Item draft failed");
            return ItemDraftResult.Fail(ex.Message);
        }
    }

    private static Dictionary<string, object?> Normalize(JsonElement root)
    {
        var id = SanitizeId(GetString(root, "id") ?? "novo-item");
        var type = GetString(root, "type") ?? "material";
        if (!AllowedTypes.Contains(type))
        {
            type = "material";
        }

        var stats = new Dictionary<string, double>(StringComparer.Ordinal);
        if (root.TryGetProperty("stats", out var statsEl) && statsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in statsEl.EnumerateObject())
            {
                if (!AllowedStats.Contains(prop.Name))
                {
                    continue;
                }

                if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDouble(out var n))
                {
                    stats[CanonicalStat(prop.Name)] = n;
                }
            }
        }

        var stackable = root.TryGetProperty("stackable", out var st) && st.ValueKind == JsonValueKind.True;
        if (stackable && stats.Count > 0)
        {
            stackable = false;
        }

        if (string.Equals(type, "material", StringComparison.OrdinalIgnoreCase) && stats.Count == 0)
        {
            stackable = true;
        }

        var itemLevel = 1;
        if (root.TryGetProperty("itemLevel", out var il) && il.TryGetInt32(out var ilv) && ilv >= 1)
        {
            itemLevel = ilv;
        }

        var name = GetString(root, "name") ?? id;
        var description = GetString(root, "description") ?? "";
        var typeNorm = type.ToLowerInvariant();

        var result = new Dictionary<string, object?>
        {
            ["id"] = id,
            ["name"] = name,
            ["description"] = description,
            ["type"] = typeNorm,
            ["itemLevel"] = itemLevel,
            ["stackable"] = stackable,
            ["stats"] = stats,
            ["assets"] = new Dictionary<string, object?>
            {
                ["icon"] = $"/assets/items/{id}.png"
            }
        };

        if (EquipmentGripHelper.IsHandItemType(typeNorm))
        {
            var gripRaw = GetString(root, "grip");
            result["grip"] = EquipmentGripHelper.NormalizeGrip(gripRaw);
        }

        return result;
    }

    private static string CanonicalStat(string name)
    {
        foreach (var allowed in AllowedStats)
        {
            if (string.Equals(allowed, name, StringComparison.OrdinalIgnoreCase))
            {
                return allowed;
            }
        }

        return name;
    }

    private static string? GetString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static string SanitizeId(string s)
    {
        var lower = s.Trim().ToLowerInvariant();
        var chars = new List<char>();
        var lastDash = false;
        foreach (var c in lower)
        {
            if (char.IsAsciiLetterOrDigit(c))
            {
                chars.Add(c);
                lastDash = false;
            }
            else if ((c == '-' || c == ' ' || c == '_') && !lastDash && chars.Count > 0)
            {
                chars.Add('-');
                lastDash = true;
            }
        }

        while (chars.Count > 0 && chars[^1] == '-')
        {
            chars.RemoveAt(chars.Count - 1);
        }

        var id = new string(chars.ToArray());
        return string.IsNullOrEmpty(id) ? "novo-item" : id;
    }
}

public sealed record ItemDraftResult(bool Success, Dictionary<string, object?>? Draft, string? Error)
{
    public static ItemDraftResult Ok(Dictionary<string, object?> draft) => new(true, draft, null);
    public static ItemDraftResult Fail(string error) => new(false, null, error);
}
