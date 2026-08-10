using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

/// <summary>
/// HP corrente + regen. <c>hpRegenPerSec</c> é valor <b>bruto</b> (HP por segundo),
/// igual a dmgBase — não é fração do HP máximo.
/// Semente em <c>baseStats</c>; efetiva = StatCalculator (base + core.json + itens).
/// </summary>
public sealed class HpService(
    ContentService content,
    StatCalculator stats,
    GameConfigService gameConfig)
{
    /// <summary>Valores &lt; isto em baseStats são tratados como taxa % legada e migrados.</summary>
    public const double LegacyFractionThreshold = 0.5;

    public async Task<double> GetMaxHpAsync(JsonObject character, CancellationToken ct)
    {
        var calculated = await CalculateAsync(character, ct);
        return calculated.TryGetValue("hpBase", out var hp) ? Math.Max(1, hp) : 100;
    }

    public async Task<double> ResolveRegenRatePerSecAsync(JsonObject character, CancellationToken ct)
    {
        var calculated = await CalculateAsync(character, ct);
        return calculated.TryGetValue("hpRegenPerSec", out var rate) ? Math.Max(0, rate) : 0;
    }

    /// <summary>
    /// Garante semente absoluta em baseStats. Não grava taxa calculada no topo.
    /// </summary>
    public async Task<bool> EnsureRegenSeedAsync(JsonObject character, CancellationToken ct)
    {
        var changed = false;
        var baseStats = character["baseStats"] as JsonObject ?? new JsonObject();
        character["baseStats"] = baseStats;

        // 1) Top-level legado → baseStats
        if (character["hpRegenPerSec"] is JsonNode top &&
            top.GetValueKind() == JsonValueKind.Number)
        {
            if (baseStats["hpRegenPerSec"] is null ||
                baseStats["hpRegenPerSec"]!.GetValueKind() != JsonValueKind.Number)
            {
                baseStats["hpRegenPerSec"] = top.GetValue<double>();
                changed = true;
            }

            character.Remove("hpRegenPerSec");
            changed = true;
        }

        // 2) Ausente ou fração antiga (ex. 0.012) → semente bruta da raça/classe
        var needsRaceSeed = baseStats["hpRegenPerSec"] is null ||
                            baseStats["hpRegenPerSec"]!.GetValueKind() != JsonValueKind.Number;
        if (!needsRaceSeed)
        {
            var existing = baseStats["hpRegenPerSec"]!.GetValue<double>();
            if (existing > 0 && existing < LegacyFractionThreshold)
            {
                needsRaceSeed = true;
            }
        }

        if (needsRaceSeed)
        {
            baseStats["hpRegenPerSec"] = await ReadRaceClassSeedAsync(character, ct);
            changed = true;
        }

        // 3) Outros alvos do core ausentes → semente 1
        if (await stats.EnsureBaseStatSeedsAsync(character, ct))
        {
            changed = true;
        }

        return changed;
    }

    public async Task<HpSnapshot> ApplyRegenAsync(
        JsonObject character,
        CancellationToken ct,
        DateTimeOffset? now = null)
    {
        var seedChanged = await EnsureRegenSeedAsync(character, ct);
        var calculated = await CalculateAsync(character, ct);
        var maxHp = calculated.TryGetValue("hpBase", out var hp) ? Math.Max(1, hp) : 100;
        var rate = calculated.TryGetValue("hpRegenPerSec", out var r) ? Math.Max(0, r) : 0;
        var nowUtc = now ?? DateTimeOffset.UtcNow;
        var changed = seedChanged;

        double current;
        if (character["currentHp"] is null ||
            character["currentHp"]!.GetValueKind() == JsonValueKind.Null)
        {
            current = maxHp;
            character["currentHp"] = current;
            character["lastHpAt"] = nowUtc.ToString("O");
            return new HpSnapshot(RoundHp(current), RoundHp(maxHp), 0, rate, true);
        }

        current = character["currentHp"]!.GetValue<double>();
        if (current > maxHp)
        {
            current = maxHp;
            changed = true;
        }

        if (current < 0)
        {
            current = 0;
            changed = true;
        }

        DateTimeOffset lastAt = nowUtc;
        var lastRaw = character["lastHpAt"]?.GetValue<string>();
        if (!string.IsNullOrEmpty(lastRaw) && DateTimeOffset.TryParse(lastRaw, out var parsed))
        {
            lastAt = parsed;
        }
        else
        {
            changed = true;
        }

        var elapsed = Math.Max(0, (nowUtc - lastAt).TotalSeconds);
        var regenerated = 0.0;
        if (elapsed > 0 && current < maxHp && rate > 0)
        {
            // Valor bruto: HP por segundo (não % do máximo).
            regenerated = rate * elapsed;
            var next = Math.Min(maxHp, current + regenerated);
            regenerated = next - current;
            current = next;
            if (regenerated > 0)
            {
                changed = true;
            }
        }

        character["currentHp"] = current;
        character["lastHpAt"] = nowUtc.ToString("O");
        return new HpSnapshot(RoundHp(current), RoundHp(maxHp), RoundHp(regenerated), rate, changed);
    }

    public void SetCurrentHp(JsonObject character, double hp, double maxHp, DateTimeOffset? now = null)
    {
        var clamped = Math.Clamp(hp, 0, Math.Max(1, maxHp));
        character["currentHp"] = clamped;
        character["lastHpAt"] = (now ?? DateTimeOffset.UtcNow).ToString("O");
    }

    public void ApplyDefeatRevive(JsonObject character, double maxHp, DateTimeOffset? now = null)
    {
        var pct = Math.Clamp(gameConfig.GetBalance().HpDefeatRevivePct, 0, 1);
        SetCurrentHp(character, Math.Max(1, maxHp * pct), maxHp, now);
    }

    public static int RoundHp(double hp) => (int)Math.Round(Math.Max(0, hp));

    private async Task<IReadOnlyDictionary<string, double>> CalculateAsync(
        JsonObject character,
        CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(character.ToJsonString());
        return await stats.CalculateFromCharacterAsync(doc.RootElement, ct);
    }

    /// <summary>Semente bruta: raça.baseStats.hpRegenPerSec + class.hpRegenBonus.</summary>
    private async Task<double> ReadRaceClassSeedAsync(JsonObject character, CancellationToken ct)
    {
        var raceId = character["raceId"]?.GetValue<string>();
        var classId = character["classId"]?.GetValue<string>();
        var seed = 1.0;

        if (!string.IsNullOrEmpty(raceId))
        {
            var race = await content.GetByIdAsync("races", raceId, ct);
            if (race is { } r)
            {
                if (r.TryGetProperty("baseStats", out var bs) &&
                    bs.ValueKind == JsonValueKind.Object &&
                    bs.TryGetProperty("hpRegenPerSec", out var inBase) &&
                    inBase.ValueKind == JsonValueKind.Number)
                {
                    seed = Math.Max(0, inBase.GetDouble());
                }
            }
        }

        if (!string.IsNullOrEmpty(classId))
        {
            var cls = await content.GetByIdAsync("classes", classId, ct);
            if (cls is { } c &&
                c.TryGetProperty("hpRegenBonus", out var bonus) &&
                bonus.ValueKind == JsonValueKind.Number)
            {
                seed += bonus.GetDouble();
            }
        }

        return Math.Max(0, seed * gameConfig.GetBalance().HpRegenGlobalMult);
    }
}

public sealed record HpSnapshot(
    int CurrentHp,
    int MaxHp,
    int Regenerated,
    double HpRegenPerSec,
    bool Changed);
