using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SkySpire.Api.Services;

/// <summary>
/// Motor de atributos: fórmulas JSON com allowlist (idents, números, + - * / ()).
/// Para entradas sob um atributo (ex.: strength → "hpBase * 0.2"):
/// interpreta como target += attributeValue * factor.
/// Alvos citados no core e ausentes em baseStats recebem semente 1.
/// </summary>
public sealed class StatCalculator(ContentService content)
{
    public const double DefaultMissingTargetSeed = 1.0;

    private static readonly Regex TokenPattern = new(
        @"\s*([A-Za-z_][A-Za-z0-9_]*|\d+(\.\d+)?|[+\-*/()])\s*",
        RegexOptions.Compiled);

    public async Task<IReadOnlyDictionary<string, double>> CalculateFromCharacterAsync(
        JsonElement character,
        CancellationToken ct)
    {
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);

        if (character.TryGetProperty("baseStats", out var baseStats) &&
            baseStats.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in baseStats.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Number)
                {
                    stats[prop.Name] = prop.Value.GetDouble();
                }
            }
        }

        if (character.TryGetProperty("equipment", out var equipment) &&
            equipment.ValueKind == JsonValueKind.Object)
        {
            foreach (var slot in equipment.EnumerateObject())
            {
                if (slot.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                // Ghost de twoHand: só visual; stats vêm do slot âncora.
                if (slot.Value.TryGetProperty("ghost", out var ghostFlag) &&
                    ghostFlag.ValueKind is JsonValueKind.True)
                {
                    continue;
                }

                // Prefer baked snapshot stats on the equipped instance.
                if (slot.Value.TryGetProperty("stats", out var snapStats) &&
                    snapStats.ValueKind == JsonValueKind.Object)
                {
                    ApplyItemStats(stats, snapStats);
                    continue;
                }

                var templateId =
                    (slot.Value.TryGetProperty("templateId", out var tid) ? tid.GetString() : null)
                    ?? (slot.Value.TryGetProperty("itemId", out var iid) ? iid.GetString() : null);
                if (string.IsNullOrEmpty(templateId))
                {
                    continue;
                }

                var item = await content.GetByIdAsync("items", templateId, ct);
                if (item is null ||
                    !item.Value.TryGetProperty("stats", out var itemStats) ||
                    itemStats.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                ApplyItemStats(stats, itemStats);
            }
        }

        var attrDoc = await content.GetByIdAsync("attributes", "core", ct);
        if (attrDoc is not null)
        {
            SeedMissingFormulaTargets(stats, attrDoc.Value);

            foreach (var group in attrDoc.Value.EnumerateObject())
            {
                if (!TryGetFormulas(group.Value, out var formulas))
                {
                    continue;
                }

                ApplyAttributeFormulas(stats, group.Name, formulas);
            }
        }

        return stats;
    }

    /// <summary>
    /// Extrai fórmulas de um atributo: array legado ou objeto com <c>formulas</c>.
    /// </summary>
    public static bool TryGetFormulas(JsonElement attributeNode, out IReadOnlyList<string> formulas)
    {
        if (attributeNode.ValueKind == JsonValueKind.Array)
        {
            formulas = ReadFormulaArray(attributeNode);
            return formulas.Count > 0;
        }

        if (attributeNode.ValueKind == JsonValueKind.Object &&
            attributeNode.TryGetProperty("formulas", out var arr) &&
            arr.ValueKind == JsonValueKind.Array)
        {
            formulas = ReadFormulaArray(arr);
            return formulas.Count > 0;
        }

        formulas = Array.Empty<string>();
        return false;
    }

    /// <summary>
    /// Lista alvos de fórmulas do core (lado esquerdo de <c>target * fator</c> / <c>target - n</c>).
    /// </summary>
    public static IReadOnlyCollection<string> CollectFormulaTargets(JsonElement attrDoc)
    {
        var targets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var group in attrDoc.EnumerateObject())
        {
            if (!TryGetFormulas(group.Value, out var formulas))
            {
                continue;
            }

            foreach (var formula in formulas)
            {
                if (TryParseTarget(formula, out var target))
                {
                    targets.Add(target);
                }
            }
        }

        return targets;
    }

    private static IReadOnlyList<string> ReadFormulaArray(JsonElement arr) =>
        arr.EnumerateArray()
            .Select(x => x.GetString())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Cast<string>()
            .ToList();

    public static void SeedMissingFormulaTargets(
        Dictionary<string, double> stats,
        JsonElement attrDoc,
        double seed = DefaultMissingTargetSeed)
    {
        foreach (var target in CollectFormulaTargets(attrDoc))
        {
            if (!stats.ContainsKey(target))
            {
                stats[target] = seed;
            }
        }
    }

    /// <summary>
    /// Garante sementes em <c>baseStats</c> persistido para todo alvo do core ausente.
    /// </summary>
    public async Task<bool> EnsureBaseStatSeedsAsync(
        System.Text.Json.Nodes.JsonObject character,
        CancellationToken ct,
        double seed = DefaultMissingTargetSeed)
    {
        var attrDoc = await content.GetByIdAsync("attributes", "core", ct);
        if (attrDoc is null)
        {
            return false;
        }

        var baseStats = character["baseStats"] as System.Text.Json.Nodes.JsonObject
                        ?? new System.Text.Json.Nodes.JsonObject();
        character["baseStats"] = baseStats;

        var changed = false;
        foreach (var target in CollectFormulaTargets(attrDoc.Value))
        {
            if (baseStats[target] is null ||
                baseStats[target]!.GetValueKind() != JsonValueKind.Number)
            {
                baseStats[target] = seed;
                changed = true;
            }
        }

        return changed;
    }

    public void ApplyAttributeFormulas(
        Dictionary<string, double> stats,
        string attributeName,
        IEnumerable<string> formulas)
    {
        if (!stats.TryGetValue(attributeName, out var attrValue))
        {
            return;
        }

        foreach (var formula in formulas)
        {
            var mul = formula.Split('*', 2, StringSplitOptions.TrimEntries);
            if (mul.Length == 2 &&
                IsIdent(mul[0]) &&
                double.TryParse(mul[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var factor))
            {
                stats.TryGetValue(mul[0], out var current);
                stats[mul[0]] = current + attrValue * factor;
                continue;
            }

            var sub = formula.Split('-', 2, StringSplitOptions.TrimEntries);
            if (sub.Length == 2 &&
                IsIdent(sub[0]) &&
                double.TryParse(sub[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var amount))
            {
                stats.TryGetValue(sub[0], out var current);
                stats[sub[0]] = current - amount;
            }
        }
    }

    public static double Evaluate(string expression, IReadOnlyDictionary<string, double> stats)
    {
        var tokens = new List<string>();
        var remaining = expression.Trim();
        while (remaining.Length > 0)
        {
            var m = TokenPattern.Match(remaining);
            if (!m.Success || m.Index != 0)
            {
                throw new InvalidOperationException($"Invalid expression: {expression}");
            }

            tokens.Add(m.Groups[1].Value);
            remaining = remaining[m.Length..];
        }

        var values = new Stack<double>();
        var ops = new Stack<string>();

        static double ApplyOp(string op, double b, double a) => op switch
        {
            "+" => a + b,
            "-" => a - b,
            "*" => a * b,
            "/" => b == 0 ? throw new InvalidOperationException("Division by zero") : a / b,
            _ => throw new InvalidOperationException($"Unknown op {op}")
        };

        static int Prec(string op) => op is "+" or "-" ? 1 : 2;

        foreach (var token in tokens)
        {
            if (double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var num))
            {
                values.Push(num);
            }
            else if (IsIdent(token))
            {
                values.Push(stats.TryGetValue(token, out var v) ? v : 0);
            }
            else if (token == "(")
            {
                ops.Push(token);
            }
            else if (token == ")")
            {
                while (ops.Count > 0 && ops.Peek() != "(")
                {
                    values.Push(ApplyOp(ops.Pop(), values.Pop(), values.Pop()));
                }

                if (ops.Count == 0 || ops.Pop() != "(")
                {
                    throw new InvalidOperationException("Mismatched parentheses");
                }
            }
            else if (token is "+" or "-" or "*" or "/")
            {
                while (ops.Count > 0 && ops.Peek() is "+" or "-" or "*" or "/" && Prec(ops.Peek()) >= Prec(token))
                {
                    values.Push(ApplyOp(ops.Pop(), values.Pop(), values.Pop()));
                }

                ops.Push(token);
            }
            else
            {
                throw new InvalidOperationException($"Unexpected token: {token}");
            }
        }

        while (ops.Count > 0)
        {
            var op = ops.Pop();
            if (op is "(" or ")")
            {
                throw new InvalidOperationException("Mismatched parentheses");
            }

            values.Push(ApplyOp(op, values.Pop(), values.Pop()));
        }

        if (values.Count != 1)
        {
            throw new InvalidOperationException("Invalid expression evaluation");
        }

        return values.Pop();
    }

    private static bool TryParseTarget(string formula, out string target)
    {
        var mul = formula.Split('*', 2, StringSplitOptions.TrimEntries);
        if (mul.Length == 2 && IsIdent(mul[0]))
        {
            target = mul[0];
            return true;
        }

        var sub = formula.Split('-', 2, StringSplitOptions.TrimEntries);
        if (sub.Length == 2 && IsIdent(sub[0]))
        {
            target = sub[0];
            return true;
        }

        target = "";
        return false;
    }

    private static void ApplyItemStats(Dictionary<string, double> stats, JsonElement itemStats)
    {
        foreach (var bonus in itemStats.EnumerateObject())
        {
            if (bonus.Value.ValueKind != JsonValueKind.Number)
            {
                continue;
            }

            stats.TryGetValue(bonus.Name, out var current);
            stats[bonus.Name] = current + bonus.Value.GetDouble();
        }
    }

    private static bool IsIdent(string s) =>
        s.Length > 0 && (char.IsLetter(s[0]) || s[0] == '_') && s.All(c => char.IsLetterOrDigit(c) || c == '_');
}
