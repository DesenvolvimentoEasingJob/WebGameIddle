using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

internal static class JsonNodeExtensions
{
    /// <summary>
    /// Lê inteiros de JsonNode sem falhar quando o valor foi persistido como Int64.
    /// </summary>
    public static int GetInt32Value(this JsonNode? node, int fallback = 0)
    {
        if (node is null)
            return fallback;

        try
        {
            return node.GetValue<int>();
        }
        catch (InvalidOperationException)
        {
            try
            {
                var value = node.GetValue<long>();
                return value switch
                {
                    >= int.MaxValue => int.MaxValue,
                    <= int.MinValue => int.MinValue,
                    _ => (int)value,
                };
            }
            catch (InvalidOperationException)
            {
                try
                {
                    return Convert.ToInt32(node.GetValue<double>());
                }
                catch (InvalidOperationException)
                {
                    return fallback;
                }
            }
        }
    }
}
