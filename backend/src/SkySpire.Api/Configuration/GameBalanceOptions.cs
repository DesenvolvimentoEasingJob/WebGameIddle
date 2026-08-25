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
    /// Intervalo base de ação (ms) quando <c>attackSpeed = 1.0</c>.
    /// Próximo ato = agora + base / max(attackSpeed, ε).
    /// </summary>
    public int CombatBaseActionMs { get; set; } = 1000;

    /// <summary>Duração máxima da simulação de combate (ms).</summary>
    public int CombatMaxDurationMs { get; set; } = 60000;

    /// <summary>Período dos ticks de regen em combate (ms).</summary>
    public int CombatRegenTickMs { get; set; } = 1000;

    /// <summary>
    /// Amplitude do ruído RNG somado ao dano do golpe (<c>rng × noise</c>).
    /// Crit/dodge/defesa/bônus vêm do JSON — não deste env.
    /// </summary>
    public double CombatDamageNoise { get; set; } = 0;

    /// <summary>
    /// Defesa que resulta em ~50% de redução física:
    /// <c>reduction = def^p / (def^p + mid^p)</c>.
    /// </summary>
    public double CombatArmorMidDef { get; set; } = 4800;

    /// <summary>
    /// Expoente da curva de armadura (menor = late mais longo).
    /// Com mid=4800 e p≈0.31: ~30% @ 300 def.
    /// </summary>
    public double CombatArmorPower { get; set; } = 0.31;

    /// <summary>Chance por monstro morto de tentar drop de item único (0–1).</summary>
    public double UniqueDropChance { get; set; } = 0.005;

    /// <summary>Feature flag; se false, nunca tenta único.</summary>
    public bool UniqueDropEnabled { get; set; } = true;

    /// <summary>
    /// Multiplica a chance base de cada raridade no pick do único (<c>min(1, chance × mult)</c>).
    /// </summary>
    public double UniqueRarityChanceMult { get; set; } = 7;

    /// <summary>Qualidade (estrelas) forçada no item único.</summary>
    public int UniqueStars { get; set; } = 5;

    /// <summary>Timeout OpenAI para flavor do único (ms).</summary>
    public int UniqueOpenAiTimeoutMs { get; set; } = 8000;

    /// <summary>Timeout PixelLab para ícone do único (ms).</summary>
    public int UniquePixelLabTimeoutMs { get; set; } = 45000;

    public double LevelAttributeMultiplier(int level)
    {
        var clamped = Math.Clamp(level, 1, LevelAttrCap);
        return LevelAttrMultAt1 + (clamped - 1) * LevelAttrFactor;
    }
}
