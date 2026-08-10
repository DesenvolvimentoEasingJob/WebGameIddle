using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Drafts a floor package (floor + monsters + items) from a creator prompt via OpenAI.
/// Never writes files — caller (editor) reviews and applies.
/// </summary>
public sealed class FloorDraftService(
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ContentService content,
    ILogger<FloorDraftService> log)
{
    private static readonly HashSet<string> AllowedItemTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "weapon", "helmet", "armor", "ring", "amulet", "focus", "material", "shield"
    };

    private static readonly HashSet<string> AllowedItemStats = new(StringComparer.OrdinalIgnoreCase)
    {
        "dmgBase", "defBase", "hpBase", "mpBase", "capBase", "attackSpeed",
        "critChance", "critDamage", "dodgeChance", "hpRegenPerSec"
    };

    private static readonly HashSet<string> AllowedMonsterStats = new(StringComparer.OrdinalIgnoreCase)
    {
        "dmgBase", "defBase", "critChance", "critDamage", "dodgeChance", "attackSpeed"
    };

    private static readonly HashSet<string> AllowedBehaviors = new(StringComparer.OrdinalIgnoreCase)
    {
        "aggressive", "defensive", "passive", "skittish"
    };

    private const string SystemPrompt = """
        You design SkySpire CONTENT for one tower floor from the creator's vision prompt.
        Enhance the theme/name/description but stay faithful to the prompt — do not invent unrelated lore.
        Return ONLY a JSON object with keys: floor, monsters, items.

        floor: { id (floor-NN), number, name, description, theme, difficulty, itemLevel,
          rooms: exactly 9 entries { number 1..9, type:"wave", monsterIds:string[] },
          boss: { monsterId, gateFee, registryFee, attrMult },
          ownerPlayerId: null, ownerSnapshotPath: null,
          assets: { background: "/api/assets/floors/floor-NN.png" } }
        description: 2–4 sentences in Portuguese (Brazil) focused on VISUAL art direction —
        architecture, lighting, color palette, materials, atmosphere (for background image gen).
        monsterIds = spawn list: length = enemy count (1–4), each entry is one fighter
        (repeat id for same type, or mix types). Prefer denser groups on rooms 3/6/9.

        monsters: array of 3–6 templates (include exactly one boss). Each:
          id (kebab-case), name, description (PT-BR, 1–3 sentences with visual cues),
          level, hp, baseStats (dmgBase/defBase preferred), bonusDefense (object),
          skills ([]), behavior (aggressive|defensive|passive|skittish),
          skyCoinDrop [min,max], rarityLuck, loot [{itemId, chance 0..1, qty:[min,max]}],
          assets.sprite "/assets/monsters/{id}.png"

        items: array of 2–5 templates that fit the floor theme. Each:
          id, name, description (PT-BR), type (weapon|helmet|armor|ring|amulet|focus|material|shield),
          itemLevel, stackable (true only for material without combat stats),
          stats (modest numbers; empty for materials), assets.icon "/assets/items/{id}.png"

        Rules:
        - rooms must reference monster ids from monsters[] (reuse farm mobs across rooms).
        - boss.monsterId must be the boss monster id from monsters[].
        - loot itemIds should mostly come from items[] in this package; you may also reuse known existing item ids listed in the user message.
        - Scale stats/fees roughly with floor number / itemLevel.
        - Language for names/descriptions: Portuguese (Brazil). Fantasy English ids ok.
        - Content only — no player inventory, no economy accounts.
        """;

    public async Task<FloorDraftResult> DraftAsync(
        string description,
        int? floorNumber,
        int? itemLevel,
        CancellationToken ct)
    {
        var key = secrets.Value.OpenAiApiKey;
        if (string.IsNullOrWhiteSpace(key))
        {
            return FloorDraftResult.Fail("OPENAI_API_KEY não configurada no backend.");
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return FloorDraftResult.Fail("description é obrigatória.");
        }

        var n = Math.Clamp(floorNumber ?? 1, 1, 99);
        var ilvl = Math.Clamp(itemLevel ?? n, 1, 99);

        try
        {
            var knownItems = await ListIdsAsync("items", ct);
            var knownMonsters = await ListIdsAsync("monsters", ct);

            var userMsg = $"""
                Floor number: {n}
                Preferred itemLevel: {ilvl}
                Creator prompt:
                {description.Trim()}

                Existing item ids (may reuse in loot): {string.Join(", ", knownItems.Take(80))}
                Existing monster ids (for awareness; prefer NEW ids for this floor): {string.Join(", ", knownMonsters.Take(80))}
                """;

            var client = httpFactory.CreateClient("openai");
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            var body = new
            {
                model = "gpt-4o-mini",
                response_format = new { type = "json_object" },
                temperature = 0.5,
                messages = new object[]
                {
                    new { role = "system", content = SystemPrompt },
                    new { role = "user", content = userMsg }
                }
            };
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await client.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("OpenAI floor draft HTTP {Status}: {Body}", (int)res.StatusCode, raw);
                return FloorDraftResult.Fail($"OpenAI HTTP {(int)res.StatusCode}");
            }

            using var doc = JsonDocument.Parse(raw);
            var contentJson = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(contentJson))
            {
                return FloorDraftResult.Fail("OpenAI retornou conteúdo vazio.");
            }

            using var packDoc = JsonDocument.Parse(contentJson);
            var package = NormalizePackage(packDoc.RootElement, n, ilvl, description.Trim());
            return FloorDraftResult.Ok(package);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Floor draft failed");
            return FloorDraftResult.Fail(ex.Message);
        }
    }

    private async Task<List<string>> ListIdsAsync(string folder, CancellationToken ct)
    {
        var list = await content.ListAsync(folder, ct);
        var ids = new List<string>();
        foreach (var el in list)
        {
            if (el.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String)
            {
                var id = idEl.GetString();
                if (!string.IsNullOrWhiteSpace(id))
                {
                    ids.Add(id);
                }
            }
        }

        ids.Sort(StringComparer.OrdinalIgnoreCase);
        return ids;
    }

    private static Dictionary<string, object?> NormalizePackage(
        JsonElement root,
        int floorNumber,
        int itemLevel,
        string userPrompt)
    {
        var items = new List<Dictionary<string, object?>>();
        var itemIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in itemsEl.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var item = NormalizeItem(el, itemLevel);
                var id = (string)item["id"]!;
                if (itemIds.Add(id))
                {
                    items.Add(item);
                }
            }
        }

        if (items.Count == 0)
        {
            var scrapId = $"floor-{floorNumber:D2}-scrap";
            var scrap = new Dictionary<string, object?>
            {
                ["id"] = scrapId,
                ["name"] = "Sucata do andar",
                ["description"] = "Resíduo temático gerado para o pacote do andar.",
                ["type"] = "material",
                ["itemLevel"] = itemLevel,
                ["stackable"] = true,
                ["stats"] = new Dictionary<string, double>(),
                ["assets"] = new Dictionary<string, object?>
                {
                    ["icon"] = $"/assets/items/{scrapId}.png"
                }
            };
            items.Add(scrap);
            itemIds.Add(scrapId);
        }

        var monsters = new List<Dictionary<string, object?>>();
        var monsterIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (root.TryGetProperty("monsters", out var monstersEl) && monstersEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in monstersEl.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var monster = NormalizeMonster(el, floorNumber, itemIds, userPrompt);
                var id = (string)monster["id"]!;
                if (monsterIds.Add(id))
                {
                    monsters.Add(monster);
                }
            }
        }

        if (monsters.Count == 0)
        {
            monsters.Add(FallbackMonster($"floor-{floorNumber:D2}-mob", floorNumber, itemIds, isBoss: false));
            monsters.Add(FallbackMonster($"floor-{floorNumber:D2}-boss", floorNumber, itemIds, isBoss: true));
            monsterIds.Add($"floor-{floorNumber:D2}-mob");
            monsterIds.Add($"floor-{floorNumber:D2}-boss");
        }
        else if (monsters.Count == 1)
        {
            var bossOnly = monsters[0];
            var farm = FallbackMonster($"floor-{floorNumber:D2}-mob", floorNumber, itemIds, isBoss: false);
            monsters.Insert(0, farm);
            monsterIds.Add((string)farm["id"]!);
            _ = bossOnly;
        }

        var bossMonsterId = PickBossId(root, monsters);
        var floor = NormalizeFloor(root, floorNumber, itemLevel, monsterIds, bossMonsterId, userPrompt);

        return new Dictionary<string, object?>
        {
            ["floor"] = floor,
            ["monsters"] = monsters,
            ["items"] = items
        };
    }

    private static string PickBossId(JsonElement root, List<Dictionary<string, object?>> monsters)
    {
        if (root.TryGetProperty("floor", out var floorEl) &&
            floorEl.ValueKind == JsonValueKind.Object &&
            floorEl.TryGetProperty("boss", out var bossEl) &&
            bossEl.ValueKind == JsonValueKind.Object)
        {
            var mid = GetString(bossEl, "monsterId");
            if (!string.IsNullOrWhiteSpace(mid))
            {
                var sanitized = SanitizeId(mid);
                if (monsters.Any(m => string.Equals((string)m["id"]!, sanitized, StringComparison.OrdinalIgnoreCase)))
                {
                    return sanitized;
                }
            }
        }

        return (string)monsters[^1]["id"]!;
    }

    private static Dictionary<string, object?> NormalizeFloor(
        JsonElement root,
        int floorNumber,
        int itemLevel,
        HashSet<string> monsterIds,
        string bossMonsterId,
        string userPrompt)
    {
        JsonElement floorEl = default;
        var hasFloor = root.TryGetProperty("floor", out floorEl) && floorEl.ValueKind == JsonValueKind.Object;

        var id = $"floor-{floorNumber:D2}";
        var name = hasFloor ? GetString(floorEl, "name") : null;
        var description = hasFloor ? GetString(floorEl, "description") : null;
        var theme = hasFloor ? GetString(floorEl, "theme") : null;

        if (string.IsNullOrWhiteSpace(name))
        {
            name = $"Andar {floorNumber}";
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            description = userPrompt;
        }

        if (string.IsNullOrWhiteSpace(theme))
        {
            theme = "custom";
        }

        var difficulty = floorNumber;
        if (hasFloor && floorEl.TryGetProperty("difficulty", out var diff) && diff.TryGetInt32(out var di) && di >= 1)
        {
            difficulty = di;
        }

        var ilvl = itemLevel;
        if (hasFloor && floorEl.TryGetProperty("itemLevel", out var il) && il.TryGetInt32(out var ili) && ili >= 1)
        {
            ilvl = ili;
        }

        var farmIds = monsterIds
            .Where(m => !string.Equals(m, bossMonsterId, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (farmIds.Count == 0)
        {
            farmIds.Add(bossMonsterId);
        }

        var rooms = new List<Dictionary<string, object?>>();
        var roomMap = new Dictionary<int, List<string>>();

        if (hasFloor && floorEl.TryGetProperty("rooms", out var roomsEl) && roomsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var room in roomsEl.EnumerateArray())
            {
                if (room.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (!room.TryGetProperty("number", out var numEl) || !numEl.TryGetInt32(out var num) || num is < 1 or > 9)
                {
                    continue;
                }

                var ids = new List<string>();
                if (room.TryGetProperty("monsterIds", out var mids) && mids.ValueKind == JsonValueKind.Array)
                {
                    foreach (var mid in mids.EnumerateArray())
                    {
                        if (mid.ValueKind != JsonValueKind.String)
                        {
                            continue;
                        }

                        var sid = SanitizeId(mid.GetString() ?? "");
                        if (monsterIds.Contains(sid))
                        {
                            ids.Add(sid);
                        }
                    }
                }

                roomMap[num] = ids;
            }
        }

        for (var i = 1; i <= 9; i++)
        {
            var ids = roomMap.TryGetValue(i, out var existing) && existing.Count > 0
                ? existing
                : new List<string> { farmIds[(i - 1) % farmIds.Count] };

            rooms.Add(new Dictionary<string, object?>
            {
                ["number"] = i,
                ["type"] = "wave",
                ["monsterIds"] = ids
            });
        }

        var gateFee = 50 * floorNumber;
        var registryFee = 100 * floorNumber;
        var attrMult = 10;
        if (hasFloor && floorEl.TryGetProperty("boss", out var bossEl) && bossEl.ValueKind == JsonValueKind.Object)
        {
            if (bossEl.TryGetProperty("gateFee", out var gf) && gf.TryGetInt32(out var gfi) && gfi >= 0)
            {
                gateFee = gfi;
            }

            if (bossEl.TryGetProperty("registryFee", out var rf) && rf.TryGetInt32(out var rfi) && rfi >= 0)
            {
                registryFee = rfi;
            }

            if (bossEl.TryGetProperty("attrMult", out var am) && am.TryGetInt32(out var ami) && ami >= 1)
            {
                attrMult = ami;
            }
        }

        return new Dictionary<string, object?>
        {
            ["id"] = id,
            ["number"] = floorNumber,
            ["name"] = name,
            ["description"] = description,
            ["theme"] = theme,
            ["difficulty"] = difficulty,
            ["itemLevel"] = ilvl,
            ["rooms"] = rooms,
            ["boss"] = new Dictionary<string, object?>
            {
                ["monsterId"] = bossMonsterId,
                ["gateFee"] = gateFee,
                ["registryFee"] = registryFee,
                ["attrMult"] = attrMult
            },
            ["ownerPlayerId"] = null,
            ["ownerSnapshotPath"] = null,
            ["assets"] = new Dictionary<string, object?>
            {
                ["background"] = $"/api/assets/floors/floor-{floorNumber:D2}.png"
            }
        };
    }

    private static Dictionary<string, object?> NormalizeItem(JsonElement root, int defaultItemLevel)
    {
        var id = SanitizeId(GetString(root, "id") ?? "novo-item");
        var type = GetString(root, "type") ?? "material";
        if (!AllowedItemTypes.Contains(type))
        {
            type = "material";
        }

        var stats = new Dictionary<string, double>(StringComparer.Ordinal);
        if (root.TryGetProperty("stats", out var statsEl) && statsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in statsEl.EnumerateObject())
            {
                if (!AllowedItemStats.Contains(prop.Name))
                {
                    continue;
                }

                if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDouble(out var n))
                {
                    stats[Canonical(prop.Name, AllowedItemStats)] = n;
                }
            }
        }

        var stackable = root.TryGetProperty("stackable", out var st) && st.ValueKind == JsonValueKind.True;
        if (string.Equals(type, "material", StringComparison.OrdinalIgnoreCase) && stats.Count == 0)
        {
            stackable = true;
        }

        if (stackable && stats.Count > 0)
        {
            stackable = false;
        }

        var itemLevel = defaultItemLevel;
        if (root.TryGetProperty("itemLevel", out var il) && il.TryGetInt32(out var ili) && ili >= 1)
        {
            itemLevel = ili;
        }

        return new Dictionary<string, object?>
        {
            ["id"] = id,
            ["name"] = GetString(root, "name") ?? id,
            ["description"] = GetString(root, "description") ?? "",
            ["type"] = type.ToLowerInvariant(),
            ["itemLevel"] = itemLevel,
            ["stackable"] = stackable,
            ["stats"] = stats,
            ["assets"] = new Dictionary<string, object?>
            {
                ["icon"] = $"/assets/items/{id}.png"
            }
        };
    }

    private static Dictionary<string, object?> NormalizeMonster(
        JsonElement root,
        int floorNumber,
        HashSet<string> packageItemIds,
        string userPrompt)
    {
        var id = SanitizeId(GetString(root, "id") ?? "novo-monstro");

        var level = Math.Max(1, floorNumber);
        if (root.TryGetProperty("level", out var lv) && lv.TryGetInt32(out var lvi) && lvi >= 1)
        {
            level = lvi;
        }

        var hp = 30.0 * Math.Max(1, floorNumber);
        if (root.TryGetProperty("hp", out var hpEl) && hpEl.TryGetDouble(out var hpv) && hpv > 0)
        {
            hp = hpv;
        }

        var baseStats = ReadNumberMap(root, "baseStats", AllowedMonsterStats);
        if (baseStats.Count == 0)
        {
            baseStats["dmgBase"] = Math.Max(1, level * 2);
            baseStats["defBase"] = Math.Max(0, level);
        }

        var bonusDefense = ReadNumberMap(root, "bonusDefense", allowed: null);

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

                var sid = SanitizeId(itemId);
                // Prefer package items; still allow known ids (scrap etc.) by keeping sanitized id.
                var chance = 0.15;
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
                    ["itemId"] = sid,
                    ["chance"] = chance,
                    ["qty"] = new[] { qtyMin, qtyMax }
                });
            }
        }

        if (loot.Count == 0 && packageItemIds.Count > 0)
        {
            loot.Add(new Dictionary<string, object?>
            {
                ["itemId"] = packageItemIds.First(),
                ["chance"] = 0.2,
                ["qty"] = new[] { 1, 1 }
            });
        }

        var name = GetString(root, "name") ?? id;
        var description = GetString(root, "description")?.Trim();
        if (string.IsNullOrWhiteSpace(description))
        {
            description = userPrompt;
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
            ["skills"] = new List<string>(),
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

    private static Dictionary<string, object?> FallbackMonster(
        string id,
        int floorNumber,
        HashSet<string> packageItemIds,
        bool isBoss)
    {
        var loot = new List<Dictionary<string, object?>>();
        if (packageItemIds.Count > 0)
        {
            loot.Add(new Dictionary<string, object?>
            {
                ["itemId"] = packageItemIds.First(),
                ["chance"] = isBoss ? 0.8 : 0.25,
                ["qty"] = new[] { 1, isBoss ? 2 : 1 }
            });
        }

        return new Dictionary<string, object?>
        {
            ["id"] = id,
            ["name"] = isBoss ? $"Chefe do andar {floorNumber}" : $"Habitante do andar {floorNumber}",
            ["description"] = isBoss
                ? "Chefe gerado automaticamente a partir do prompt do andar."
                : "Monstro de farm gerado automaticamente a partir do prompt do andar.",
            ["level"] = Math.Max(1, floorNumber + (isBoss ? 2 : 0)),
            ["hp"] = isBoss ? 120.0 * floorNumber : 40.0 * floorNumber,
            ["baseStats"] = new Dictionary<string, double>
            {
                ["dmgBase"] = Math.Max(1, floorNumber * (isBoss ? 4 : 2)),
                ["defBase"] = Math.Max(0, floorNumber * (isBoss ? 2 : 1))
            },
            ["bonusDefense"] = new Dictionary<string, double>(),
            ["skills"] = new List<string>(),
            ["behavior"] = "aggressive",
            ["skyCoinDrop"] = isBoss ? new[] { 8, 15 } : new[] { 1, 3 },
            ["rarityLuck"] = isBoss ? 1.5 : 0.0,
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
                map[allowed is null ? p.Name : Canonical(p.Name, allowed)] = n;
            }
        }

        return map;
    }

    private static string Canonical(string name, HashSet<string> allowed)
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
        return string.IsNullOrEmpty(id) ? "novo" : id;
    }
}

public sealed record FloorDraftResult(bool Success, Dictionary<string, object?>? Package, string? Error)
{
    public static FloorDraftResult Ok(Dictionary<string, object?> package) => new(true, package, null);
    public static FloorDraftResult Fail(string error) => new(false, null, error);
}
