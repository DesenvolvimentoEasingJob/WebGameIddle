namespace SkySpire.Api.Configuration;

/// <summary>
/// Multiplicadores e regras numéricas do jogo (Game-base + env).
/// Level attr: multiplier = LevelAttrMultAt1 + (level - 1) * LevelAttrFactor
/// Com defaults, nível 1 → 0.001 e nível 2000 → ~2.0
/// </summary>
public sealed class GameBalanceOptions
{
    public const string SectionName = "GameBalance";

    public int XpBase { get; set; } = 100;
    public double XpScale { get; set; } = 1.2;
    public int XpScaleStepEvery { get; set; } = 10;
    public double XpScaleStep { get; set; } = 0.1;

    /// <summary>Multiplicador de atributos no nível 1.</summary>
    public double LevelAttrMultAt1 { get; set; } = 0.001;

    /// <summary>Incremento do multiplicador por nível após o 1.</summary>
    public double LevelAttrFactor { get; set; } = 0.0009995;

    public int LevelAttrCap { get; set; } = 2000;

    public double FloorDifficultyMult { get; set; } = 2.0;
    public double FloorRewardMult { get; set; } = 1.5;
    public double BossChallengeAttrMult { get; set; } = 10;
    public int BossChallengeFee { get; set; } = 50;
    public double FloorOwnerFeeShare { get; set; } = 0.10;
    public double DeathXpPenalty { get; set; } = 0.10;
    public int TrainingCostBase { get; set; } = 10;

    /// <summary>Multiplica o lastCost do atributo para o próximo treino.</summary>
    public double TrainingGoldScale { get; set; } = 1.3;

    public int BattleCoinRewardBase { get; set; } = 2;

    /// <summary>
    /// Multiplica sementes/taxas legadas de migração. A taxa efetiva de regen
    /// vem do StatCalculator (baseStats + core.json); este knop ainda escala
    /// o fallback raça+classe na migração de personagens antigos.
    /// </summary>
    public double HpRegenGlobalMult { get; set; } = 1.0;

    /// <summary>Fração do HP máximo restaurada ao morrer.</summary>
    public double HpDefeatRevivePct { get; set; } = 0.5;

    /// <summary>
    /// Segundos simulados por turno de combate para <c>hpRegenPerSec</c>.
    /// Regen em batalha = taxa × este valor, ao fim de cada turno (player vivo).
    /// </summary>
    public double CombatTurnSeconds { get; set; } = 1.0;

    /// <summary>
    /// Amplitude do ruído RNG somado ao dano do golpe (<c>rng × noise</c>).
    /// Crit/dodge/defesa/bônus vêm do JSON — não deste env.
    /// </summary>
    public double CombatDamageNoise { get; set; } = 0;

    public double LevelAttributeMultiplier(int level)
    {
        var clamped = Math.Clamp(level, 1, LevelAttrCap);
        return LevelAttrMultAt1 + (clamped - 1) * LevelAttrFactor;
    }
}
