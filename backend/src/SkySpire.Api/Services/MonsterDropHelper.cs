using System.Text.Json;

namespace SkySpire.Api.Services;

/// <summary>
/// Lê <c>skyCoinDrop</c> / <c>rarityLuck</c> do JSON do monstro e aplica luck em chances de raridade.
/// </summary>
public static class MonsterDropHelper
{
    /// <summary>
    /// Chance efetiva com luck: <c>1 − (1 − chance)^(1 + luck)</c>.
    /// Com <c>luck = 0</c> a chance fica igual à base (sistema top-down atual).
    /// </summary>
    public static double EffectiveChance(double chance, double luck)
    {
        chance = Math.Clamp(chance, 0, 1);
        luck = Math.Max(0, luck);
        if (chance <= 0 || luck <= 0)
        {
            return chance;
        }

        return Math.Clamp(1.0 - Math.Pow(1.0 - chance, 1.0 + luck), 0, 1);
    }

    public static double ReadRarityLuck(JsonElement monster)
    {
        if (!monster.TryGetProperty("rarityLuck", out var el) || el.ValueKind != JsonValueKind.Number)
        {
            return 0;
        }

        return Math.Max(0, el.GetDouble());
    }

    /// <summary>
    /// Tenta ler <c>skyCoinDrop: [min, max]</c>. Retorna false se o campo estiver ausente/inválido.
    /// </summary>
    public static bool TryReadSkyCoinDrop(JsonElement monster, out int min, out int max)
    {
        min = 0;
        max = 0;
        if (!monster.TryGetProperty("skyCoinDrop", out var el) || el.ValueKind != JsonValueKind.Array ||
            el.GetArrayLength() < 2)
        {
            return false;
        }

        if (el[0].ValueKind != JsonValueKind.Number || el[1].ValueKind != JsonValueKind.Number)
        {
            return false;
        }

        min = Math.Max(0, el[0].GetInt32());
        max = Math.Max(0, el[1].GetInt32());
        if (max < min)
        {
            (min, max) = (max, min);
        }

        return true;
    }

    /// <summary>
    /// Rola SkyCoin do monstro. <paramref name="defined"/> é true só se o JSON tiver <c>skyCoinDrop</c>.
    /// </summary>
    public static int RollSkyCoinDrop(JsonElement monster, Random rng, out bool defined)
    {
        defined = TryReadSkyCoinDrop(monster, out var min, out var max);
        if (!defined)
        {
            return 0;
        }

        if (min == max)
        {
            return min;
        }

        return rng.Next(min, max + 1);
    }
}
