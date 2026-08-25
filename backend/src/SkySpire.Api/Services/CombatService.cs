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
    UniqueItemDropService uniqueDrops,
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
            var hpRegen = CombatHitResolver.ReadMonsterHpRegenPerSec(monster);

            enemies.Add(new EnemyFighter(slot, monsterId, name, maxHp, maxHp, level, monster, profile, hpRegen));
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
                snap.MaxHp,
                AtMs: 0));
        }

        var playerProfile = CombatHitResolver.FromCalculatedStats(playerStats, character);
        var regenRate = Math.Max(0, GetStat(playerStats, "hpRegenPerSec", 0));
        var bal = gameConfig.GetBalance();
        var baseActionMs = Math.Max(1, bal.CombatBaseActionMs);
        var maxDurationMs = Math.Max(baseActionMs, bal.CombatMaxDurationMs);
        var regenTickMs = Math.Max(1, bal.CombatRegenTickMs);
        var noise = Math.Max(0, bal.CombatDamageNoise);
        var armorMid = bal.CombatArmorMidDef;
        var armorPower = bal.CombatArmorPower;

        var startLabel = enemies.Count == 1
            ? $"Battle vs {enemies[0].Name}"
            : $"Battle vs group ({string.Join(", ", enemies.Select(e => e.Name))})";
        events.Add(new BattleEventDto("start", "system", null, null, startLabel, AtMs: 0));
        events.Add(Vitals("player", playerHp, playerMaxHp, atMs: 0));
        foreach (var e in enemies)
        {
            events.Add(Vitals("enemy", e.Hp, e.MaxHp, e.Name, e.Slot, atMs: 0));
        }

        var playerAlive = true;
        var playerNextAct = ActionIntervalMs(playerProfile.AttackSpeed, baseActionMs);
        foreach (var e in enemies)
        {
            e.NextActAtMs = ActionIntervalMs(e.Profile.AttackSpeed, baseActionMs);
        }

        var nextRegenAt = regenTickMs;
        var nowMs = 0;

        while (playerAlive && enemies.Any(e => e.Alive) && nowMs < maxDurationMs)
        {
            var next = NextTimelineMs(playerAlive, playerNextAct, enemies, regenRate, nextRegenAt);
            if (next is null || next.Value > maxDurationMs)
            {
                break;
            }

            nowMs = next.Value;

            // Mesmo atMs: inimigos agem antes do player (empate de clock).
            // Evita wipe no mesmo tick cancelar o primeiro swing de quem ainda estava vivo.
            foreach (var enemy in enemies
                         .Where(e => e.Alive && e.NextActAtMs == nowMs)
                         .OrderBy(e => e.Slot)
                         .ToList())
            {
                var dodged = ApplyHit(
                    events,
                    nowMs,
                    enemy.Profile,
                    playerProfile,
                    noise,
                    armorMid,
                    armorPower,
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

                enemy.NextActAtMs = nowMs + ActionIntervalMs(enemy.Profile.AttackSpeed, baseActionMs);

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
                        HpService.RoundHp(playerMaxHp),
                        AtMs: nowMs));
                    break;
                }
            }

            if (!playerAlive)
            {
                break;
            }

            if (playerNextAct == nowMs)
            {
                var target = enemies.FirstOrDefault(e => e.Alive);
                if (target is not null)
                {
                    ApplyHit(
                        events,
                        nowMs,
                        playerProfile,
                        target.Profile,
                        noise,
                        armorMid,
                        armorPower,
                        "player",
                        "enemy",
                        target.Name,
                        target.Slot,
                        (dealt, _) =>
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
                            target.Slot,
                            nowMs));
                    }
                }

                playerNextAct = nowMs + ActionIntervalMs(playerProfile.AttackSpeed, baseActionMs);
            }

            if (!enemies.Any(e => e.Alive))
            {
                break;
            }

            if (nextRegenAt == nowMs && NeedsCombatRegenTick(playerAlive, regenRate, enemies))
            {
                if (playerAlive && regenRate > 0)
                {
                    ApplyCombatRegenTick(
                        ref playerHp,
                        playerMaxHp,
                        regenRate,
                        regenTickMs,
                        nowMs,
                        events);
                }

                foreach (var enemy in enemies.Where(e => e.Alive && e.HpRegenPerSec > 0))
                {
                    var enemyHpRef = enemy.Hp;
                    ApplyCombatRegenTick(
                        ref enemyHpRef,
                        enemy.MaxHp,
                        enemy.HpRegenPerSec,
                        regenTickMs,
                        nowMs,
                        events,
                        actor: "enemy",
                        slot: enemy.Slot,
                        name: enemy.Name);
                    enemy.Hp = enemyHpRef;
                }

                nextRegenAt = nowMs + regenTickMs;
            }
        }

        var endMs = Math.Max(nowMs, LastEventAtMs(events));

        var victory = playerAlive && enemies.All(e => !e.Alive);
        var xpGain = 0;
        var leveledUp = false;
        int? newLevel = null;
        var loot = new List<string>();
        var uniqueDropList = new List<UniqueDropDto>();
        var autoAdvance = false;
        long coinsGained = 0;
        var monsterSkyCoinDefined = false;

        if (victory)
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
            events.Add(new BattleEventDto("victory", "player", null, null, "Victory!", AtMs: endMs));
            var floorNumber = floor.TryGetProperty("number", out var fn) ? fn.GetInt32() : 1;

            foreach (var e in enemies)
            {
                xpGain += xp.XpRewardForMonster(e.Level, floorNumber);
            }

            var applied = await xp.ApplyXpAsync(character, xpGain, ct);
            leveledUp = applied.leveledUp;
            newLevel = applied.newLevel;
            events.Add(new BattleEventDto("xp", "player", null, xpGain, $"+{xpGain} XP", AtMs: endMs));
            foreach (var ev in applied.events)
            {
                events.Add(ev with { AtMs = endMs });
            }

            foreach (var e in enemies)
            {
                var coin = MonsterDropHelper.RollSkyCoinDrop(e.Monster, _rng, out var defined);
                if (defined)
                {
                    monsterSkyCoinDefined = true;
                    coinsGained += coin;
                }

                var appliedLoot = await ApplyLootAsync(userId, character, e.Monster, floor, ct);
                loot.AddRange(appliedLoot.AllLabels);
                uniqueDropList.AddRange(appliedLoot.UniqueDrops);
                foreach (var item in appliedLoot.LogLabels)
                {
                    events.Add(new BattleEventDto(
                        "loot",
                        "player",
                        null,
                        null,
                        $"Loot: {item}",
                        null,
                        null,
                        e.Slot,
                        endMs));
                }
            }

            autoAdvance = character["tower"] is JsonObject t &&
                          (t["autoClimb"]?.GetValue<bool>() ?? false);
            // Item único interrompe auto-farm no server também.
            if (uniqueDropList.Count > 0 && character["tower"] is JsonObject towerNode)
            {
                towerNode["autoClimb"] = false;
                autoAdvance = false;
            }
        }
        else if (!playerAlive)
        {
            hp.ApplyDefeatRevive(character, playerMaxHp);
            var revived = HpService.RoundHp(character["currentHp"]!.GetValue<double>());
            events.Add(new BattleEventDto(
                "defeat",
                "player",
                null,
                null,
                "Defeat — no XP penalty in normal rooms",
                AtMs: endMs));
            events.Add(new BattleEventDto(
                "revive",
                "player",
                null,
                revived,
                $"Revived with {revived} HP",
                revived,
                HpService.RoundHp(playerMaxHp),
                AtMs: endMs));
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
            monsterSkyCoinDefined,
            uniqueDropList.Count > 0 ? uniqueDropList : null);
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
                snap.MaxHp,
                AtMs: 0));
        }

        var playerProfile = CombatHitResolver.FromCalculatedStats(playerStats, character);
        var regenRate = Math.Max(0, GetStat(playerStats, "hpRegenPerSec", 0));
        var bal = gameConfig.GetBalance();
        var baseActionMs = Math.Max(1, bal.CombatBaseActionMs);
        var maxDurationMs = Math.Max(baseActionMs, bal.CombatMaxDurationMs);
        var regenTickMs = Math.Max(1, bal.CombatRegenTickMs);
        var noise = Math.Max(0, bal.CombatDamageNoise);
        var armorMid = bal.CombatArmorMidDef;
        var armorPower = bal.CombatArmorPower;

        double enemyMaxHp;
        CombatFighterProfile enemyProfile;
        string enemyName;
        int enemyLevel;
        double enemyRegenRate = 0;
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
            enemyRegenRate = Math.Max(0, GetStat(cloneStats, "hpRegenPerSec", 0));
            events.Add(new BattleEventDto(
                "start",
                "system",
                null,
                null,
                $"Challenge vs {enemyName} (floor owner)",
                AtMs: 0));

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
            enemyRegenRate = CombatHitResolver.ReadMonsterHpRegenPerSec(monster);
            events.Add(new BattleEventDto(
                "start",
                "system",
                null,
                null,
                attrMult > 1
                    ? $"Registry challenge vs {enemyName} (×{attrMult:0.#} attrs)"
                    : $"Boss challenge vs {enemyName}",
                AtMs: 0));
        }

        if (floor.TryGetProperty("difficulty", out var diff) && diff.ValueKind == JsonValueKind.Number)
        {
            var d = Math.Sqrt(Math.Max(1, diff.GetDouble()));
            enemyMaxHp *= d;
            enemyProfile = ScaleProfileDamage(enemyProfile, d);
        }

        var enemyHp = enemyMaxHp;
        var enemyAlive = true;
        events.Add(Vitals("player", playerHp, playerMaxHp, atMs: 0));
        events.Add(Vitals("enemy", enemyHp, enemyMaxHp, enemyName, 0, atMs: 0));

        var playerAlive = true;
        var playerNextAct = ActionIntervalMs(playerProfile.AttackSpeed, baseActionMs);
        var enemyNextAct = ActionIntervalMs(enemyProfile.AttackSpeed, baseActionMs);
        var nextRegenAt = regenTickMs;
        var nowMs = 0;

        while (playerAlive && enemyAlive && nowMs < maxDurationMs)
        {
            var candidates = new List<int> { playerNextAct, enemyNextAct };
            if ((playerAlive && regenRate > 0) || (enemyAlive && enemyRegenRate > 0))
            {
                candidates.Add(nextRegenAt);
            }

            var next = candidates.Min();
            if (next > maxDurationMs)
            {
                break;
            }

            nowMs = next;

            // Empate de clock: inimigo age antes do player.
            if (enemyAlive && enemyNextAct == nowMs)
            {
                var dodged = ApplyHit(
                    events,
                    nowMs,
                    enemyProfile,
                    playerProfile,
                    noise,
                    armorMid,
                    armorPower,
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

                enemyNextAct = nowMs + ActionIntervalMs(enemyProfile.AttackSpeed, baseActionMs);

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
                        HpService.RoundHp(playerMaxHp),
                        AtMs: nowMs));
                }
            }

            if (!playerAlive)
            {
                break;
            }

            if (playerNextAct == nowMs)
            {
                ApplyHit(
                    events,
                    nowMs,
                    playerProfile,
                    enemyProfile,
                    noise,
                    armorMid,
                    armorPower,
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
                        0,
                        nowMs));
                }

                playerNextAct = nowMs + ActionIntervalMs(playerProfile.AttackSpeed, baseActionMs);
            }

            if (!enemyAlive)
            {
                break;
            }

            if (nextRegenAt == nowMs &&
                ((playerAlive && regenRate > 0) || (enemyAlive && enemyRegenRate > 0)))
            {
                if (playerAlive && regenRate > 0)
                {
                    ApplyCombatRegenTick(
                        ref playerHp,
                        playerMaxHp,
                        regenRate,
                        regenTickMs,
                        nowMs,
                        events);
                }

                if (enemyAlive && enemyRegenRate > 0)
                {
                    ApplyCombatRegenTick(
                        ref enemyHp,
                        enemyMaxHp,
                        enemyRegenRate,
                        regenTickMs,
                        nowMs,
                        events,
                        actor: "enemy",
                        slot: 0,
                        name: enemyName);
                }

                nextRegenAt = nowMs + regenTickMs;
            }
        }

        var endMs = Math.Max(nowMs, LastEventAtMs(events));

        var victory = !enemyAlive && playerAlive;
        var xpGain = 0;
        var leveledUp = false;
        int? newLevel = null;
        long coinsGained = 0;
        var monsterSkyCoinDefined = false;

        if (victory)
        {
            hp.SetCurrentHp(character, Math.Max(0, playerHp), playerMaxHp);
            events.Add(new BattleEventDto("victory", "player", null, null, "Floor claimed!", AtMs: endMs));
            var floorNumber = floor.TryGetProperty("number", out var fn) ? fn.GetInt32() : 1;
            xpGain = xp.XpRewardForMonster(enemyLevel, floorNumber) * 3;
            var applied = await xp.ApplyXpAsync(character, xpGain, ct);
            leveledUp = applied.leveledUp;
            newLevel = applied.newLevel;
            events.Add(new BattleEventDto("xp", "player", null, xpGain, $"+{xpGain} XP", AtMs: endMs));
            foreach (var ev in applied.events)
            {
                events.Add(ev with { AtMs = endMs });
            }

            if (bossMonsterForDrop is JsonElement dropSource)
            {
                coinsGained = MonsterDropHelper.RollSkyCoinDrop(dropSource, _rng, out monsterSkyCoinDefined);
            }
        }
        else if (!playerAlive)
        {
            hp.ApplyDefeatRevive(character, playerMaxHp);
            var revived = HpService.RoundHp(character["currentHp"]!.GetValue<double>());
            events.Add(new BattleEventDto("defeat", "player", null, null, "Challenge failed", AtMs: endMs));
            var penalty = xp.ApplyDeathPenalty(character);
            foreach (var ev in penalty.events)
            {
                events.Add(ev with { AtMs = endMs });
            }

            events.Add(new BattleEventDto(
                "revive",
                "player",
                null,
                revived,
                $"Revived with {revived} HP",
                revived,
                HpService.RoundHp(playerMaxHp),
                AtMs: endMs));
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
    /// Intervalo até o próximo ato: <c>baseMs / max(attackSpeed, ε)</c>.
    /// </summary>
    public static int ActionIntervalMs(double attackSpeed, int baseActionMs)
    {
        var speed = Math.Max(0.01, attackSpeed);
        return Math.Max(1, (int)Math.Round(Math.Max(1, baseActionMs) / speed));
    }

    /// <summary>
    /// Regen bruta por tick de combate: <c>hpRegenPerSec × (tickMs / 1000)</c>.
    /// </summary>
    public static double ApplyCombatRegenTick(
        ref double hp,
        double maxHp,
        double regenPerSec,
        int tickMs,
        int atMs,
        IList<BattleEventDto> events,
        string actor = "player",
        int? slot = null,
        string? name = null)
    {
        if (hp <= 0 || hp >= maxHp || regenPerSec <= 0 || tickMs <= 0)
        {
            return 0;
        }

        var gained = Math.Min(maxHp - hp, regenPerSec * (tickMs / 1000.0));
        if (gained <= 0)
        {
            return 0;
        }

        hp += gained;
        var amount = HpService.RoundHp(gained);
        if (amount <= 0 && gained < 0.5)
        {
            return gained;
        }

        if (amount <= 0)
        {
            amount = 1;
        }

        var message = actor == "enemy" && !string.IsNullOrEmpty(name)
            ? $"{name} +{amount} HP (regen)"
            : $"+{amount} HP (regen)";

        events.Add(new BattleEventDto(
            "regen",
            actor,
            null,
            amount,
            message,
            HpService.RoundHp(hp),
            HpService.RoundHp(maxHp),
            slot,
            atMs));
        return gained;
    }

    private static bool NeedsCombatRegenTick(
        bool playerAlive,
        double playerRegenRate,
        IReadOnlyList<EnemyFighter> enemies) =>
        (playerAlive && playerRegenRate > 0) ||
        enemies.Any(e => e.Alive && e.HpRegenPerSec > 0);

    private static int? NextTimelineMs(
        bool playerAlive,
        int playerNextAct,
        IReadOnlyList<EnemyFighter> enemies,
        double regenRate,
        int nextRegenAt)
    {
        var candidates = new List<int>();
        if (playerAlive)
        {
            candidates.Add(playerNextAct);
        }

        foreach (var e in enemies.Where(e => e.Alive))
        {
            candidates.Add(e.NextActAtMs);
        }

        if (NeedsCombatRegenTick(playerAlive, regenRate, enemies))
        {
            candidates.Add(nextRegenAt);
        }

        return candidates.Count == 0 ? null : candidates.Min();
    }

    private static int LastEventAtMs(IReadOnlyList<BattleEventDto> events) =>
        events.Count == 0 ? 0 : events.Max(e => e.AtMs);

    private bool ApplyHit(
        IList<BattleEventDto> events,
        int atMs,
        CombatFighterProfile attacker,
        CombatFighterProfile defender,
        double noise,
        double armorMidDef,
        double armorPower,
        string actor,
        string target,
        string? attackerName,
        int? slot,
        Func<int, HitResolution, (int hpAfter, int hpMax)> applyDamage,
        out HitResolution hit)
    {
        hit = CombatHitResolver.Resolve(attacker, defender, noise, _rng, armorMidDef, armorPower);
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
                slot,
                atMs));
            return true;
        }

        var (hpAfter, hpMax) = applyDamage(hit.Amount, hit);
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
            slot,
            atMs));
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
            DefBase = profile.DefBase * scale,
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
        int? slot = null,
        int atMs = 0) =>
        new(
            "vitals",
            actor,
            null,
            null,
            name is null ? null : $"{name}",
            HpService.RoundHp(current),
            HpService.RoundHp(max),
            slot,
            atMs);

    /// <summary>Lista de spawn da sala (ver <see cref="RoomEncounterResolver.ResolveMonsterIds"/>).</summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room) =>
        RoomEncounterResolver.ResolveMonsterIds(floor, room);

    /// <summary>Compat overload — <paramref name="count"/> é ignorado.</summary>
    public static IReadOnlyList<string> ResolveMonsterIds(JsonElement floor, int room, int count) =>
        RoomEncounterResolver.ResolveMonsterIds(floor, room);

    private sealed record LootApplyResult(
        IReadOnlyList<string> LogLabels,
        IReadOnlyList<string> AllLabels,
        IReadOnlyList<UniqueDropDto> UniqueDrops);

    private async Task<LootApplyResult> ApplyLootAsync(
        Guid userId,
        JsonObject character,
        JsonElement monster,
        JsonElement floor,
        CancellationToken ct)
    {
        var logLabels = new List<string>();
        var allLabels = new List<string>();
        var uniques = new List<UniqueDropDto>();
        if (!monster.TryGetProperty("loot", out var loot) || loot.ValueKind != JsonValueKind.Array)
        {
            return new LootApplyResult(logLabels, allLabels, uniques);
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
            return new LootApplyResult(logLabels, allLabels, uniques);
        }

        var (_, bag) = await characters.LoadMutableBagAsync(userId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();

        string? uniqueSeedId = null;
        var uniqueConsumed = false;
        if (uniqueDrops.ShouldAttemptUnique(_rng))
        {
            uniqueSeedId = await uniqueDrops.TryPickGearSeedIdAsync(monster, _rng, ct);
        }

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
                    var line = $"{label} x{qty}";
                    logLabels.Add(line);
                    allLabels.Add(line);
                }
                else if (!uniqueConsumed &&
                         uniqueSeedId is not null &&
                         string.Equals(templateId, uniqueSeedId, StringComparison.OrdinalIgnoreCase))
                {
                    uniqueConsumed = true;
                    var unique = await uniqueDrops.TryCreateUniqueAsync(
                        templateId,
                        monster,
                        floor,
                        character,
                        _rng,
                        ct);
                    if (unique is not null)
                    {
                        items.Add(unique.Snapshot);
                        allLabels.Add(unique.Label);
                        uniques.Add(ToUniqueDropDto(unique.Snapshot));
                        // Demais cópias da mesma entrada (qty>1) caem como loot normal
                        for (var i = 1; i < qty; i++)
                        {
                            AddNormalGear(
                                items,
                                logLabels,
                                allLabels,
                                await itemRoll.CreateFromTemplateAsync(
                                    templateId,
                                    _rng,
                                    ct,
                                    itemLevel,
                                    rarityLuck: rarityLuck),
                                itemLevel);
                        }
                    }
                    else
                    {
                        for (var i = 0; i < qty; i++)
                        {
                            AddNormalGear(
                                items,
                                logLabels,
                                allLabels,
                                await itemRoll.CreateFromTemplateAsync(
                                    templateId,
                                    _rng,
                                    ct,
                                    itemLevel,
                                    rarityLuck: rarityLuck),
                                itemLevel);
                        }
                    }
                }
                else
                {
                    for (var i = 0; i < qty; i++)
                    {
                        AddNormalGear(
                            items,
                            logLabels,
                            allLabels,
                            await itemRoll.CreateFromTemplateAsync(
                                templateId,
                                _rng,
                                ct,
                                itemLevel,
                                rarityLuck: rarityLuck),
                            itemLevel);
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
        return new LootApplyResult(logLabels, allLabels, uniques);
    }

    private static void AddNormalGear(
        JsonArray items,
        List<string> logLabels,
        List<string> allLabels,
        JsonObject snap,
        int itemLevel)
    {
        items.Add(snap);
        var name = snap["name"]?.GetValue<string>() ?? "item";
        var rarity = snap["rarityName"]?.GetValue<string>() ?? "?";
        var stars = snap["stars"]?.GetValue<int>() ?? 1;
        var line = $"{name} Lv{itemLevel} [{rarity} {stars}★]";
        logLabels.Add(line);
        allLabels.Add(line);
    }

    private static UniqueDropDto ToUniqueDropDto(JsonObject snap)
    {
        Dictionary<string, double>? stats = null;
        if (snap["stats"] is JsonObject statsObj)
        {
            stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            foreach (var (k, v) in statsObj)
            {
                if (v is JsonValue jv && jv.TryGetValue<double>(out var n))
                {
                    stats[k] = n;
                }
            }
        }

        string? icon = null;
        if (snap["assets"] is JsonObject assets)
        {
            icon = assets["icon"]?.GetValue<string>();
        }

        return new UniqueDropDto(
            snap["name"]?.GetValue<string>() ?? "Item único",
            snap["description"]?.GetValue<string>(),
            snap["lore"]?.GetValue<string>(),
            icon,
            snap["type"]?.GetValue<string>(),
            snap["stars"]?.GetValue<int>(),
            snap["rarityName"]?.GetValue<string>(),
            snap["rarityId"]?.GetValue<int>(),
            snap["itemLevel"]?.GetValue<int>(),
            stats);
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
        CombatFighterProfile profile,
        double hpRegenPerSec = 0)
    {
        public int Slot { get; } = slot;
        public string MonsterId { get; } = monsterId;
        public string Name { get; } = name;
        public double Hp { get; set; } = hp;
        public double MaxHp { get; } = maxHp;
        public int Level { get; } = level;
        public JsonElement Monster { get; } = monster;
        public CombatFighterProfile Profile { get; } = profile;
        public double HpRegenPerSec { get; } = Math.Max(0, hpRegenPerSec);
        public bool Alive { get; set; } = true;
        public int NextActAtMs { get; set; }
    }
}
