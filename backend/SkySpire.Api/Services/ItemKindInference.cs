namespace SkySpire.Api.Services;

public static class ItemKindInference
{
    public static string? FromItemId(string itemId)
    {
        if (itemId.Contains("staff", StringComparison.OrdinalIgnoreCase))
            return "staff";
        if (itemId.Contains("sword", StringComparison.OrdinalIgnoreCase))
            return "sword";
        if (itemId.Contains("armor", StringComparison.OrdinalIgnoreCase))
            return "armor";
        if (itemId.Contains("potion", StringComparison.OrdinalIgnoreCase))
            return "potion";

        return null;
    }
}
