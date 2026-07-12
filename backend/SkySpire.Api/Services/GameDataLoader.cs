using System.Text.Json;
using System.Text.Json.Nodes;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class GameDataLoader(IWebHostEnvironment environment)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    private readonly string _gameDataRoot = Path.Combine(environment.ContentRootPath, "GameData");
    private IReadOnlyDictionary<string, ArchetypeDefinition>? _races;
    private IReadOnlyDictionary<string, ArchetypeDefinition>? _classes;
    private IReadOnlyDictionary<string, ItemDefinition>? _items;
    private IReadOnlyDictionary<string, MobDefinition>? _mobs;
    private IReadOnlyDictionary<int, TowerFloorDefinition>? _towerFloors;
    private JsonObject? _baseCategories;
    private IReadOnlyDictionary<string, RarityDefinition>? _rarities;
    private IReadOnlyDictionary<string, AffixDefinition>? _affixes;
    private IReadOnlyDictionary<string, ItemTypeDefinition>? _itemTypes;
    private IReadOnlyDictionary<string, LootPoolDefinition>? _lootPools;
    private MobLootProfile? _defaultMobLoot;
    private string? _defaultLootPoolId;
    private IReadOnlyList<string>? _proceduralPrefixes;
    private IReadOnlyDictionary<string, string>? _proceduralNameLabels;

    public IReadOnlyDictionary<string, ArchetypeDefinition> Races =>
        _races ??= LoadArchetypes(Path.Combine(_gameDataRoot, "races"));

    public IReadOnlyDictionary<string, ArchetypeDefinition> Classes =>
        _classes ??= LoadArchetypes(Path.Combine(_gameDataRoot, "classes"));

    public IReadOnlyDictionary<string, ItemDefinition> Items =>
        _items ??= LoadItems(Path.Combine(_gameDataRoot, "items"));

    public IReadOnlyDictionary<string, MobDefinition> Mobs =>
        _mobs ??= LoadMobs(Path.Combine(_gameDataRoot, "mobs"));

    public IReadOnlyDictionary<int, TowerFloorDefinition> TowerFloors =>
        _towerFloors ??= LoadTowerFloors(Path.Combine(_gameDataRoot, "tower"));

    public JsonObject BaseCategories =>
        _baseCategories ??= LoadBaseCategories();

    public IReadOnlyDictionary<string, RarityDefinition> Rarities =>
        _rarities ??= LoadRarities();

    public IReadOnlyDictionary<string, AffixDefinition> Affixes =>
        _affixes ??= LoadAffixes();

    public IReadOnlyDictionary<string, ItemTypeDefinition> ItemTypes =>
        _itemTypes ??= LoadItemTypes();

    public IReadOnlyDictionary<string, LootPoolDefinition> LootPools =>
        _lootPools ??= LoadLootPools();

    public MobLootProfile DefaultMobLoot =>
        _defaultMobLoot ??= LoadDefaultMobLoot();

    public string DefaultLootPoolId =>
        _defaultLootPoolId ??= LoadDefaultLootPoolId();

    public IReadOnlyList<string> ProceduralPrefixes =>
        _proceduralPrefixes ??= LoadProceduralPrefixes();

    public IReadOnlyDictionary<string, string> ProceduralNameLabels =>
        _proceduralNameLabels ??= LoadProceduralNameLabels();

    public ArchetypeDefinition? GetRace(string raceId) =>
        Races.GetValueOrDefault(raceId);

    public ArchetypeDefinition? GetClass(string classId) =>
        Classes.GetValueOrDefault(classId);

    public ItemDefinition? GetItem(string itemId) =>
        Items.GetValueOrDefault(itemId);

    public void RegisterItem(ItemDefinition item)
    {
        _ = Items;
        if (_items is Dictionary<string, ItemDefinition> dict)
            dict[item.Id] = item;
    }

    public IReadOnlyList<ItemDefinition> FindItemsByKind(string itemKind, string? classId = null)
    {
        _ = Items;
        return Items.Values
            .Where(item => string.Equals(item.ItemKind, itemKind, StringComparison.OrdinalIgnoreCase))
            .Where(item =>
                classId is null ||
                item.Classes.Count == 0 ||
                item.Classes.Contains(classId, StringComparer.OrdinalIgnoreCase))
            .ToList();
    }

    public void RegisterProceduralPrefix(string prefix)
    {
        _ = ProceduralPrefixes;
        if (_proceduralPrefixes is List<string> list && !list.Contains(prefix, StringComparer.OrdinalIgnoreCase))
            list.Add(prefix);
    }

    public MobDefinition? GetMob(string mobId) =>
        Mobs.GetValueOrDefault(mobId);

    public TowerFloorDefinition? GetTowerFloor(int floor)
    {
        if (floor < 1 || TowerFloors.Count == 0)
            return null;

        if (TowerFloors.TryGetValue(floor, out var exact))
            return exact;

        var templateFloors = TowerFloors.Keys.Order().ToList();
        var templateFloor = templateFloors[(floor - 1) % templateFloors.Count];
        var template = TowerFloors[templateFloor];

        return ScaleFloorForTarget(template, floor);
    }

    private IReadOnlyDictionary<string, ArchetypeDefinition> LoadArchetypes(string folder)
    {
        if (!Directory.Exists(folder))
            throw new DirectoryNotFoundException($"Game data folder not found: {folder}");

        var result = new Dictionary<string, ArchetypeDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in Directory.GetFiles(folder, "*.json"))
        {
            var json = File.ReadAllText(file);
            var node = JsonNode.Parse(json)?.AsObject()
                ?? throw new InvalidDataException($"Invalid JSON in {file}");

            var id = node["id"]?.GetValue<string>()
                ?? throw new InvalidDataException($"Missing id in {file}");

            var categories = node["categories"]?.AsObject()
                ?? throw new InvalidDataException($"Missing categories in {file}");

            var equipmentSlots = node["equipmentSlots"]?.AsArray()
                ?.Select(s => s?.GetValue<string>())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!)
                .ToList();

            if (equipmentSlots is null or { Count: 0 })
                equipmentSlots = EquipmentSlotDefaults.Standard.ToList();

            result[id] = new ArchetypeDefinition
            {
                Id = id,
                Name = node["name"]?.GetValue<string>() ?? id,
                Description = node["description"]?.GetValue<string>(),
                Assets = node["assets"]?.AsObject(),
                Categories = categories,
                EquipmentSlots = equipmentSlots,
            };
        }

        return result;
    }

    private JsonObject LoadBaseCategories()
    {
        var path = Path.Combine(_gameDataRoot, "base-character.json");
        var json = File.ReadAllText(path);
        var node = JsonNode.Parse(json)?.AsObject()
            ?? throw new InvalidDataException($"Invalid base character JSON: {path}");

        return node["categories"]?.AsObject()
            ?? throw new InvalidDataException($"Missing categories in {path}");
    }

    private IReadOnlyDictionary<string, ItemDefinition> LoadItems(string folder)
    {
        if (!Directory.Exists(folder))
            return new Dictionary<string, ItemDefinition>(StringComparer.OrdinalIgnoreCase);

        var result = new Dictionary<string, ItemDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in Directory.GetFiles(folder, "*.json", SearchOption.AllDirectories))
        {
            var json = File.ReadAllText(file);
            var node = JsonNode.Parse(json)?.AsObject()
                ?? throw new InvalidDataException($"Invalid JSON in {file}");

            var id = node["id"]?.GetValue<string>()
                ?? throw new InvalidDataException($"Missing id in {file}");

            var classes = node["classes"]?.AsArray()
                ?.Select(c => c?.GetValue<string>() ?? "")
                .Where(c => c.Length > 0)
                .ToList() ?? [];

            result[id] = new ItemDefinition
            {
                Id = id,
                Name = node["name"]?.GetValue<string>() ?? id,
                Description = node["description"]?.GetValue<string>(),
                Type = node["type"]?.GetValue<string>() ?? "misc",
                ItemKind = node["itemKind"]?.GetValue<string>(),
                Slot = node["slot"]?.GetValue<string>(),
                Rarity = node["rarity"]?.GetValue<string>() ?? "common",
                Level = node["level"]?.GetValue<int>() ?? 1,
                Classes = classes,
                Stackable = node["stackable"]?.GetValue<bool>() ?? false,
                MaxStack = node["maxStack"]?.GetValue<int>() ?? 1,
                Categories = node["categories"]?.AsObject() ?? new JsonObject(),
                Assets = node["assets"]?.AsObject(),
            };
        }

        return result;
    }

    private IReadOnlyDictionary<string, MobDefinition> LoadMobs(string folder)
    {
        if (!Directory.Exists(folder))
            return new Dictionary<string, MobDefinition>(StringComparer.OrdinalIgnoreCase);

        var result = new Dictionary<string, MobDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in Directory.GetFiles(folder, "*.json"))
        {
            var json = File.ReadAllText(file);
            var node = JsonNode.Parse(json)?.AsObject()
                ?? throw new InvalidDataException($"Invalid JSON in {file}");

            var mob = ParseMob(node, file);
            result[mob.Id] = mob;
        }

        return result;
    }

    private IReadOnlyDictionary<int, TowerFloorDefinition> LoadTowerFloors(string folder)
    {
        if (!Directory.Exists(folder))
            return new Dictionary<int, TowerFloorDefinition>();

        var result = new Dictionary<int, TowerFloorDefinition>();

        foreach (var file in Directory.GetFiles(folder, "floor-*.json"))
        {
            var json = File.ReadAllText(file);
            var node = JsonNode.Parse(json)?.AsObject()
                ?? throw new InvalidDataException($"Invalid JSON in {file}");

            var floor = node["floor"]?.GetValue<int>()
                ?? throw new InvalidDataException($"Missing floor in {file}");

            var mobPool = node["mobPool"]?.AsArray()
                ?.Select(item => ResolveMobReference(item, file))
                .ToList() ?? [];

            var bossId = node["boss"]?.GetValue<string>()
                ?? throw new InvalidDataException($"Missing boss in {file}");

            var boss = ResolveMob(bossId, file);

            result[floor] = new TowerFloorDefinition
            {
                Floor = floor,
                Name = node["name"]?.GetValue<string>() ?? $"Andar {floor}",
                OwnerId = node["ownerId"]?.GetValue<string>(),
                OwnerName = node["ownerName"]?.GetValue<string>(),
                MobCount = node["mobCount"]?.GetValue<int>() ?? 10,
                MobPool = mobPool,
                Boss = boss,
                LootPool = node["lootPool"]?.GetValue<string>(),
            };
        }

        return result;
    }

    private MobDefinition ResolveMobReference(JsonNode? node, string sourceFile)
    {
        if (node is null)
            throw new InvalidDataException($"Invalid mob reference in {sourceFile}");

        var mobId = node.GetValue<string>();
        return ResolveMob(mobId, sourceFile);
    }

    private MobDefinition ResolveMob(string mobId, string sourceFile)
    {
        if (Mobs.TryGetValue(mobId, out var mob))
            return mob;

        throw new InvalidDataException($"Mob '{mobId}' not found (referenced in {sourceFile})");
    }

    private static MobDefinition ParseMob(JsonObject node, string? sourceFile = null) =>
        new()
        {
            Id = node["id"]?.GetValue<string>()
                ?? throw new InvalidDataException($"Missing id in {sourceFile ?? "mob"}"),
            Name = node["name"]?.GetValue<string>() ?? "Mob",
            Level = node["level"]?.GetValue<int>() ?? 1,
            Hp = node["hp"]?.GetValue<int>() ?? 100,
            Attack = node["attack"]?.GetValue<int>() ?? 10,
            Defense = node["defense"]?.GetValue<int>() ?? 5,
            Xp = node["xp"]?.GetValue<int>() ?? 10,
            Gold = node["gold"]?.GetValue<int>() ?? 5,
            Assets = node["assets"]?.AsObject(),
            Loot = ParseMobLoot(node["loot"]?.AsObject()),
        };

    private static MobLootProfile? ParseMobLoot(JsonObject? node)
    {
        if (node is null)
            return null;

        var weights = node["rarityWeights"]?.AsObject();
        if (weights is null || weights.Count == 0)
            return null;

        var rarityWeights = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in weights)
        {
            if (value is null)
                continue;

            rarityWeights[key] = value.GetValue<double>();
        }

        return new MobLootProfile
        {
            DropChance = node["dropChance"]?.GetValue<double>() ?? 0.1,
            RarityWeights = rarityWeights,
        };
    }

    private static TowerFloorDefinition ScaleFloorForTarget(TowerFloorDefinition template, int targetFloor)
    {
        if (template.Floor == targetFloor)
            return template;

        var scale = 1.0 + (targetFloor - 1) * 0.12;
        var levelBonus = targetFloor - template.Floor;

        return new TowerFloorDefinition
        {
            Floor = targetFloor,
            Name = $"{template.Name} · Nv. {targetFloor}",
            OwnerId = template.OwnerId,
            OwnerName = template.OwnerName,
            MobCount = template.MobCount,
            MobPool = template.MobPool
                .Select(mob => ScaleMob(mob, scale, levelBonus))
                .ToList(),
            Boss = ScaleMob(template.Boss, scale, levelBonus),
            LootPool = template.LootPool,
        };
    }

    private static MobDefinition ScaleMob(MobDefinition mob, double scale, int levelBonus) =>
        new()
        {
            Id = mob.Id,
            Name = mob.Name,
            Level = mob.Level + levelBonus,
            Hp = Math.Max(1, (int)Math.Round(mob.Hp * scale)),
            Attack = Math.Max(1, (int)Math.Round(mob.Attack * scale)),
            Defense = Math.Max(0, (int)Math.Round(mob.Defense * scale)),
            Xp = Math.Max(1, (int)Math.Round(mob.Xp * scale)),
            Gold = Math.Max(1, (int)Math.Round(mob.Gold * scale)),
            Assets = mob.Assets,
            Loot = mob.Loot,
        };

    private IReadOnlyDictionary<string, RarityDefinition> LoadRarities()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "rarities.json");
        var node = ReadRequiredObject(path);
        var raritiesNode = node["rarities"]?.AsObject()
            ?? throw new InvalidDataException($"Missing rarities in {path}");

        var result = new Dictionary<string, RarityDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (var (id, value) in raritiesNode)
        {
            if (value is not JsonObject rarityNode)
                continue;

            var affixRolls = rarityNode["affixRolls"]?.AsArray();
            var rollMin = affixRolls?[0]?.GetValue<int>() ?? 0;
            var rollMax = affixRolls?.Count > 1
                ? affixRolls[1]?.GetValue<int>() ?? rollMin
                : rollMin;

            result[id] = new RarityDefinition
            {
                Order = rarityNode["order"]?.GetValue<int>() ?? 0,
                BaseStatMultiplier = rarityNode["baseStatMultiplier"]?.GetValue<double>() ?? 1,
                AffixRollMin = rollMin,
                AffixRollMax = rollMax,
                Label = rarityNode["label"]?.GetValue<string>() ?? id,
            };
        }

        return result;
    }

    private IReadOnlyDictionary<string, AffixDefinition> LoadAffixes()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "additional-stats.json");
        var node = ReadRequiredObject(path);
        var affixesNode = node["affixes"]?.AsObject()
            ?? throw new InvalidDataException($"Missing affixes in {path}");

        var result = new Dictionary<string, AffixDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (var (id, value) in affixesNode)
        {
            if (value is not JsonObject affixNode)
                continue;

            var range = affixNode["range"]?.AsObject();
            result[id] = new AffixDefinition
            {
                Id = id,
                Label = affixNode["label"]?.GetValue<string>() ?? id,
                CategoryPath = affixNode["categoryPath"]?.GetValue<string>()
                    ?? throw new InvalidDataException($"Missing categoryPath for affix {id}"),
                Formula = affixNode["formula"]?.GetValue<string>() ?? "uniform",
                RangeMin = range?["min"]?.GetValue<int>() ?? 1,
                RangeMax = range?["max"]?.GetValue<int>() ?? 1,
                RarityRangeStep = affixNode["rarityRangeStep"]?.GetValue<int>() ?? 0,
                Suffix = affixNode["suffix"]?.GetValue<string>(),
            };
        }

        return result;
    }

    private IReadOnlyDictionary<string, ItemTypeDefinition> LoadItemTypes()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "item-types.json");
        var node = ReadRequiredObject(path);
        var typesNode = node["types"]?.AsObject()
            ?? throw new InvalidDataException($"Missing types in {path}");

        var result = new Dictionary<string, ItemTypeDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (var (id, value) in typesNode)
        {
            if (value is not JsonObject typeNode)
                continue;

            var classes = typeNode["classes"]?.AsArray()
                ?.Select(c => c?.GetValue<string>() ?? "")
                .Where(c => c.Length > 0)
                .ToList() ?? [];

            var affixPool = typeNode["affixPool"]?.AsArray()
                ?.Select(item =>
                {
                    if (item is not JsonObject entry)
                        return null;

                    var affixId = entry["affixId"]?.GetValue<string>();
                    if (string.IsNullOrWhiteSpace(affixId))
                        return null;

                    return new AffixPoolEntry
                    {
                        AffixId = affixId,
                        Weight = entry["weight"]?.GetValue<double>() ?? 1,
                    };
                })
                .Where(entry => entry is not null)
                .Select(entry => entry!)
                .ToList() ?? [];

            result[id] = new ItemTypeDefinition
            {
                Id = id,
                Slot = typeNode["slot"]?.GetValue<string>(),
                Classes = classes,
                BaseCategories = typeNode["baseCategories"]?.AsObject() ?? new JsonObject(),
                AffixPool = affixPool,
            };
        }

        return result;
    }

    private IReadOnlyDictionary<string, LootPoolDefinition> LoadLootPools()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "loot-pools.json");
        var node = ReadRequiredObject(path);
        var poolsNode = node["pools"]?.AsObject()
            ?? throw new InvalidDataException($"Missing pools in {path}");

        var result = new Dictionary<string, LootPoolDefinition>(StringComparer.OrdinalIgnoreCase);
        foreach (var (id, value) in poolsNode)
        {
            if (value is not JsonObject poolNode)
                continue;

            var entries = poolNode["entries"]?.AsArray()
                ?.Select(item =>
                {
                    if (item is not JsonObject entry)
                        return null;

                    var itemId = entry["itemId"]?.GetValue<string>();
                    var itemKind = entry["itemKind"]?.GetValue<string>();
                    if (string.IsNullOrWhiteSpace(itemId) && string.IsNullOrWhiteSpace(itemKind))
                        return null;

                    return new LootPoolEntry
                    {
                        ItemId = itemId,
                        ItemKind = itemKind,
                        Weight = entry["weight"]?.GetValue<double>() ?? 1,
                        GenerateIfMissing = entry["generateIfMissing"]?.GetValue<bool>() ?? false,
                    };
                })
                .Where(entry => entry is not null)
                .Select(entry => entry!)
                .ToList() ?? [];

            result[id] = new LootPoolDefinition
            {
                Id = id,
                Entries = entries,
            };
        }

        return result;
    }

    private MobLootProfile LoadDefaultMobLoot()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "default-mob-loot.json");
        var node = ReadRequiredObject(path);
        return ParseMobLoot(node)
            ?? throw new InvalidDataException($"Invalid default mob loot: {path}");
    }

    private string LoadDefaultLootPoolId()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "loot-pools.json");
        var node = ReadRequiredObject(path);
        return node["defaultPool"]?.GetValue<string>() ?? "floor-1";
    }

    private IReadOnlyList<string> LoadProceduralPrefixes()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "procedural-names.json");
        var node = ReadRequiredObject(path);
        return node["prefixes"]?.AsArray()
            ?.Select(p => p?.GetValue<string>() ?? "")
            .Where(p => p.Length > 0)
            .ToList() ?? [];
    }

    private IReadOnlyDictionary<string, string> LoadProceduralNameLabels()
    {
        var path = Path.Combine(_gameDataRoot, "loot", "procedural-names.json");
        var node = ReadRequiredObject(path);
        var labels = node["kindLabels"]?.AsObject();
        if (labels is null)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        return labels.ToDictionary(
            pair => pair.Key,
            pair => pair.Value?.GetValue<string>() ?? pair.Key,
            StringComparer.OrdinalIgnoreCase);
    }

    private JsonObject ReadRequiredObject(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"Game data file not found: {path}");

        var json = File.ReadAllText(path);
        return JsonNode.Parse(json)?.AsObject()
            ?? throw new InvalidDataException($"Invalid JSON in {path}");
    }
}
