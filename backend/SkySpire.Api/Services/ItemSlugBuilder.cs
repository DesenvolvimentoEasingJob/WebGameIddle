using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SkySpire.Api.Services;

public static partial class ItemSlugBuilder
{
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "o", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "um", "uma",
        "the", "of", "and",
    };

    private static readonly Dictionary<string, string[]> KindWords = new(StringComparer.OrdinalIgnoreCase)
    {
        ["staff"] = ["staff", "cajado", "bastao", "bastão"],
        ["sword"] = ["sword", "espada", "blade", "lamina", "lâmina"],
        ["armor"] = ["armor", "armadura", "armour", "vestes", "tunica", "túnica", "robe", "robes"],
        ["potion"] = ["potion", "pocao", "poção"],
    };

    /// <summary>
    /// IDs legíveis no padrão iron-sword / leather-armor (kebab-case + tipo).
    /// </summary>
    public static string Build(string name, string itemKind, Func<string, bool> idExists)
    {
        var words = Tokenize(name)
            .Where(word => !StopWords.Contains(word))
            .Where(word => !ContainsKindWord(word, itemKind))
            .Take(3)
            .ToList();

        var core = words.Count > 0 ? string.Join('-', words) : "misterioso";
        var slug = EndsWithKind(core, itemKind) ? core : $"{core}-{itemKind}";

        slug = TrimSlug(slug);
        return EnsureUnique(slug, idExists);
    }

    private static string EnsureUnique(string slug, Func<string, bool> idExists)
    {
        if (!idExists(slug))
            return slug;

        for (var i = 2; i < 100; i++)
        {
            var candidate = $"{slug}-{i}";
            if (!idExists(candidate))
                return candidate;
        }

        return $"{slug}-{Guid.NewGuid():N}"[..24];
    }

    private static List<string> Tokenize(string name)
    {
        var normalized = RemoveDiacritics(name).ToLowerInvariant();
        return WordRegex().Split(normalized)
            .Select(word => word.Trim('-'))
            .Where(word => word.Length > 1)
            .ToList();
    }

    private static bool ContainsKindWord(string word, string itemKind) =>
        KindWords.TryGetValue(itemKind, out var words) &&
        words.Any(kindWord => string.Equals(kindWord, word, StringComparison.OrdinalIgnoreCase));

    private static bool EndsWithKind(string slug, string itemKind) =>
        slug.EndsWith($"-{itemKind}", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(slug, itemKind, StringComparison.OrdinalIgnoreCase);

    private static string TrimSlug(string slug) =>
        slug.Trim('-');

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                builder.Append(ch);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    [GeneratedRegex(@"[^a-z0-9]+", RegexOptions.IgnoreCase)]
    private static partial Regex WordRegex();
}
