using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;

namespace SkySpire.Api.Services;

public sealed class TowerService(
    ContentService content,
    CharacterService characters,
    CombatService combat,
    EconomyService economy,
    OwnershipService ownership,
    StatsService stats,
    XpService xpService,
    HpService hp,
    AppDbContext db,
    GameConfigService gameConfig)
{
    /// <summary>Room 10 is the boss gate: reachable only through the paid challenge.</summary>
    public const int BossRoom = 10;

    /// <summary>Auto-climb loops rooms 1–9; it never leaves the current floor.</summary>
    public static int NextRoomAfterVictory(int room) => room + 1 >= BossRoom ? 1 : room + 1;

    /// <summary>Only a won boss challenge opens the next floor, capped by available content.</summary>
    public static int UnlockedFloorAfterBossWin(int currentMax, int floor, int floorCount) =>
        Math.Max(currentMax, Math.Min(floorCount, floor + 1));

    /// <summary>
    /// Cleared floors (below the progression frontier) reopen with all rooms + boss gate.
    /// The current frontier floor always restarts from room 1.
    /// </summary>
    public static int RoomUnlockOnEnter(int floor, int maxUnlockedFloor) =>
        floor < maxUnlockedFloor ? BossRoom : 1;

    public Task<IReadOnlyList<JsonElement>> ListFloorsAsync(CancellationToken ct) =>
        content.ListAsync("floors", ct);

    public async Task<JsonElement?> GetFloorAsync(int number, CancellationToken ct)
    {
        var id = $"floor-{number:D2}";
        return await content.GetByIdAsync("floors", id, ct);
    }

    public Task<object?> GetOwnershipAsync(int floor, CancellationToken ct) =>
        ownership.GetPublicAsync(floor, ct);

    public async Task<TowerStateDto> GetStateAsync(Guid userId, CancellationToken ct)
    {
        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();
        var maxFloor = await ResolveMaxUnlockedFloorAsync(userId, tower, ct);
        tower["maxUnlockedFloor"] = maxFloor;

        // Cleared floors always expose rooms 1–9 + boss after reload / older saves.
        var floor = tower["floor"]?.GetValue<int>() ?? 1;
        var minRooms = RoomUnlockOnEnter(floor, maxFloor);
        var maxRoom = tower["maxUnlockedRoom"]?.GetValue<int>() ?? 1;
        var roomsFixed = false;
        if (minRooms > maxRoom)
        {
            tower["maxUnlockedRoom"] = minRooms;
            roomsFixed = true;
        }

        node["tower"] = tower;

        var snap = await hp.ApplyRegenAsync(node, ct);
        if (snap.Changed || roomsFixed)
        {
            await characters.SaveCharacterNodeAsync(path, node, ct);
        }

        return await ToDtoAsync(tower, node, null, snap, ct);
    }

    public async Task<TowerStateDto> EnterAsync(Guid userId, int floor, CancellationToken ct)
    {
        if (floor < 1)
        {
            throw new TowerException("Floor must be 1 or higher.");
        }

        var floorJson = await GetFloorAsync(floor, ct)
            ?? throw new TowerException("Floor not found.");

        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();

        var maxFloor = await ResolveMaxUnlockedFloorAsync(userId, tower, ct);
        if (floor > maxFloor)
        {
            throw new TowerException($"Floor {floor} is locked. Beat the floor {maxFloor} boss challenge first.");
        }

        tower["inTower"] = true;
        tower["floor"] = floor;
        tower["room"] = 1;
        tower["maxUnlockedRoom"] = RoomUnlockOnEnter(floor, maxFloor);
        tower["maxUnlockedFloor"] = maxFloor;
        tower["floorName"] = floorJson.GetProperty("name").GetString();
        node["tower"] = tower;

        var snap = await hp.ApplyRegenAsync(node, ct);
        await characters.SaveCharacterNodeAsync(path, node, ct);
        return await ToDtoAsync(tower, node, floorJson, snap, ct);
    }

    public async Task<TowerStateDto> SetAutoClimbAsync(Guid userId, bool enabled, CancellationToken ct)
    {
        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();
        tower["autoClimb"] = enabled;
        node["tower"] = tower;
        var snap = await hp.ApplyRegenAsync(node, ct);
        await characters.SaveCharacterNodeAsync(path, node, ct);
        return await ToDtoAsync(tower, node, null, snap, ct);
    }

    public async Task<TowerStateDto> MoveAsync(Guid userId, int room, CancellationToken ct)
    {
        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();

        if (tower["inTower"]?.GetValue<bool>() != true)
        {
            throw new TowerException("Not in the tower.");
        }

        var max = tower["maxUnlockedRoom"]?.GetValue<int>() ?? 1;
        if (room < 1 || room > max || room > BossRoom)
        {
            throw new TowerException("Room not unlocked.");
        }

        // Room 10 is preview/position only — combat still goes through the paid challenge.
        tower["room"] = room;
        node["tower"] = tower;
        var snap = await hp.ApplyRegenAsync(node, ct);
        await characters.SaveCharacterNodeAsync(path, node, ct);
        return await ToDtoAsync(tower, node, null, snap, ct);
    }

    public async Task<BattleResultDto> StartBattleAsync(Guid userId, CancellationToken ct)
    {
        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();

        if (tower["inTower"]?.GetValue<bool>() != true)
        {
            throw new TowerException("Not in the tower.");
        }

        var floor = tower["floor"]?.GetValue<int>() ?? 1;
        var room = tower["room"]?.GetValue<int>() ?? 1;

        if (room >= BossRoom)
        {
            throw new TowerException("Boss room: use the paid boss challenge instead of a normal battle.");
        }

        var floorJson = await GetFloorAsync(floor, ct)
            ?? throw new TowerException("Floor not found.");

        var result = await combat.ResolveRoomBattleAsync(userId, node, floorJson, room, ct);

        if (result.Victory)
        {
            var max = tower["maxUnlockedRoom"]?.GetValue<int>() ?? 1;
            var nextUnlock = Math.Min(BossRoom, room + 1);
            if (nextUnlock > max)
            {
                tower["maxUnlockedRoom"] = nextUnlock;
            }

            // Auto-climb farms rooms 1–9 of the current floor; only the paid boss
            // challenge moves the player to the next floor.
            if (result.AutoAdvanceRoom)
            {
                tower["room"] = NextRoomAfterVictory(room);
            }

            node["tower"] = tower;
        }

        await characters.SaveCharacterNodeAsync(path, node, ct);

        long coinsGained = 0;
        long? skyCoin = null;
        IReadOnlyList<BattleEventDto> events = result.Events;
        if (result.Victory)
        {
            coinsGained = result.MonsterSkyCoinDefined
                ? result.CoinsGained
                : economy.BattleRewardForFloor(floor);
            if (coinsGained > 0)
            {
                skyCoin = await economy.CreditAsync(
                    userId,
                    coinsGained,
                    "battle_reward",
                    $"floor-{floor}-room-{room}",
                    ct);
                node["skyCoin"] = skyCoin;
                var withCoins = result.Events.ToList();
                withCoins.Add(new BattleEventDto(
                    "coins",
                    "player",
                    null,
                    (int)coinsGained,
                    $"+{coinsGained} SkyCoin"));
                events = withCoins;
            }
            else
            {
                skyCoin = await economy.GetBalanceAsync(userId, ct);
            }
        }
        else
        {
            skyCoin = await economy.GetBalanceAsync(userId, ct);
        }

        await stats.RecordProgressAsync(userId, node, killsDelta: result.Victory ? 1 : 0, ct);

        var snap = await SnapshotHpAsync(node, ct);
        var state = await ToDtoAsync(tower, node, floorJson, snap, ct);
        return result with
        {
            Events = events,
            State = state,
            CoinsGained = coinsGained,
            SkyCoin = skyCoin
        };
    }

    /// <summary>
    /// Progression gate (Game-base §2): pay <c>boss.gateFee</c>, fight the floor boss with its normal
    /// attributes. Winning opens the next floor. Ownership is a separate, harder fight.
    /// </summary>
    public Task<BattleResultDto> ChallengeBossAsync(Guid userId, CancellationToken ct) =>
        RunChallengeAsync(userId, ChallengeKind.Progression, ct);

    /// <summary>
    /// Name registration (Game-base §2): its own fee (<c>boss.registryFee</c>), and the boss has
    /// ×<c>boss.attrMult</c> attributes — or is the clone of the current owner. Winning registers the floor.
    /// </summary>
    public Task<BattleResultDto> ChallengeRegistryAsync(Guid userId, CancellationToken ct) =>
        RunChallengeAsync(userId, ChallengeKind.Registry, ct);

    private async Task<BattleResultDto> RunChallengeAsync(Guid userId, ChallengeKind kind, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new TowerException("User not found.");

        var (path, node) = await characters.LoadMutableCharacterAsync(userId, ct);
        var tower = node["tower"] as JsonObject ?? DefaultTower();

        if (tower["inTower"]?.GetValue<bool>() != true)
        {
            throw new TowerException("Not in the tower.");
        }

        var floor = tower["floor"]?.GetValue<int>() ?? 1;
        var maxRoom = tower["maxUnlockedRoom"]?.GetValue<int>() ?? 1;
        if (maxRoom < BossRoom)
        {
            throw new TowerException("Clear rooms 1–9 of this floor before challenging the boss.");
        }

        var maxFloor = await ResolveMaxUnlockedFloorAsync(userId, tower, ct);
        tower["maxUnlockedFloor"] = maxFloor;
        tower["room"] = BossRoom;
        node["tower"] = tower;

        var existing = await ownership.GetAsync(floor, ct);
        if (kind == ChallengeKind.Registry && existing is not null && existing.OwnerUserId == userId)
        {
            throw new TowerException("You already own this floor.");
        }

        var floorJson = await GetFloorAsync(floor, ct)
            ?? throw new TowerException("Floor not found.");

        var b = gameConfig.GetBalance();
        var rules = ReadRules(floorJson);
        var isRegistry = kind == ChallengeKind.Registry;
        var fee = isRegistry ? rules.RegistryFee : rules.GateFee;

        if (fee > 0)
        {
            await economy.EnsureCanAffordAsync(userId, fee, ct);
            await economy.DebitAsync(
                userId,
                fee,
                isRegistry ? "floor_registry_fee" : "boss_gate_fee",
                $"floor-{floor}",
                ct);
        }

        // The floor owner earns a share of every boss fee paid on their floor.
        if (fee > 0 && existing is not null && existing.OwnerUserId != userId)
        {
            var share = Math.Max(1, (long)Math.Floor(fee * b.FloorOwnerFeeShare));
            if (share > 0 && share <= fee)
            {
                await economy.CreditAsync(
                    existing.OwnerUserId,
                    share,
                    "ownership_share",
                    $"floor-{floor}-from-{user.Username}",
                    ct);
            }
        }

        JsonObject? clone = null;
        var attrMult = 1.0;
        if (isRegistry)
        {
            attrMult = rules.RegistryAttrMult;
            clone = existing is not null ? await ownership.LoadSnapshotAsync(floor, ct) : null;
        }

        var result = await combat.ResolveChallengeBattleAsync(
            userId,
            node,
            floorJson,
            attrMult,
            clone,
            ct);

        var events = result.Events.ToList();
        if (fee > 0)
        {
            events.Insert(0, new BattleEventDto(
                "fee",
                "system",
                null,
                (int)fee,
                isRegistry ? $"-{fee} SkyCoin registry fee" : $"-{fee} SkyCoin boss gate fee"));
        }

        if (result.Victory)
        {
            if (isRegistry)
            {
                await ownership.WriteSnapshotAsync(userId, user.Username, node, floor, ct);
                events.Add(new BattleEventDto(
                    "ownership",
                    "system",
                    null,
                    floor,
                    $"You registered floor {floor}!"));
            }

            var floorCount = await FloorCountAsync(ct);
            var unlocked = UnlockedFloorAfterBossWin(maxFloor, floor, floorCount);
            if (unlocked > maxFloor)
            {
                tower["maxUnlockedFloor"] = unlocked;
                events.Add(new BattleEventDto(
                    "floor_unlocked",
                    "system",
                    null,
                    unlocked,
                    $"Floor {unlocked} unlocked!"));
            }

            node["tower"] = tower;
        }

        await characters.SaveCharacterNodeAsync(path, node, ct);
        long coinsGained = 0;
        long? skyCoin;
        if (result.Victory)
        {
            coinsGained = result.MonsterSkyCoinDefined
                ? result.CoinsGained
                : economy.BattleRewardForFloor(floor);
            if (coinsGained > 0)
            {
                skyCoin = await economy.CreditAsync(
                    userId,
                    coinsGained,
                    isRegistry ? "registry_battle_reward" : "boss_battle_reward",
                    $"floor-{floor}",
                    ct);
                events.Add(new BattleEventDto(
                    "coins",
                    "player",
                    null,
                    (int)coinsGained,
                    $"+{coinsGained} SkyCoin"));
            }
            else
            {
                skyCoin = await economy.GetBalanceAsync(userId, ct);
            }
        }
        else
        {
            skyCoin = await economy.GetBalanceAsync(userId, ct);
        }

        node["skyCoin"] = skyCoin;
        await stats.RecordProgressAsync(userId, node, killsDelta: result.Victory ? 1 : 0, ct);
        await stats.RefreshFloorsOwnedAsync(userId, ct);
        if (existing is not null)
        {
            await stats.RefreshFloorsOwnedAsync(existing.OwnerUserId, ct);
        }

        return result with
        {
            Events = events,
            State = await ToDtoAsync(tower, node, floorJson, await SnapshotHpAsync(node, ct), ct),
            CoinsGained = coinsGained,
            SkyCoin = skyCoin
        };
    }

    private async Task<int> FloorCountAsync(CancellationToken ct)
    {
        var floors = await content.ListAsync("floors", ct);
        return Math.Max(1, floors.Count);
    }

    /// <summary>
    /// Progress gate. Characters created before the boss gate existed have no
    /// <c>maxUnlockedFloor</c>, so floors already registered via ownership backfill it.
    /// </summary>
    private async Task<int> ResolveMaxUnlockedFloorAsync(Guid userId, JsonObject tower, CancellationToken ct)
    {
        var stored = tower["maxUnlockedFloor"]?.GetValue<int>() ?? 1;

        var ownedFloors = await db.FloorOwnerships
            .AsNoTracking()
            .Where(x => x.OwnerUserId == userId)
            .Select(x => x.FloorNumber)
            .ToListAsync(ct);

        var fromOwnership = ownedFloors.Count == 0 ? 1 : ownedFloors.Max() + 1;
        var floorCount = await FloorCountAsync(ct);
        return Math.Clamp(Math.Max(stored, fromOwnership), 1, floorCount);
    }

    private static JsonObject DefaultTower() => new()
    {
        ["inTower"] = false,
        ["floor"] = 1,
        ["room"] = 1,
        ["maxUnlockedRoom"] = 1,
        ["maxUnlockedFloor"] = 1,
        ["autoClimb"] = false,
        ["floorName"] = null
    };

    private async Task<HpSnapshot> SnapshotHpAsync(JsonObject character, CancellationToken ct)
    {
        await hp.EnsureRegenSeedAsync(character, ct);
        var maxHp = await hp.GetMaxHpAsync(character, ct);
        var rate = await hp.ResolveRegenRatePerSecAsync(character, ct);
        var current = character["currentHp"]?.GetValue<double>() ?? maxHp;
        return new HpSnapshot(
            HpService.RoundHp(Math.Clamp(current, 0, maxHp)),
            HpService.RoundHp(maxHp),
            0,
            rate,
            false);
    }

    /// <summary>
    /// Fees shown to the client must be the ones the current floor actually charges, so the
    /// floor JSON is read here too. <paramref name="floorJson"/> avoids a reload when the
    /// caller already has it.
    /// </summary>
    private async Task<TowerStateDto> ToDtoAsync(
        JsonObject tower,
        JsonObject character,
        JsonElement? floorJson,
        HpSnapshot hpSnap,
        CancellationToken ct)
    {
        var floor = tower["floor"]?.GetValue<int>() ?? 1;
        var room = tower["room"]?.GetValue<int>() ?? 1;
        var inTower = tower["inTower"]?.GetValue<bool>() ?? false;
        var resolvedFloor = floorJson ?? await GetFloorAsync(floor, ct);
        var rules = ReadRules(resolvedFloor);
        var level = character["level"]?.GetValue<int>() ?? 1;

        RoomEncounterDto? encounter = null;
        string? floorBackground = null;
        if (inTower && resolvedFloor is { } fj)
        {
            encounter = await RoomEncounterResolver.BuildAsync(content, fj, room, ct);
            floorBackground = ReadFloorBackground(fj);
        }

        return new TowerStateDto(
            inTower,
            floor,
            room,
            tower["maxUnlockedRoom"]?.GetValue<int>() ?? 1,
            tower["maxUnlockedFloor"]?.GetValue<int>() ?? 1,
            tower["autoClimb"]?.GetValue<bool>() ?? false,
            tower["floorName"]?.GetValue<string>(),
            character["name"]?.GetValue<string>() ?? "Hero",
            level,
            character["xp"]?.GetValue<int>() ?? 0,
            xpService.XpRequiredForLevel(level),
            rules.GateFee,
            rules.RegistryFee,
            rules.RegistryAttrMult,
            hpSnap.CurrentHp,
            hpSnap.MaxHp,
            hpSnap.HpRegenPerSec,
            encounter,
            floorBackground);
    }

    private static string? ReadFloorBackground(JsonElement floor)
    {
        if (!floor.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!assets.TryGetProperty("background", out var bg) || bg.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var path = bg.GetString();
        return string.IsNullOrWhiteSpace(path) ? null : path.Trim();
    }

    private FloorChallengeRules ReadRules(JsonElement? floorJson) =>
        ReadChallengeRules(
            floorJson,
            Math.Max(0, (long)gameConfig.GetBalance().BossChallengeFee),
            gameConfig.GetBalance().BossChallengeAttrMult);

    /// <summary>
    /// The floor JSON is the authority on what each challenge costs. Env balance
    /// (<c>BOSS_CHALLENGE_FEE</c> / <c>BOSS_CHALLENGE_ATTR_MULT</c>) only fills the gaps, and
    /// the legacy single <c>boss.challengeFee</c> still covers both challenges.
    /// </summary>
    public static FloorChallengeRules ReadChallengeRules(
        JsonElement? floorJson,
        long defaultFee,
        double defaultAttrMult)
    {
        if (floorJson is null ||
            !floorJson.Value.TryGetProperty("boss", out var boss) ||
            boss.ValueKind != JsonValueKind.Object)
        {
            return new FloorChallengeRules(defaultFee, defaultFee, defaultAttrMult);
        }

        var shared = ReadFee(boss, "challengeFee") ?? defaultFee;
        return new FloorChallengeRules(
            ReadFee(boss, "gateFee") ?? shared,
            ReadFee(boss, "registryFee") ?? shared,
            ReadMult(boss, "attrMult") ?? defaultAttrMult);
    }

    private static long? ReadFee(JsonElement boss, string property) =>
        boss.TryGetProperty(property, out var el) &&
        el.ValueKind == JsonValueKind.Number &&
        el.TryGetInt64(out var value) &&
        value >= 0
            ? value
            : null;

    private static double? ReadMult(JsonElement boss, string property) =>
        boss.TryGetProperty(property, out var el) &&
        el.ValueKind == JsonValueKind.Number &&
        el.TryGetDouble(out var value) &&
        value > 0
            ? value
            : null;
}

/// <summary>Per-floor challenge costs and registry difficulty, resolved from the floor JSON.</summary>
public sealed record FloorChallengeRules(long GateFee, long RegistryFee, double RegistryAttrMult);

public sealed class TowerException(string message) : Exception(message);

internal enum ChallengeKind
{
    /// <summary>Normal-attribute boss; winning opens the next floor.</summary>
    Progression,

    /// <summary>×attrMult boss or owner clone; winning registers the floor.</summary>
    Registry
}

public sealed record TowerStateDto(
    bool InTower,
    int Floor,
    int Room,
    int MaxUnlockedRoom,
    int MaxUnlockedFloor,
    bool AutoClimb,
    string? FloorName,
    string CharacterName,
    int Level,
    int Xp,
    /// <summary>XP needed to advance from <see cref="Level"/> — the client only draws the ratio.</summary>
    int XpToNextLevel,
    long BossGateFee,
    long FloorRegistryFee,
    double RegistryAttrMult,
    int CurrentHp,
    int MaxHp,
    double HpRegenPerSec,
    RoomEncounterDto? RoomEncounter = null,
    string? FloorBackground = null);

public sealed record BattleEventDto(
    string Type,
    string Actor,
    string? Target,
    int? Amount,
    string? Message,
    int? HpAfter = null,
    int? MaxHp = null,
    int? Slot = null);

public sealed record BattleResultDto(
    bool Victory,
    IReadOnlyList<BattleEventDto> Events,
    int XpGained,
    int? NewLevel,
    bool LeveledUp,
    IReadOnlyList<string> Loot,
    bool AutoAdvanceRoom,
    TowerStateDto? State,
    long CoinsGained = 0,
    long? SkyCoin = null,
    /// <summary>True se algum monstro da luta tinha <c>skyCoinDrop</c> no JSON.</summary>
    bool MonsterSkyCoinDefined = false);
