namespace SkySpire.Api.Services;

public static class ItemStoragePaths
{
    public static string GetSubfolder(string? itemKind, string? type = null) =>
        itemKind switch
        {
            "staff" => "staffs",
            "sword" => "swords",
            "armor" => "armors",
            "potion" => "potions",
            _ => type switch
            {
                "weapon" => "weapons",
                "armor" => "armors",
                "consumable" => "potions",
                _ => "misc",
            },
        };

    public static string BuildIconPath(string itemId, string? itemKind, string? type = null)
    {
        var folder = GetSubfolder(itemKind, type);
        return $"items/{folder}/{itemId}.png";
    }

    public static string GetItemDirectory(string gameDataRoot, string? itemKind, string? type = null) =>
        Path.Combine(gameDataRoot, "items", GetSubfolder(itemKind, type));

    public static string GetItemFilePath(string gameDataRoot, string itemId, string? itemKind, string? type = null) =>
        Path.Combine(
            GetItemDirectory(gameDataRoot, itemKind, type),
            $"{SanitizeFileName(itemId)}.json");

    public static string? FindItemFile(string gameDataRoot, string itemId)
    {
        var itemsRoot = Path.Combine(gameDataRoot, "items");
        if (!Directory.Exists(itemsRoot))
            return null;

        var matches = Directory.GetFiles(itemsRoot, $"{SanitizeFileName(itemId)}.json", SearchOption.AllDirectories);
        return matches.FirstOrDefault();
    }

    private static string SanitizeFileName(string id) =>
        string.Concat(id.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '-' : c));
}
