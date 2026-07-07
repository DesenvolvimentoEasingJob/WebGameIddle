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

    public ArchetypeDefinition? GetRace(string raceId) =>
        Races.GetValueOrDefault(raceId);

    public ArchetypeDefinition? GetClass(string classId) =>
        Classes.GetValueOrDefault(classId);

    public ItemDefinition? GetItem(string itemId) =>
        Items.GetValueOrDefault(itemId);

    public MobDefinition? GetMob(string mobId) =>
        Mobs.GetValueOrDefault(mobId);

    public TowerFloorDefinition? GetTowerFloor(int floor) =>
        TowerFloors.GetValueOrDefault(floor);

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

        foreach (var file in Directory.GetFiles(folder, "*.json"))
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
        };
}
