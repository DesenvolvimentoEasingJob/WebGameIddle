using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

public sealed class CombatService(
    ContentService content,
    StatCalculator stats,
    XpService xp,
    CharacterService characters,
    HpService hp,
    ItemRollService itemRoll,
    GameConfigService gameConfig,
    IOptions<AppSecretsOptions> secrets)
{
    private readonly Random _rng = Random.Shared;

    public async Task<BattleResultDto> ResolveRoomBattleAsync(
        Guid userId,
        JsonObject character,
        JsonElement floor,
        int room,
        CancellationToken ct)
    {
        var events = new List<BattleEventDto>();
        var monsterIds = ResolveMonsterIds(floor, room);
        var enemies = new List<EnemyFighter>();

        var difficultyScale = 1.0;
        if (floor.TryGetProperty("difficulty", out var diff) && diff.ValueKind == JsonValueKind.Number)
        {
            difficultyScale = Math.Sqrt(Math.Max(1, diff.GetDouble()));
        }

        for (var slot = 0; slot < monsterIds.Count; slot++)
        {
            var monsterId = monsterIds[slot];
            var monster = await content.GetByIdAsync("monsters", monsterId, ct)
                ?? throw new TowerException($"Monster '{monsterId}' not found.");

            var maxHp = ReadMonsterHp(monster) * difficultyScale;
            var profile = CombatHitResolver.FromMonster(monster, difficultyScale);
            var level = monster.TryGetProperty("level", out var lvlEl) ? lvlEl.GetInt32() : 1;
            var name = monster.TryGetProperty("name", out var nEl) ? nEl.GetString() ?? monsterId : monsterId;

            enemies.Add(new EnemyFighter(slot, monsterId, name, maxHp, maxHp, level, monster, profile));
        }

        var playerStats = await stats.CalculateFromCharacterAsync(
            JsonDocument.Parse(character.ToJsonString()).RootElement,
            ct);

        var playerMaxHp = GetStat(playerStats, "hpBase", 100);
        var snap = await hp.ApplyRegenAsync(character, ct);
        var playerHp = (double)snap.CurrentHp;
        if (snap.Regenerated > 0)
        {
            events.Add(new BattleEventDto(
                "regen",
                "player",
                null,
                snap.Regenerated,
                $"+{snap.Regenerated} HP (regen)",
                snap.CurrentHp,
                snap.MaxHp));
        }

        var playerProfile = CombatHitResolver.FromCalculatedStats(playerStats, character);
        var regenRate = Math.Max(0, GetStat(playerStats, "hpRegenPerSec", 0));
        var bal = gameConfig.GetBalance();
        var turnSeconds = Math.Max(0, bal.CombatTurnSeconds);
        var noise = Math.Max(0, bal.CombatDamageNoise);

        var startLabel = enemies.Count == 1
            ? $"Battle vs {enemies[0].Name}"
            : $"Battle vs group ({string.Join(", ", enemies.Select(e => e.Name))})";
        events.Add(new BattleEventDto("start", "system", null, null, startLabel));
        events.Add(Vitals("player", playerHp, playerMaxHp));
        foreach (var e in enemies)
        {
            events.Add(Vitals("enemy", e.Hp, e.MaxHp, e.Name, e.Slot));
        }

        var playerAlive = true;
        var turn = 0;

        while (playerAlive && enemies.Any(e => e.Alive) && turn < 60)
        {
            turn++;

            var target = enemies.FirstOrDefault(e => e.Alive);
            if (target is null)
            {
                break;
            }

            ApplyHit(
                events,
                playerProfile,
                target.Profile,
                noise,
                "player",
                "enemy",
                target.Name,
                target.Slot,
                (dealt, hit) =>
                {
                    target.Hp -= dealt;
                    return (HpService.RoundHp(Math.Max(0, target.Hp)), HpService.RoundHp(target.MaxHp));
                },
                out _);

            if (target.Hp <= 0)
            {
                target.Alive = false;
                events.Add(new BattleEventDto(
                    "death",
                    "enemy",
                    null,
                    null,
                    $"{target.Name} defeated",
                    0,
                    HpService.RoundHp(target.MaxHp),
                    target.Slot));
            }

            if (!enemies.Any(e => e.Alive))
            {
                ApplyCombatTurnRegen(ref playerHp, playerMaxHp, regenRate, turnSeconds, events);
                break;
            }

            foreach (var enemy in enemies.Where(e => e.Alive))
            {
                var dodged = ApplyHit(
                    events,
                    enemy.Profile,
                    playerProfile,
                    noise,
                    "enemy",
                    "player",
                    enemy.Name,
                    enemy.Slot,
                    (dealt, _) =>
                    {
                        playerHp -= dealt;
                        return (HpService.RoundHp(Math.Max(0, playerHp)), HpService.RoundHp(playerMaxHp));
                    },
                    out _);

                if (!dodged && playerHp <= 0)
                {
                    playerAlive = false;
                    events.Add(new BattleEventDto(
                        "death",
                        "player",
                        null,
                        null,
                        "You were defeated",
                        0,
                        HpService.RoundHp(playerMaxHp)));
                    break;
                }
            }

            if (playerAlive)
            {
                ApplyCombatTurnRegen(ref playerHp, playerMaxHp, regenRate, turnSeconds, events);
            }
        }

        var victory = playerAlive && enemies.All(e => !e.Alive);
        var xpGain = 0;
        var leveledUp = false;
        int? newLevel = null;
        var loot = new List<string>();
        var autoAdvance = false;
        long coinsGained = 0;
        var monsterSkyCoinDefined = false;

        if (victory)
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
            events.Add(new BattleEventDto("victory", "player", null, null, "Victory!"));
            var floorNumber = floor.TryGetProperty("number", out var fn) ? fn.GetInt32() : 1;

            foreach (var e in enemies)
            {
                xpGain += xp.XpRewardForMonster(e.Level, floorNumber);
            }

            var applied = await xp.ApplyXpAsync(character, xpGain, ct);
            leveledUp = applied.leveledUp;
            newLevel = applied.newLevel;
            events.Add(new BattleEventDto("xp", "player", null, xpGain, $"+{xpGain} XP"));
            events.AddRange(applied.events);

            foreach (var e in enemies)
            {
                var coin = MonsterDropHelper.RollSkyCoinDrop(e.Monster, _rng, out var defined);
                if (defined)
                {
                    monsterSkyCoinDefined = true;
                    coinsGained += coin;
                }

                var drops = await ApplyLootAsync(userId, e.Monster, floor, ct);
                loot.AddRange(drops);
                foreach (var item in drops)
                {
                    events.Add(new BattleEventDto("loot", "player", null, null, $"Loot: {item}", null, null, e.Slot));
                }
            }

            autoAdvance = character["tower"] is JsonObject t &&
                          (t["autoClimb"]?.GetValue<bool>() ?? false);
        }
        else if (!playerAlive)
        {
            hp.ApplyDefeatRevive(character, playerMaxHp);
            var revived = HpService.RoundHp(character["currentHp"]!.GetValue<double>());
            events.Add(new BattleEventDto("defeat", "player", null, null, "Defeat — no XP penalty in normal rooms"));
            events.Add(new BattleEventDto(
                "revive",
                "player",
                null,
                revived,
                $"Revived with {revived} HP",
                revived,
                HpService.RoundHp(playerMaxHp)));
        }
        else
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
        }

        return new BattleResultDto(
            victory,
            events,
            xpGain,
            newLevel,
            leveledUp,
            loot,
            autoAdvance && victory && room < 10,
            null,
            coinsGained,
            null,
            monsterSkyCoinDefined);
    }

    public async Task<BattleResultDto> ResolveChallengeBattleAsync(
        Guid userId,
        JsonObject character,
        JsonElement floor,
        double attrMult,
        JsonObject? ownerClone,
        CancellationToken ct)
    {
        _ = userId;
        var events = new List<BattleEventDto>();
        var playerStats = await stats.CalculateFromCharacterAsync(
            JsonDocument.Parse(character.ToJsonString()).RootElement,
            ct);

        var playerMaxHp = GetStat(playerStats, "hpBase", 100);
        var snap = await hp.ApplyRegenAsync(character, ct);
        var playerHp = (double)snap.CurrentHp;
        if (snap.Regenerated > 0)
        {
            events.Add(new BattleEventDto(
                "regen",
                "player",
                null,
                snap.Regenerated,
                $"+{snap.Regenerated} HP (regen)",
                snap.CurrentHp,
                snap.MaxHp));
        }

        var playerProfile = CombatHitResolver.FromCalculatedStats(playerStats, character);
        var regenRate = Math.Max(0, GetStat(playerStats, "hpRegenPerSec", 0));
        var bal = gameConfig.GetBalance();
        var turnSeconds = Math.Max(0, bal.CombatTurnSeconds);
        var noise = Math.Max(0, bal.CombatDamageNoise);

        double enemyMaxHp;
        CombatFighterProfile enemyProfile;
        string enemyName;
        int enemyLevel;
        JsonElement? bossMonsterForDrop = null;

        if (ownerClone is not null)
        {
            var cloneStats = await stats.CalculateFromCharacterAsync(
                JsonDocument.Parse(ownerClone.ToJsonString()).RootElement,
                ct);
            enemyMaxHp = GetStat(cloneStats, "hpBase", 100);
            enemyProfile = CombatHitResolver.FromCalculatedStats(cloneStats, ownerClone);
            enemyName = ownerClone["name"]?.GetValue<string>() ?? "Owner clone";
            enemyLevel = ownerClone["level"]?.GetValue<int>() ?? 1;
            events.Add(new BattleEventDto("start", "system", null, null, $"Challenge vs {enemyName} (floor owner)"));

            // Gold/luck do chefe do andar (clone não carrega skyCoinDrop).
            var bossId = ResolveMonsterIds(floor, 10, 1)[0];
            var bossDoc = await content.GetByIdAsync("monsters", bossId, ct);
            if (bossDoc is not null)
            {
                bossMonsterForDrop = bossDoc;
            }
        }
        else
        {
            var monsterId = ResolveMonsterIds(floor, 10, 1)[0];
            var monster = await content.GetByIdAsync("monsters", monsterId, ct)
                ?? throw new TowerException($"Monster '{monsterId}' not found.");
            bossMonsterForDrop = monster;
            enemyMaxHp = ReadMonsterHp(monster) * attrMult;
            enemyProfile = CombatHitResolver.FromMonster(monster, attrMult);
            enemyLevel = monster.TryGetProperty("level", out var lvlEl) ? lvlEl.GetInt32() : 1;
            enemyName = monster.TryGetProperty("name", out var nEl) ? nEl.GetString() ?? monsterId : monsterId;
            events.Add(new BattleEventDto(
                "start",
                "system",
                null,
                null,
                attrMult > 1
                    ? $"Registry challenge vs {enemyName} (×{attrMult:0.#} attrs)"
                    : $"Boss challenge vs {enemyName}"));
        }

        if (floor.TryGetProperty("difficulty", out var diff) && diff.ValueKind == JsonValueKind.Number)
        {
            var d = Math.Sqrt(Math.Max(1, diff.GetDouble()));
            enemyMaxHp *= d;
            enemyProfile = ScaleProfileDamage(enemyProfile, d);
        }

        var enemyHp = enemyMaxHp;
        events.Add(Vitals("player", playerHp, playerMaxHp));
        events.Add(Vitals("enemy", enemyHp, enemyMaxHp, enemyName, 0));

        var playerAlive = true;
        var enemyAlive = true;
        var turn = 0;

        while (playerAlive && enemyAlive && turn < 60)
        {
            turn++;
            ApplyHit(
                events,
                playerProfile,
                enemyProfile,
                noise,
                "player",
                "enemy",
                enemyName,
                0,
                (dealt, _) =>
                {
                    enemyHp -= dealt;
                    return (HpService.RoundHp(Math.Max(0, enemyHp)), HpService.RoundHp(enemyMaxHp));
                },
                out _);

            if (enemyHp <= 0)
            {
                enemyAlive = false;
                events.Add(new BattleEventDto(
                    "death",
                    "enemy",
                    null,
                    null,
                    $"{enemyName} defeated",
                    0,
                    HpService.RoundHp(enemyMaxHp),
                    0));
                ApplyCombatTurnRegen(ref playerHp, playerMaxHp, regenRate, turnSeconds, events);
                break;
            }

            var dodged = ApplyHit(
                events,
                enemyProfile,
                playerProfile,
                noise,
                "enemy",
                "player",
                enemyName,
                0,
                (dealt, _) =>
                {
                    playerHp -= dealt;
                    return (HpService.RoundHp(Math.Max(0, playerHp)), HpService.RoundHp(playerMaxHp));
                },
                out _);

            if (!dodged && playerHp <= 0)
            {
                playerAlive = false;
                events.Add(new BattleEventDto(
                    "death",
                    "player",
                    null,
                    null,
                    "You were defeated",
                    0,
                    HpService.RoundHp(playerMaxHp)));
            }

            if (playerAlive && enemyAlive)
            {
                ApplyCombatTurnRegen(ref playerHp, playerMaxHp, regenRate, turnSeconds, events);
            }
        }

        var victory = !enemyAlive && playerAlive;
        var xpGain = 0;
        var leveledUp = false;
        int? newLevel = null;
        long coinsGained = 0;
        var monsterSkyCoinDefined = false;

        if (victory)
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
            events.Add(new BattleEventDto("victory", "player", null, null, "Floor claimed!"));
            var floorNumber = floor.TryGetProperty("number", out var fn) ? fn.GetInt32() : 1;
            xpGain = xp.XpRewardForMonster(enemyLevel, floorNumber) * 3;
            var applied = await xp.ApplyXpAsync(character, xpGain, ct);
            leveledUp = applied.leveledUp;
            newLevel = applied.newLevel;
            events.Add(new BattleEventDto("xp", "player", null, xpGain, $"+{xpGain} XP"));
            events.AddRange(applied.events);

            if (bossMonsterForDrop is JsonElement dropSource)
            {
                coinsGained = MonsterDropHelper.RollSkyCoinDrop(dropSource, _rng, out monsterSkyCoinDefined);
            }
        }
        else if (!playerAlive)
        {
            hp.ApplyDefeatRevive(character, playerMaxHp);
            var revived = HpService.RoundHp(character["currentHp"]!.GetValue<double>());
            events.Add(new BattleEventDto("defeat", "player", null, null, "Challenge failed"));
            var penalty = xp.ApplyDeathPenalty(character);
            events.AddRange(penalty.events);
            events.Add(new BattleEventDto(
                "revive",
                "player",
                null,
                revived,
                $"Revived with {revived} HP",
                revived,
                HpService.RoundHp(playerMaxHp)));
        }
        else
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
        }

        return new BattleResultDto(
            victory,
            events,
            xpGain,
            newLevel,
            leveledUp,
            Array.Empty<string>(),
            false,
            null,
            coinsGained,
            null,
            monsterSkyCoinDefined);
    }

    public static bool WouldPlayerWin(double playerHp, double playerAtk, double enemyHp, double enemyAtk)
    {
        var turnsToKillEnemy = enemyHp / Math.Max(1, playerAtk);
        var turnsToKillPlayer = playerHp / Math.Max(1, enemyAtk);
        return turnsToKillEnemy <= turnsToKillPlayer;
    }

    /// <summary>
    /// Regen bruta por turno de combate: <c>hpRegenPerSec × CombatTurnSeconds</c>.
    /// </summary>
    public static double ApplyCombatTurnRegen(
        ref double playerHp,
        double playerMaxHp,
        double regenPerSec,
        double turnSeconds,
        IList<BattleEventDto> events)
    {
        if (playerHp <= 0 || playerHp >= playerMaxHp || regenPerSec <= 0 || turnSeconds <= 0)
        {
            return 0;
        }

        var gained = Math.Min(playerMaxHp - playerHp, regenPerSec * turnSeconds);
        if (gained <= 0)
        {
            return 0;
        }

        playerHp += gained;
        var amount = HpService.RoundHp(gained);
        if (amount <= 0 && gained < 0.5)
        {
            return gained;
        }

        if (amount <= 0)
        {
            amount = 1;
        }

        events.Add(new BattleEventDto(
            "regen",
            "player",
            null,
            amount,
            $"+{amount} HP (regen)",
            HpService.RoundHp(playerHp),
            HpService.RoundHp(playerMaxHp)));
        return gained;
    }

    private bool ApplyHit(
        IList<BattleEventDto> events,
        CombatFighterProfile attacker,
        CombatFighterProfile defender,
        double noise,
        string actor,
        string target,
        string? attackerName,
        int? slot,
        Func<int, HitResolution, (int hpAfter, int hpMax)> applyDamage,
        out HitResolution hit)
    {
        hit = CombatHitResolver.Resolve(attacker, defender, noise, _rng);
        if (hit.Dodged)
        {
            var dodgeMsg = actor == "enemy" && !string.IsNullOrEmpty(attackerName)
                ? $"Dodged {attackerName}!"
                : "Dodged!";
            events.Add(new BattleEventDto(
                "dodge",
                target,
                actor,
                null,
                dodgeMsg,
                null,
                null,
                slot));
            return true;
        }

        var (hpAfter, hpMax) = applyDamage(hit.Amount, hit);
        // foeName: alvo (player→enemy) ou atacante (enemy→player) — mensagens legadas.
        var label = actor == "player"
            ? hit.Crit
                ? $"Critical hit on {attackerName} for {hit.Amount}"
                : $"Hit {attackerName} for {hit.Amount}"
            : $"{attackerName} hits for {hit.Amount}";

        events.Add(new BattleEventDto(
            hit.Crit ? "crit" : "hit",
            actor,
            target,
            hit.Amount,
            label,
            hpAfter,
            hpMax,
            slot));
        return false;
    }

    private static CombatFighterProfile ScaleProfileDamage(CombatFighterProfile profile, double scale)
    {
        if (Math.Abs(scale - 1.0) < 0.0001)
        {
            return profile;
        }

        return new CombatFighterProfile
        {
            DmgBase = profile.DmgBase * scale,
            DefBase = profile.DefBase,
            AttackSpeed = profile.AttackSpeed,
            CritChance = profile.CritChance,
            CritDamage = profile.CritDamage,
            DodgeChance = profile.DodgeChance,
            BonusDamage = profile.BonusDamage
                .Select(b => b with { DmgBase = b.DmgBase * scale })
                .ToList(),
            BonusDefense = profile.BonusDefense
        };
    }

    private static double ReadMonsterHp(JsonElement monster)
    {
        if (monster.TryGetProperty("hp", out var hpEl) && hpEl.ValueKind == JsonValueKind.Number)
        {
            return hpEl.GetDouble();
        }

        if (monster.TryGetProperty("baseStats", out var bs) &&
            bs.ValueKind == JsonValueKind.Object &&
            bs.TryGetProperty("hpBase", out var nested) &&
            nested.ValueKind == JsonValueKind.Number)
        {
            return nested.GetDouble();
        }

        return 30;
    }

    private static BattleEventDto Vitals(
        string actor,
        double current,
        double max,
        string? name = null,
        int? slot = null) =>
        new(
            "vitals",
            actor,
            null,
            null,
            name is null ? null : $"{name}",
            HpService.RoundHp(current),
            HpService.RoundHp(max),
            slot);

    /// <summary>Lista de spawn da sala (ver <see cref="RoomEncounterResolver.ResolveMonsterIds"/>).</summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room) =>
        RoomEncounterResolver.ResolveMonsterIds(floor, room);

    /// <summary>Compat overload — <paramref name="count"/> é ignorado.</summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room, int count) =>
        RoomEncounterResolver.ResolveMonsterIds(floor, room);

    private async Task<List<string>> ApplyLootAsync(
        Guid userId,
        JsonElement monster,
        JsonElement floor,
        CancellationToken ct)
    {
        var gained = new List<string>();
        if (!monster.TryGetProperty("loot", out var loot) || loot.ValueKind != JsonValueKind.Array)
        {
            return gained;
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

        var bagPath = Path.Combine(secrets.Value.DataPath, "bags", $"{userId}.json");
        if (!File.Exists(bagPath))
        {
            return gained;
        }

        var (_, bag) = await characters.LoadMutableBagAsync(userId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();

        foreach (var entry in loot.EnumerateArray())
        {
            var chance = entry.TryGetProperty("chance", out var c) ? c.GetDouble() : 0;
            if (_rng.NextDouble() > chance)
            {
                continue;
            }

            var templateId = entry.TryGetProperty("itemId", out var id) ? id.GetString() : null;
            if (string.IsNullOrEmpty(templateId))
            {
                continue;
            }

            var qty = 1;
            if (entry.TryGetProperty("qty", out var qtyEl) && qtyEl.ValueKind == JsonValueKind.Array &&
                qtyEl.GetArrayLength() >= 2)
            {
                var min = qtyEl[0].GetInt32();
                var max = qtyEl[1].GetInt32();
                qty = _rng.Next(min, max + 1);
            }

            try
            {
                var template = await content.GetByIdAsync("items", templateId, ct);
                if (template is null)
                {
                    continue;
                }

                var stackable = template.Value.TryGetProperty("stackable", out var st) &&
                                st.ValueKind == JsonValueKind.True;
                var rarityLuck = MonsterDropHelper.ReadRarityLuck(monster);

                if (stackable)
                {
                    var material = await itemRoll.CreateMaterialSnapshotAsync(templateId, qty, ct);
                    items.Add(material);
                    var label = material["name"]?.GetValue<string>() ?? templateId;
                    gained.Add($"{label} x{qty}");
                }
                else
                {
                    for (var i = 0; i < qty; i++)
                    {
                        var snap = await itemRoll.CreateFromTemplateAsync(
                            templateId,
                            _rng,
                            ct,
                            itemLevel,
                            rarityLuck: rarityLuck);
                        items.Add(snap);
                        var name = snap["name"]?.GetValue<string>() ?? templateId;
                        var rarity = snap["rarityName"]?.GetValue<string>() ?? "?";
                        var stars = snap["stars"]?.GetValue<int>() ?? 1;
                        gained.Add($"{name} Lv{itemLevel} [{rarity} {stars}★]");
                    }
                }
            }
            catch (ItemRollException)
            {
                // Skip unknown templates rather than failing the battle.
            }
        }

        bag["items"] = items;
        await characters.SaveBagNodeAsync(bagPath, bag, ct);
        return gained;
    }

    private static double GetStat(IReadOnlyDictionary<string, double> stats, string key, double fallback) =>
        stats.TryGetValue(key, out var v) ? v : fallback;

    private sealed class EnemyFighter(
        int slot,
        string monsterId,
        string name,
        double hp,
        double maxHp,
        int level,
        JsonElement monster,
        CombatFighterProfile profile)
    {
        public int Slot { get; } = slot;
        public string MonsterId { get; } = monsterId;
        public string Name { get; } = name;
        public double Hp { get; set; } = hp;
        public double MaxHp { get; } = maxHp;
        public int Level { get; } = level;
        public JsonElement Monster { get; } = monster;
        public CombatFighterProfile Profile { get; } = profile;
        public bool Alive { get; set; } = true;
    }
}
