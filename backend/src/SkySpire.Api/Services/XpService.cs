using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public sealed class XpService(
    GameConfigService gameConfig,
    LevelGrowthService growth)
{
    public int XpRequiredForLevel(int level)
    {
        // XP needed to advance FROM this level to the next.
        var b = gameConfig.GetBalance();
        if (level < 1)
        {
            level = 1;
        }

        double required = b.XpBase;
        for (var lvl = 1; lvl < level; lvl++)
        {
            var decade = (lvl - 1) / b.XpScaleStepEvery;
            var scale = b.XpScale + decade * b.XpScaleStep;
            required *= scale;
        }

        return Math.Max(1, (int)Math.Round(required));
    }

    public async Task<(int newXp, int newLevel, bool leveledUp, List<BattleEventDto> events)> ApplyXpAsync(
        JsonObject character,
        int xpGain,
        CancellationToken ct = default)
    {
        var level = character["level"]?.GetValue<int>() ?? 1;
        var xp = character["xp"]?.GetValue<int>() ?? 0;
        xp += Math.Max(0, xpGain);

        var events = new List<BattleEventDto>();
        var leveled = false;

        while (true)
        {
            var need = XpRequiredForLevel(level);
            if (xp < need)
            {
                break;
            }

            xp -= need;
            level += 1;
            leveled = true;
            await growth.ApplyLevelGainsAsync(character, ct);
            events.Add(new BattleEventDto(
                "level_up",
                "player",
                null,
                level,
                $"Reached level {level}!"));
        }

        character["level"] = level;
        character["xp"] = xp;
        return (xp, level, leveled, events);
    }

    public int XpRewardForMonster(int monsterLevel, int floorNumber)
    {
        var b = gameConfig.GetBalance();
        var baseXp = 10 + monsterLevel * 8;
        var floorBonus = Math.Pow(b.FloorRewardMult, Math.Max(0, floorNumber - 1));
        return Math.Max(1, (int)Math.Round(baseXp * floorBonus));
    }

    /// <summary>Applies death penalty as a fraction of XP required for the current level.</summary>
    public (int xpLost, List<BattleEventDto> events) ApplyDeathPenalty(JsonObject character)
    {
        var level = character["level"]?.GetValue<int>() ?? 1;
        var xp = character["xp"]?.GetValue<int>() ?? 0;
        var need = XpRequiredForLevel(level);
        var lose = (int)Math.Floor(need * gameConfig.GetBalance().DeathXpPenalty);
        lose = Math.Clamp(lose, 0, xp);
        character["xp"] = xp - lose;
        var events = new List<BattleEventDto>();
        if (lose > 0)
        {
            events.Add(new BattleEventDto(
                "xp_penalty",
                "player",
                null,
                lose,
                $"-{lose} XP (death penalty)"));
        }

        return (lose, events);
    }
}
