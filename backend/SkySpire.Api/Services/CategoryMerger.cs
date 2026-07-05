using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public static class CategoryMerger
{
    public static JsonObject Merge(JsonObject baseCategories, JsonObject overlayCategories)
    {
        var result = CloneObject(baseCategories);

        foreach (var (key, overlayValue) in overlayCategories)
        {
            if (overlayValue is null)
                continue;

            if (result[key] is JsonObject baseChild && overlayValue is JsonObject overlayChild)
            {
                result[key] = Merge(baseChild, overlayChild);
                continue;
            }

            if (IsNumeric(result[key]) && IsNumeric(overlayValue))
            {
                result[key] = AddNumeric(result[key]!, overlayValue);
                continue;
            }

            result[key] = overlayValue.DeepClone();
        }

        return result;
    }

    private static JsonObject CloneObject(JsonObject source)
    {
        var clone = new JsonObject();
        foreach (var (key, value) in source)
            clone[key] = value?.DeepClone();
        return clone;
    }

    private static bool IsNumeric(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue(out double _);

    private static JsonNode AddNumeric(JsonNode left, JsonNode right)
    {
        var sum = left.GetValue<double>() + right.GetValue<double>();
        if (Math.Abs(sum % 1) < double.Epsilon)
            return JsonValue.Create((long)sum);
        return JsonValue.Create(sum);
    }
}
