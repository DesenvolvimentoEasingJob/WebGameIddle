using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Drafts content monster JSON from a natural-language description via OpenAI.
/// Never writes files — caller (editor) reviews and saves.
/// </summary>
public sealed class MonsterDraftService(
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ILogger<MonsterDraftService> log)
{
    private static readonly HashSet<string> AllowedBehaviors = new(StringComparer.OrdinalIgnoreCase)
    {
        "aggressive", "defensive", "passive", "skittish"
    };

    private static readonly HashSet<string> AllowedStats = new(StringComparer.OrdinalIgnoreCase)
    {
        "dmgBase", "defBase", "critChance", "critDamage", "dodgeChance", "attackSpeed"
    };

    private const string SystemPrompt = """
        You design SkySpire game CONTENT monster templates for a pixel-art tower RPG.
        Return ONLY a JSON object with keys:
        id (kebab-case ascii), name, description, level (int >= 1), hp (number > 0),
        baseStats (object of number values), bonusDefense (object of number values),
        skills (string array, usually empty), behavior, skyCoinDrop ([min, max] ints >= 0),
        rarityLuck (number >= 0), loot (array of { itemId, chance 0..1, qty: [min, max] }),
        assets.sprite (string path).
        description: 1–3 sentences in Portuguese (Brazil) covering appearance, temperament and flavor
        useful for pixel-art generation (colors, size, distinctive features). Required.
        baseStats keys only from: dmgBase, defBase, critChance, critDamage, dodgeChance, attackSpeed.
        Prefer dmgBase and defBase. Modest numbers for the given level.
        behavior one of: aggressive, defensive, passive, skittish.
        skyCoinDrop: farm mobs low (1–5), elites medium, bosses higher.
        rarityLuck: 0 for common farm, up to ~2 for bosses.
        loot: use known item ids when possible (scrap, wooden-sword, cloth-vest, copper-ring,
        rusty-dagger, leather-helm, bone-focus, cord-amulet) or leave empty array.
        assets.sprite = "/assets/monsters/{id}.png".
        Language for name: Portuguese (Brazil) or English fantasy names ok.
        Do not invent player inventory. Content only.
        """;

    public async Task<MonsterDraftResult> DraftAsync(string description, CancellationToken ct)
    {
        var key = secrets.Value.OpenAiApiKey;
        if (string.IsNullOrWhiteSpace(key))
        {
            return MonsterDraftResult.Fail("OPENAI_API_KEY não configurada no backend.");
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return MonsterDraftResult.Fail("description é obrigatória.");
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
                temperature = 0.45,
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
                log.LogWarning("OpenAI monster draft HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                return MonsterDraftResult.Fail($"OpenAI HTTP {(int)res.StatusCode}");
            }

            using var doc = JsonDocument.Parse(raw);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return MonsterDraftResult.Fail("OpenAI retornou conteúdo vazio.");
            }

            using var monsterDoc = JsonDocument.Parse(content);
            var draft = Normalize(monsterDoc.RootElement, description.Trim());
            return MonsterDraftResult.Ok(draft);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Monster draft failed");
            return MonsterDraftResult.Fail(ex.Message);
        }
    }

    private static Dictionary<string, object?> Normalize(JsonElement root, string userPrompt)
    {
        var id = SanitizeId(GetString(root, "id") ?? "novo-monstro");

        var level = 1;
        if (root.TryGetProperty("level", out var lv) && lv.TryGetInt32(out var lvi) && lvi >= 1)
        {
            level = lvi;
        }

        var hp = 30.0;
        if (root.TryGetProperty("hp", out var hpEl) && hpEl.TryGetDouble(out var hpv) && hpv > 0)
        {
            hp = hpv;
        }

        var baseStats = ReadNumberMap(root, "baseStats", AllowedStats);
        if (baseStats.Count == 0)
        {
            // Legacy fallback from flat attack/defense if the model used them.
            if (root.TryGetProperty("attack", out var atk) && atk.TryGetDouble(out var atkv))
            {
                baseStats["dmgBase"] = atkv;
            }

            if (root.TryGetProperty("defense", out var def) && def.TryGetDouble(out var defv))
            {
                baseStats["defBase"] = defv;
            }

            if (baseStats.Count == 0)
            {
                baseStats["dmgBase"] = Math.Max(1, level * 2);
                baseStats["defBase"] = Math.Max(0, level);
            }
        }

        var bonusDefense = ReadNumberMap(root, "bonusDefense", allowed: null);

        var skills = new List<string>();
        if (root.TryGetProperty("skills", out var skillsEl) && skillsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var s in skillsEl.EnumerateArray())
            {
                if (s.ValueKind == JsonValueKind.String)
                {
                    var v = s.GetString();
                    if (!string.IsNullOrWhiteSpace(v))
                    {
                        skills.Add(v.Trim());
                    }
                }
            }
        }

        var behavior = GetString(root, "behavior") ?? "aggressive";
        if (!AllowedBehaviors.Contains(behavior))
        {
            behavior = "aggressive";
        }

        var skyMin = 1;
        var skyMax = 2;
        if (root.TryGetProperty("skyCoinDrop", out var sky) && sky.ValueKind == JsonValueKind.Array)
        {
            var arr = sky.EnumerateArray().ToList();
            if (arr.Count >= 1 && arr[0].TryGetInt32(out var a) && a >= 0)
            {
                skyMin = a;
            }

            if (arr.Count >= 2 && arr[1].TryGetInt32(out var b) && b >= 0)
            {
                skyMax = b;
            }

            if (skyMax < skyMin)
            {
                skyMax = skyMin;
            }
        }

        var rarityLuck = 0.0;
        if (root.TryGetProperty("rarityLuck", out var rl) && rl.TryGetDouble(out var rlv) && rlv >= 0)
        {
            rarityLuck = rlv;
        }

        var loot = new List<Dictionary<string, object?>>();
        if (root.TryGetProperty("loot", out var lootEl) && lootEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in lootEl.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var itemId = GetString(entry, "itemId");
                if (string.IsNullOrWhiteSpace(itemId))
                {
                    continue;
                }

                var chance = 0.1;
                if (entry.TryGetProperty("chance", out var ch) && ch.TryGetDouble(out var chv))
                {
                    chance = Math.Clamp(chv, 0, 1);
                }

                var qtyMin = 1;
                var qtyMax = 1;
                if (entry.TryGetProperty("qty", out var qty) && qty.ValueKind == JsonValueKind.Array)
                {
                    var q = qty.EnumerateArray().ToList();
                    if (q.Count >= 1 && q[0].TryGetInt32(out var qm) && qm >= 1)
                    {
                        qtyMin = qm;
                    }

                    if (q.Count >= 2 && q[1].TryGetInt32(out var qx) && qx >= 1)
                    {
                        qtyMax = qx;
                    }

                    if (qtyMax < qtyMin)
                    {
                        qtyMax = qtyMin;
                    }
                }

                loot.Add(new Dictionary<string, object?>
                {
                    ["itemId"] = SanitizeId(itemId),
                    ["chance"] = chance,
                    ["qty"] = new[] { qtyMin, qtyMax }
                });
            }
        }

        var name = GetString(root, "name") ?? id;
        var description = GetString(root, "description")?.Trim();
        if (string.IsNullOrWhiteSpace(description))
        {
            description = string.IsNullOrWhiteSpace(userPrompt) ? name : userPrompt;
        }

        return new Dictionary<string, object?>
        {
            ["id"] = id,
            ["name"] = name,
            ["description"] = description,
            ["level"] = level,
            ["hp"] = hp,
            ["baseStats"] = baseStats,
            ["bonusDefense"] = bonusDefense,
            ["skills"] = skills,
            ["behavior"] = behavior.ToLowerInvariant(),
            ["skyCoinDrop"] = new[] { skyMin, skyMax },
            ["rarityLuck"] = rarityLuck,
            ["loot"] = loot,
            ["assets"] = new Dictionary<string, object?>
            {
                ["sprite"] = $"/assets/monsters/{id}.png"
            }
        };
    }

    private static Dictionary<string, double> ReadNumberMap(
        JsonElement root,
        string prop,
        HashSet<string>? allowed)
    {
        var map = new Dictionary<string, double>(StringComparer.Ordinal);
        if (!root.TryGetProperty(prop, out var el) || el.ValueKind != JsonValueKind.Object)
        {
            return map;
        }

        foreach (var p in el.EnumerateObject())
        {
            if (allowed is not null && !allowed.Contains(p.Name))
            {
                continue;
            }

            if (p.Value.ValueKind == JsonValueKind.Number && p.Value.TryGetDouble(out var n))
            {
                var key = allowed is null ? p.Name : CanonicalStat(p.Name, allowed);
                map[key] = n;
            }
        }

        return map;
    }

    private static string CanonicalStat(string name, HashSet<string> allowed)
    {
        foreach (var a in allowed)
        {
            if (string.Equals(a, name, StringComparison.OrdinalIgnoreCase))
            {
                return a;
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
        return string.IsNullOrEmpty(id) ? "novo-monstro" : id;
    }
}

public sealed record MonsterDraftResult(bool Success, Dictionary<string, object?>? Draft, string? Error)
{
    public static MonsterDraftResult Ok(Dictionary<string, object?> draft) => new(true, draft, null);
    public static MonsterDraftResult Fail(string error) => new(false, null, error);
}
