using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Drop raro de item único: semente do loot do mob → flavor OpenAI → bake → ícone PixelLab.
/// Só escreve na bag (+ PNG em data/assets/items); nunca em content/items.
/// </summary>
public sealed class UniqueItemDropService(
    ContentService content,
    ItemRollService itemRoll,
    RarityService rarities,
    PixelLabService pixellab,
    GameConfigService gameConfig,
    IHttpClientFactory httpFactory,
    IOptions<AppSecretsOptions> secrets,
    ILogger<UniqueItemDropService> log)
{
    public sealed record UniqueDropResult(JsonObject Snapshot, string Label);

    /// <summary>
    /// Nome composto: <c>{títuloTemático} de {personagem}</c>.
    /// </summary>
    public static string ComposeUniqueName(string thematicTitle, string characterName)
    {
        var theme = CollapseSpaces(thematicTitle).Trim().TrimEnd('.');
        var who = CollapseSpaces(characterName).Trim();
        if (string.IsNullOrWhiteSpace(who))
        {
            who = "Herói";
        }

        if (string.IsNullOrWhiteSpace(theme))
        {
            theme = "Relíquia";
        }

        // Evita "… de Nome de Nome" se a IA já incluiu o personagem.
        if (theme.EndsWith($" de {who}", StringComparison.OrdinalIgnoreCase) ||
            theme.EndsWith($" De {who}", StringComparison.OrdinalIgnoreCase))
        {
            return CapitalizeWords(theme);
        }

        return CapitalizeWords($"{theme} de {who}");
    }

    /// <summary>
    /// Escolhe um template gear (não-stackable) da tabela loot, ponderado pela chance.
    /// </summary>
    public async Task<string?> TryPickGearSeedIdAsync(
        JsonElement monster,
        Random rng,
        CancellationToken ct)
    {
        if (!monster.TryGetProperty("loot", out var loot) || loot.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var weighted = new List<(string Id, double Weight)>();
        foreach (var entry in loot.EnumerateArray())
        {
            var templateId = entry.TryGetProperty("itemId", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(templateId))
            {
                continue;
            }

            var chance = entry.TryGetProperty("chance", out var c) && c.ValueKind == JsonValueKind.Number
                ? Math.Clamp(c.GetDouble(), 0, 1)
                : 0;
            if (chance <= 0)
            {
                continue;
            }

            var template = await content.GetByIdAsync("items", templateId, ct);
            if (template is null)
            {
                continue;
            }

            var stackable = template.Value.TryGetProperty("stackable", out var st) &&
                            st.ValueKind == JsonValueKind.True;
            if (stackable)
            {
                continue;
            }

            weighted.Add((templateId, chance));
        }

        if (weighted.Count == 0)
        {
            return null;
        }

        var total = weighted.Sum(w => w.Weight);
        var roll = rng.NextDouble() * total;
        var acc = 0.0;
        foreach (var (id, weight) in weighted)
        {
            acc += weight;
            if (roll <= acc)
            {
                return id;
            }
        }

        return weighted[^1].Id;
    }

    public bool ShouldAttemptUnique(Random rng)
    {
        var bal = gameConfig.GetBalance();
        if (!bal.UniqueDropEnabled || bal.UniqueDropChance <= 0)
        {
            return false;
        }

        return rng.NextDouble() < bal.UniqueDropChance;
    }

    /// <summary>
    /// Cria snapshot único a partir da semente. Null = falhou (caller faz loot normal da semente).
    /// </summary>
    public async Task<UniqueDropResult?> TryCreateUniqueAsync(
        string seedItemId,
        JsonElement monster,
        JsonElement floor,
        JsonObject character,
        Random rng,
        CancellationToken ct)
    {
        var bal = gameConfig.GetBalance();
        var openAiKey = secrets.Value.OpenAiApiKey;
        if (string.IsNullOrWhiteSpace(openAiKey))
        {
            log.LogDebug("Unique drop skipped: OPENAI_API_KEY missing");
            return null;
        }

        var template = await content.GetByIdAsync("items", seedItemId, ct);
        if (template is null)
        {
            return null;
        }

        var stackable = template.Value.TryGetProperty("stackable", out var st) &&
                        st.ValueKind == JsonValueKind.True;
        if (stackable)
        {
            return null;
        }

        var itemLevel = 1;
        if (floor.TryGetProperty("itemLevel", out var il) && il.ValueKind == JsonValueKind.Number)
        {
            itemLevel = Math.Max(1, il.GetInt32());
        }
        else if (floor.TryGetProperty("number", out var floorNum) && floorNum.ValueKind == JsonValueKind.Number)
        {
            itemLevel = Math.Max(1, floorNum.GetInt32());
        }

        var playerName = character["name"]?.GetValue<string>()?.Trim() ?? "Herói";
        var monsterName = monster.TryGetProperty("name", out var mn) ? mn.GetString() ?? "monstro" : "monstro";
        var monsterId = monster.TryGetProperty("id", out var mid) ? mid.GetString() ?? "" : "";
        var floorName = floor.TryGetProperty("name", out var fn) ? fn.GetString() ?? "" : "";
        var floorNumber = floor.TryGetProperty("number", out var fnum) && fnum.ValueKind == JsonValueKind.Number
            ? fnum.GetInt32()
            : itemLevel;

        var seedName = template.Value.TryGetProperty("name", out var sn) ? sn.GetString() ?? seedItemId : seedItemId;
        var seedType = template.Value.TryGetProperty("type", out var ty) ? ty.GetString() ?? "weapon" : "weapon";
        var seedDesc = template.Value.TryGetProperty("description", out var sd) ? sd.GetString() ?? "" : "";

        FlavorDraft? flavor;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(bal.UniqueOpenAiTimeoutMs);
            flavor = await RequestFlavorAsync(
                openAiKey,
                seedName,
                seedType,
                seedDesc,
                monsterName,
                monsterId,
                floorName,
                floorNumber,
                cts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            log.LogWarning("Unique OpenAI timeout after {Ms}ms", bal.UniqueOpenAiTimeoutMs);
            return null;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Unique OpenAI flavor failed");
            return null;
        }

        if (flavor is null)
        {
            return null;
        }

        var rarity = await rarities.PickAsync(
            rng,
            ct,
            rarityLuck: 0,
            chanceMult: bal.UniqueRarityChanceMult);

        var stars = Math.Clamp(bal.UniqueStars, 1, 5);
        JsonObject snap;
        try
        {
            snap = await itemRoll.CreateFromTemplateAsync(
                seedItemId,
                rng,
                ct,
                itemLevel,
                fixedStars: stars,
                fixedRarityId: rarity.Id);
        }
        catch (ItemRollException ex)
        {
            log.LogWarning(ex, "Unique bake failed for seed {Seed}", seedItemId);
            return null;
        }

        var composed = ComposeUniqueName(flavor.ThematicTitle, playerName);
        snap["name"] = composed;
        snap["description"] = Truncate(flavor.Description, 280);
        if (!string.IsNullOrWhiteSpace(flavor.Lore))
        {
            snap["lore"] = Truncate(flavor.Lore, 500);
        }

        snap["unique"] = true;
        snap["seedItemId"] = seedItemId;
        snap["generatedBy"] = "openai+pixellab";
        snap["templateId"] = seedItemId;

        var instanceId = snap["instanceId"]?.GetValue<string>() ?? Guid.NewGuid().ToString("N");
        snap["instanceId"] = instanceId;

        var iconFile = $"unique-{SanitizeFileToken(instanceId)}.png";
        var artPrompt = string.IsNullOrWhiteSpace(flavor.ArtPrompt)
            ? $"{composed}. {flavor.Description}"
            : flavor.ArtPrompt;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(bal.UniquePixelLabTimeoutMs);
            var iconPath = await pixellab.GenerateAndCommitUniqueItemIconAsync(
                iconFile,
                composed,
                artPrompt,
                seedType,
                cts.Token);
            if (iconPath is not null)
            {
                snap["assets"] = new JsonObject { ["icon"] = iconPath };
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            log.LogWarning("Unique PixelLab timeout; keeping template/placeholder icon");
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Unique PixelLab icon failed; keeping template icon");
        }

        var rarityName = snap["rarityName"]?.GetValue<string>() ?? rarity.Name;
        var label = $"{composed} Lv{itemLevel} [{rarityName} {stars}★] (Único)";
        return new UniqueDropResult(snap, label);
    }

    private async Task<FlavorDraft?> RequestFlavorAsync(
        string apiKey,
        string seedName,
        string seedType,
        string seedDesc,
        string monsterName,
        string monsterId,
        string floorName,
        int floorNumber,
        CancellationToken ct)
    {
        var client = httpFactory.CreateClient("openai");
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var system = """
            You flavor a UNIQUE SkySpire loot item. Return ONLY JSON with keys:
            thematicTitle (string), description (string), lore (string, optional), artPrompt (string).
            thematicTitle: Portuguese title like "Espada de ossos" or "Elmo musgoso" — include item kind + monster theme.
            Do NOT include the player/character name in thematicTitle (server appends it).
            Do NOT invent rarity, stars, stats, multiplier, or item ids.
            description: 1 short PT-BR sentence. lore: 1-2 short PT-BR sentences optional.
            artPrompt: English pixel-art inventory icon prompt, single object, transparent background.
            """;

        var user =
            $"Seed item: {seedName} (type={seedType}). Seed description: {seedDesc}. " +
            $"Monster: {monsterName} (id={monsterId}). Floor: {floorNumber} {floorName}.";

        var body = new
        {
            model = "gpt-4o-mini",
            response_format = new { type = "json_object" },
            temperature = 0.7,
            messages = new object[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user }
            }
        };
        req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        using var res = await client.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            log.LogWarning("Unique OpenAI HTTP {Status}: {Body}", (int)res.StatusCode, raw);
            return null;
        }

        using var doc = JsonDocument.Parse(raw);
        var contentStr = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
        if (string.IsNullOrWhiteSpace(contentStr))
        {
            return null;
        }

        using var flavorDoc = JsonDocument.Parse(contentStr);
        var root = flavorDoc.RootElement;
        var title = GetString(root, "thematicTitle") ?? GetString(root, "title");
        var description = GetString(root, "description");
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(description))
        {
            // Fallback tema mínimo a partir do tipo + monstro
            title = $"{TypeLabelPt(seedType)} de {monsterName}";
            description ??= seedDesc;
            if (string.IsNullOrWhiteSpace(description))
            {
                description = $"Relíquia única nascida de {monsterName}.";
            }
        }

        return new FlavorDraft(
            Truncate(title!, 80),
            Truncate(description!, 280),
            Truncate(GetString(root, "lore") ?? "", 500),
            Truncate(GetString(root, "artPrompt") ?? "", 400));
    }

    private static string TypeLabelPt(string type) =>
        type.ToLowerInvariant() switch
        {
            "weapon" => "Arma",
            "helmet" => "Elmo",
            "armor" => "Armadura",
            "shield" => "Escudo",
            "ring" => "Anel",
            "amulet" => "Amuleto",
            "focus" => "Foco",
            _ => "Relíquia"
        };

    private static string? GetString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static string Truncate(string s, int max)
    {
        s = CollapseSpaces(s).Trim();
        if (s.Length <= max)
        {
            return s;
        }

        return s[..max].TrimEnd();
    }

    private static string CollapseSpaces(string s) =>
        Regex.Replace(s, @"\s+", " ");

    private static string CapitalizeWords(string s)
    {
        var parts = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < parts.Length; i++)
        {
            var p = parts[i];
            if (i > 0 && p.Equals("de", StringComparison.OrdinalIgnoreCase))
            {
                parts[i] = "de";
                continue;
            }

            if (p.Length == 0)
            {
                continue;
            }

            parts[i] = char.ToUpper(p[0], CultureInfo.GetCultureInfo("pt-BR")) +
                       (p.Length > 1 ? p[1..] : "");
        }

        return string.Join(' ', parts);
    }

    private static string SanitizeFileToken(string s)
    {
        var chars = s.Where(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_').ToArray();
        return chars.Length == 0 ? Guid.NewGuid().ToString("N") : new string(chars);
    }

    private sealed record FlavorDraft(
        string ThematicTitle,
        string Description,
        string Lore,
        string ArtPrompt);
}
