using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SkySpire.Api.Configuration;

namespace SkySpire.Api.Services;

/// <summary>
/// Loads playable knobs from <c>content/config/global.json</c>.
/// Env vars still override when present (deploy escape hatch). Secrets stay in env only.
/// </summary>
public sealed class GameConfigService(
    IOptions<AppSecretsOptions> secrets,
    IConfiguration config,
    ILogger<GameConfigService> log)
{
    private string GlobalPath => Path.Combine(secrets.Value.ContentPath, "config", "global.json");

    public GameBalanceOptions GetBalance()
    {
        var opts = new GameBalanceOptions();
        ApplyFromJson(opts);
        ApplyEnvOverrides(opts);
        return opts;
    }

    /// <summary>Global PixelLab prompt complement for monster sprites.</summary>
    public string? GetMonsterImageComplement() =>
        ReadGenerativeString("monsterImageComplement");

    /// <summary>Global Gemini prompt complement for floor combat backgrounds (21:9 arena).</summary>
    public string? GetFloorImageComplement() =>
        ReadGenerativeString("floorImageComplement");

    private string? ReadGenerativeString(string property)
    {
        try
        {
            if (!File.Exists(GlobalPath))
            {
                return null;
            }

            using var doc = JsonDocument.Parse(File.ReadAllText(GlobalPath));
            if (doc.RootElement.TryGetProperty("generative", out var gen) &&
                gen.ValueKind == JsonValueKind.Object &&
                gen.TryGetProperty(property, out var comp) &&
                comp.ValueKind == JsonValueKind.String)
            {
                var s = comp.GetString();
                return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            }
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to read generative.{Property} from {Path}", property, GlobalPath);
        }

        return null;
    }

    private void ApplyFromJson(GameBalanceOptions opts)
    {
        try
        {
            if (!File.Exists(GlobalPath))
            {
                log.LogWarning("Missing {Path}; using code defaults for balance.", GlobalPath);
                return;
            }

            using var doc = JsonDocument.Parse(File.ReadAllText(GlobalPath));
            if (!doc.RootElement.TryGetProperty("balance", out var bal) ||
                bal.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            ReadInt(bal, "xpBase", v => opts.XpBase = v);
            ReadDouble(bal, "xpScale", v => opts.XpScale = v);
            ReadInt(bal, "xpScaleStepEvery", v => opts.XpScaleStepEvery = v);
            ReadDouble(bal, "xpScaleStep", v => opts.XpScaleStep = v);
            ReadDouble(bal, "floorDifficultyMult", v => opts.FloorDifficultyMult = v);
            ReadDouble(bal, "floorRewardMult", v => opts.FloorRewardMult = v);
            ReadDouble(bal, "bossChallengeAttrMult", v => opts.BossChallengeAttrMult = v);
            ReadInt(bal, "bossChallengeFee", v => opts.BossChallengeFee = v);
            ReadDouble(bal, "floorOwnerFeeShare", v => opts.FloorOwnerFeeShare = v);
            ReadDouble(bal, "deathXpPenalty", v => opts.DeathXpPenalty = v);
            ReadInt(bal, "trainingCostBase", v => opts.TrainingCostBase = v);
            ReadDouble(bal, "trainingGoldScale", v => opts.TrainingGoldScale = v);
            ReadInt(bal, "battleCoinRewardBase", v => opts.BattleCoinRewardBase = v);
            ReadDouble(bal, "hpRegenGlobalMult", v => opts.HpRegenGlobalMult = v);
            ReadDouble(bal, "hpDefeatRevivePct", v => opts.HpDefeatRevivePct = v);
            ReadDouble(bal, "combatTurnSeconds", v => opts.CombatTurnSeconds = v);
            ReadDouble(bal, "combatDamageNoise", v => opts.CombatDamageNoise = v);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to parse balance from {Path}; using code defaults.", GlobalPath);
        }
    }

    /// <summary>Only overrides when the env/config key is non-empty.</summary>
    private void ApplyEnvOverrides(GameBalanceOptions opts)
    {
        var c = config;
        if (TryInt(c, "XP_BASE", out var xpBase)) opts.XpBase = xpBase;
        if (TryDouble(c, "XP_SCALE", out var xpScale)) opts.XpScale = xpScale;
        if (TryInt(c, "XP_SCALE_STEP_EVERY", out var stepEvery)) opts.XpScaleStepEvery = stepEvery;
        if (TryDouble(c, "XP_SCALE_STEP", out var step)) opts.XpScaleStep = step;
        if (TryDouble(c, "FLOOR_DIFFICULTY_MULT", out var fdm)) opts.FloorDifficultyMult = fdm;
        if (TryDouble(c, "FLOOR_REWARD_MULT", out var frm)) opts.FloorRewardMult = frm;
        if (TryDouble(c, "BOSS_CHALLENGE_ATTR_MULT", out var bcam)) opts.BossChallengeAttrMult = bcam;
        if (TryInt(c, "BOSS_CHALLENGE_FEE", out var bcf)) opts.BossChallengeFee = bcf;
        if (TryDouble(c, "FLOOR_OWNER_FEE_SHARE", out var fofs)) opts.FloorOwnerFeeShare = fofs;
        if (TryDouble(c, "DEATH_XP_PENALTY", out var dxp)) opts.DeathXpPenalty = dxp;
        if (TryInt(c, "TRAINING_COST_BASE", out var tcb)) opts.TrainingCostBase = tcb;
        if (TryDouble(c, "TRAINING_GOLD_SCALE", out var tgs)) opts.TrainingGoldScale = tgs;
        if (TryInt(c, "BATTLE_COIN_REWARD_BASE", out var bcrb)) opts.BattleCoinRewardBase = bcrb;
        if (TryDouble(c, "HP_REGEN_GLOBAL_MULT", out var hrgm)) opts.HpRegenGlobalMult = hrgm;
        if (TryDouble(c, "HP_DEFEAT_REVIVE_PCT", out var hdrp)) opts.HpDefeatRevivePct = hdrp;
        if (TryDouble(c, "COMBAT_TURN_SECONDS", out var cts)) opts.CombatTurnSeconds = cts;
        if (TryDouble(c, "COMBAT_DAMAGE_NOISE", out var cdn)) opts.CombatDamageNoise = cdn;
    }

    private static void ReadInt(JsonElement obj, string name, Action<int> set)
    {
        if (obj.TryGetProperty(name, out var el) && el.TryGetInt32(out var v))
        {
            set(v);
        }
    }

    private static void ReadDouble(JsonElement obj, string name, Action<double> set)
    {
        if (obj.TryGetProperty(name, out var el) && el.TryGetDouble(out var v))
        {
            set(v);
        }
    }

    private static bool TryInt(IConfiguration c, string key, out int value)
    {
        value = 0;
        var raw = c[key];
        return !string.IsNullOrWhiteSpace(raw) &&
               int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
    }

    private static bool TryDouble(IConfiguration c, string key, out double value)
    {
        value = 0;
        var raw = c[key];
        return !string.IsNullOrWhiteSpace(raw) &&
               double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }
}
