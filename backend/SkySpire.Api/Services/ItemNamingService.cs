using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

public class ItemNamingService(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    GameDataLoader gameData,
    GameDataWriter gameDataWriter)
{
    public async Task<string> GenerateItemNameAsync(
        string itemKind,
        string rarityLabel,
        string? classId,
        CancellationToken ct)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        var model = configuration["OpenAI:Model"] ?? "gpt-4o-mini";
        if (string.IsNullOrWhiteSpace(apiKey))
            return BuildFallbackName(itemKind, rarityLabel);

        try
        {
            var client = httpClientFactory.CreateClient("OpenAI");
            var classHint = string.IsNullOrWhiteSpace(classId) ? "aventureiro" : classId;
            var payload = new
            {
                model,
                messages = new[]
                {
                    new
                    {
                        role = "system",
                        content =
                            "Você nomeia itens de RPG fantasy em português do Brasil. Responda só com o nome do item, sem aspas.",
                    },
                    new
                    {
                        role = "user",
                        content =
                            $"Crie um nome curto (2-4 palavras) para um item tipo '{itemKind}', raridade '{rarityLabel}', usado por {classHint}.",
                    },
                },
                max_tokens = 24,
                temperature = 0.9,
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");

            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                return BuildFallbackName(itemKind, rarityLabel);

            var json = await response.Content.ReadAsStringAsync(ct);
            var node = JsonNode.Parse(json)?.AsObject();
            var content = node?["choices"]?.AsArray()?[0]?["message"]?["content"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(content))
                return BuildFallbackName(itemKind, rarityLabel);

            var name = content.Trim().Trim('"');
            PersistNamePrefix(name);
            return name;
        }
        catch
        {
            return BuildFallbackName(itemKind, rarityLabel);
        }
    }

    private void PersistNamePrefix(string name)
    {
        var prefix = name.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (prefix is not null)
            gameDataWriter.TryAddProceduralPrefix(prefix);
    }

    public string BuildFallbackName(string itemKind, string rarityLabel)
    {
        var labels = gameData.ProceduralNameLabels;
        var prefixes = gameData.ProceduralPrefixes;
        var kindLabel = labels.GetValueOrDefault(itemKind) ?? itemKind;
        var prefix = prefixes.Count > 0
            ? prefixes[Random.Shared.Next(prefixes.Count)]
            : "Misterioso";

        return $"{prefix} {kindLabel} {rarityLabel}".Trim();
    }
}
