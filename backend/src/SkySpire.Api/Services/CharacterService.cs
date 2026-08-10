using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;

namespace SkySpire.Api.Services;

public sealed class CharacterService(
    AppDbContext db,
    ContentService content,
    JsonSigningService signing,
    XpService xp,
    HpService hp,
    ItemRollService itemRoll,
    IOptions<AppSecretsOptions> secrets)
{
    public async Task<object> CreateAsync(
        Guid userId,
        string name,
        string raceId,
        string classId,
        CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new CharacterException("User not found.");

        if (!string.IsNullOrEmpty(user.CharacterJsonPath))
        {
            throw new CharacterException("Account already has a character.");
        }

        name = name.Trim();
        if (name.Length is < 2 or > 24)
        {
            throw new CharacterException("Name must be 2–24 characters.");
        }

        var race = await content.GetByIdAsync("races", raceId, ct)
            ?? throw new CharacterException("Race not found.");
        var classEl = await content.GetByIdAsync("classes", classId, ct)
            ?? throw new CharacterException("Class not found.");

        if (classEl.TryGetProperty("allowedRaces", out var allowed) &&
            allowed.ValueKind == JsonValueKind.Array)
        {
            var ok = allowed.EnumerateArray().Any(x =>
            {
                var s = x.GetString();
                return s == "*" || string.Equals(s, raceId, StringComparison.OrdinalIgnoreCase);
            });
            if (!ok)
            {
                throw new CharacterException("Class is not allowed for this race.");
            }
        }

        var dataRoot = secrets.Value.DataPath;
        Directory.CreateDirectory(Path.Combine(dataRoot, "characters"));
        Directory.CreateDirectory(Path.Combine(dataRoot, "bags"));

        var charFile = Path.Combine(dataRoot, "characters", $"{userId}.json");
        var bagFile = Path.Combine(dataRoot, "bags", $"{userId}.json");

        var baseStats = race.TryGetProperty("baseStats", out var statsEl)
            ? JsonNode.Parse(statsEl.GetRawText()) as JsonObject ?? new JsonObject()
            : new JsonObject();

        // Bônus de classe (legado hpRegenBonus) entra na semente uma vez na create.
        if (classEl.TryGetProperty("hpRegenBonus", out var classBonus) &&
            classBonus.ValueKind == JsonValueKind.Number)
        {
            var currentRegen = baseStats["hpRegenPerSec"]?.GetValueKind() == JsonValueKind.Number
                ? baseStats["hpRegenPerSec"]!.GetValue<double>()
                : 0;
            baseStats["hpRegenPerSec"] = currentRegen + classBonus.GetDouble();
        }

        var startingHp = 100.0;
        if (baseStats["hpBase"] is JsonNode hpNode &&
            hpNode.GetValueKind() == JsonValueKind.Number)
        {
            startingHp = hpNode.GetValue<double>();
        }

        var slots = race.TryGetProperty("equipmentSlots", out var eq)
            ? JsonNode.Parse(eq.GetRawText())
            : new JsonArray();

        var character = new JsonObject
        {
            ["id"] = userId.ToString(),
            ["name"] = name,
            ["raceId"] = raceId,
            ["classId"] = classId,
            ["level"] = 1,
            ["xp"] = 0,
            ["skyCoin"] = 0,
            ["baseStats"] = baseStats,
            ["equipmentSlots"] = slots,
            ["equipment"] = new JsonObject(),
            ["tower"] = new JsonObject
            {
                ["inTower"] = false,
                ["floor"] = 1,
                ["room"] = 1,
                ["maxUnlockedRoom"] = 1,
                ["autoClimb"] = false
            },
            ["currentHp"] = startingHp,
            ["lastHpAt"] = DateTimeOffset.UtcNow.ToString("O"),
            ["signature"] = null,
            ["createdAt"] = DateTimeOffset.UtcNow.ToString("O")
        };

        await hp.EnsureRegenSeedAsync(character, ct);

        var starterSword = await itemRoll.CreateFromTemplateAsync(
            "wooden-sword",
            Random.Shared,
            ct,
            itemLevel: 1,
            fixedStars: 1,
            fixedRarityId: 1);
        var starterScrap = await itemRoll.CreateMaterialSnapshotAsync("scrap", 2, ct);

        var bag = new JsonObject
        {
            ["id"] = userId.ToString(),
            ["ownerId"] = userId.ToString(),
            ["slotCount"] = 40,
            ["items"] = new JsonArray { starterSword, starterScrap },
            ["signature"] = null
        };

        signing.SignInPlace(character);
        signing.SignInPlace(bag);

        await File.WriteAllTextAsync(charFile, character.ToJsonString(ContentService.SerializerOptions), ct);
        await File.WriteAllTextAsync(bagFile, bag.ToJsonString(ContentService.SerializerOptions), ct);

        user.CharacterJsonPath = charFile;
        user.BagJsonPath = bagFile;
        await db.SaveChangesAsync(ct);

        return await GetMeAsync(userId, ct)
            ?? throw new CharacterException("Failed to load created character.");
    }

    public async Task<JsonElement?> GetRawCharacterAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
        {
            return null;
        }

        await using var stream = File.OpenRead(user.CharacterJsonPath);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return doc.RootElement.Clone();
    }

    public async Task<object?> GetMeAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
        {
            return null;
        }

        var (path, node) = await LoadMutableCharacterAsync(userId, ct);
        var snap = await hp.ApplyRegenAsync(node, ct);
        if (snap.Changed)
        {
            await SaveCharacterNodeAsync(path, node, ct);
        }

        var level = node["level"]?.GetValue<int>() ?? 1;

        return new
        {
            id = node["id"]?.GetValue<string>(),
            name = node["name"]?.GetValue<string>(),
            raceId = node["raceId"]?.GetValue<string>(),
            classId = node["classId"]?.GetValue<string>(),
            level,
            xp = node["xp"]?.GetValue<int>() ?? 0,
            xpToNextLevel = xp.XpRequiredForLevel(level),
            skyCoin = user.SkyCoin,
            currentHp = snap.CurrentHp,
            maxHp = snap.MaxHp,
            hpRegenPerSec = snap.HpRegenPerSec,
            baseStats = node["baseStats"] is JsonNode bs
                ? JsonSerializer.Deserialize<object>(bs.ToJsonString())
                : new { },
            hasCharacter = true
        };
    }

    /// <summary>
    /// Migra currentHp, sementes de baseStats (alvos do core), remove top-level hpRegenPerSec.
    /// </summary>
    public async Task<int> MigrateExistingCharactersHpAsync(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking()
            .Where(u => u.CharacterJsonPath != null && u.CharacterJsonPath != "")
            .ToListAsync(ct);

        var migrated = 0;
        foreach (var user in users)
        {
            if (string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
            {
                continue;
            }

            try
            {
                var (path, node) = await LoadMutableCharacterAsync(user.Id, ct);
                var snap = await hp.ApplyRegenAsync(node, ct);
                if (snap.Changed)
                {
                    await SaveCharacterNodeAsync(path, node, ct);
                    migrated++;
                }
            }
            catch
            {
                // Skip corrupt files.
            }
        }

        return migrated;
    }

    public async Task<JsonObject?> GetCharacterNodeAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
        {
            return null;
        }

        var text = await File.ReadAllTextAsync(user.CharacterJsonPath, ct);
        var node = JsonNode.Parse(text) as JsonObject;
        if (node is not null)
        {
            signing.EnsureValidOrThrow(node, "character");
        }

        return node;
    }

    public async Task<(string path, JsonObject node)> LoadMutableCharacterAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new CharacterException("User not found.");

        if (string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
        {
            throw new CharacterException("No character.");
        }

        var text = await File.ReadAllTextAsync(user.CharacterJsonPath, ct);
        var node = JsonNode.Parse(text) as JsonObject
            ?? throw new CharacterException("Invalid character file.");
        signing.EnsureValidOrThrow(node, "character");
        if (await ExpandEquipmentSnapshotsAsync(node, ct))
        {
            await SaveCharacterNodeAsync(user.CharacterJsonPath, node, ct);
        }

        return (user.CharacterJsonPath, node);
    }

    /// <summary>Converte equipment legado { itemId, qty } em snapshot bakeado.</summary>
    public async Task<bool> ExpandEquipmentSnapshotsAsync(JsonObject character, CancellationToken ct)
    {
        if (character["equipment"] is not JsonObject equipment)
        {
            return false;
        }

        var changed = false;
        foreach (var prop in equipment.ToList())
        {
            if (prop.Value is not JsonObject item)
            {
                continue;
            }

            var incomplete = item["stats"] is not JsonObject || item["instanceId"] is null;
            var missingColors = item["colorStart"] is not JsonObject || item["colorEnd"] is not JsonObject;
            if (!incomplete && !missingColors)
            {
                continue;
            }

            var expanded = await itemRoll.ExpandLegacyOrPassthroughAsync((JsonObject)item.DeepClone(), ct);
            if (ItemRollService.IsStackable(expanded))
            {
                continue;
            }

            equipment[prop.Key] = expanded;
            changed = true;
        }

        return changed;
    }

    public async Task SaveCharacterNodeAsync(string path, JsonObject node, CancellationToken ct)
    {
        signing.SignInPlace(node);
        await File.WriteAllTextAsync(path, node.ToJsonString(ContentService.SerializerOptions), ct);
    }

    public async Task<(string path, JsonObject bag)> LoadMutableBagAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new CharacterException("User not found.");
        if (string.IsNullOrEmpty(user.BagJsonPath) || !File.Exists(user.BagJsonPath))
        {
            throw new CharacterException("No bag.");
        }

        var text = await File.ReadAllTextAsync(user.BagJsonPath, ct);
        var bag = JsonNode.Parse(text) as JsonObject
            ?? throw new CharacterException("Invalid bag file.");
        signing.EnsureValidOrThrow(bag, "bag");
        var before = bag.ToJsonString();
        await NormalizeBagStacksAsync(bag, ct);
        if (!string.Equals(before, bag.ToJsonString(), StringComparison.Ordinal))
        {
            await SaveBagNodeAsync(user.BagJsonPath, bag, ct);
        }

        return (user.BagJsonPath, bag);
    }

    public async Task SaveBagNodeAsync(string path, JsonObject bag, CancellationToken ct)
    {
        await NormalizeBagStacksAsync(bag, ct);
        signing.SignInPlace(bag);
        await File.WriteAllTextAsync(path, bag.ToJsonString(ContentService.SerializerOptions), ct);
    }

    private async Task NormalizeBagStacksAsync(JsonObject bag, CancellationToken ct)
    {
        var items = bag["items"] as JsonArray ?? new JsonArray();
        var normalized = new JsonArray();
        var stacks = new Dictionary<string, JsonObject>(StringComparer.Ordinal);

        foreach (var node in items)
        {
            if (node is not JsonObject raw)
            {
                if (node is not null)
                {
                    normalized.Add(node.DeepClone());
                }

                continue;
            }

            var item = await itemRoll.ExpandLegacyOrPassthroughAsync((JsonObject)raw.DeepClone(), ct);
            var quantity = item["qty"]?.GetValue<int>() ?? 1;
            if (quantity <= 0)
            {
                continue;
            }

            // Equipamentos únicos nunca empilham.
            if (!ItemRollService.IsStackable(item))
            {
                item["qty"] = 1;
                normalized.Add(item);
                continue;
            }

            var fingerprint = BuildItemFingerprint(item);
            if (stacks.TryGetValue(fingerprint, out var existing))
            {
                existing["qty"] = (existing["qty"]?.GetValue<int>() ?? 1) + quantity;
                continue;
            }

            var stack = (JsonObject)item.DeepClone();
            stack["qty"] = quantity;
            stacks[fingerprint] = stack;
            normalized.Add(stack);
        }

        bag["items"] = normalized;
    }

    private static string BuildItemFingerprint(JsonObject item)
    {
        var comparable = new JsonObject();
        foreach (var property in item)
        {
            if (property.Key is "id" or "itemId" or "instanceId" or "qty" or "signature" or "createdAt")
            {
                continue;
            }

            comparable[property.Key] = property.Value?.DeepClone();
        }

        if (comparable.Count == 0)
        {
            comparable["unresolvedItemId"] = ItemRollService.ResolveTemplateId(item);
        }

        return Canonicalize(comparable);
    }

    private static string Canonicalize(JsonNode? node)
    {
        if (node is JsonObject obj)
        {
            return "{" + string.Join(",", obj
                .OrderBy(property => property.Key, StringComparer.Ordinal)
                .Select(property =>
                    JsonSerializer.Serialize(property.Key) + ":" + Canonicalize(property.Value))) + "}";
        }

        if (node is JsonArray array)
        {
            return "[" + string.Join(",", array.Select(Canonicalize)) + "]";
        }

        return node?.ToJsonString() ?? "null";
    }
}

public sealed class CharacterException(string message) : Exception(message);
