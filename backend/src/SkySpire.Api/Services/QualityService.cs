using System.Text.Json;



namespace SkySpire.Api.Services;



public sealed class RgbColor

{

    public int R { get; init; }

    public int G { get; init; }

    public int B { get; init; }

}



public sealed class QualityDefinition

{

    public int Stars { get; init; }

    public string Name { get; init; } = "";

    public RgbColor ColorStart { get; init; } = new();

    public RgbColor ColorEnd { get; init; } = new();

}



/// <summary>

/// Carrega <c>content/qualities/qualities.json</c> — cores RGB por qualidade (estrelas 1–5).

/// </summary>

public sealed class QualityService(ContentService content)

{

    private IReadOnlyDictionary<int, QualityDefinition>? _byStars;



    public async Task<QualityDefinition?> GetByStarsAsync(int stars, CancellationToken ct)

    {

        await EnsureLoadedAsync(ct);

        return _byStars!.GetValueOrDefault(Math.Clamp(stars, 1, 5));

    }



    public async Task<IReadOnlyList<QualityDefinition>> GetAllAsync(CancellationToken ct)

    {

        await EnsureLoadedAsync(ct);

        return _byStars!.Values.OrderBy(q => q.Stars).ToList();

    }



    private async Task EnsureLoadedAsync(CancellationToken ct)

    {

        if (_byStars is not null)

        {

            return;

        }



        var doc = await content.GetByIdAsync("qualities", "qualities", ct)

            ?? throw new InvalidOperationException("Missing content/qualities/qualities.json");



        if (!doc.TryGetProperty("qualities", out var arr) || arr.ValueKind != JsonValueKind.Array)

        {

            throw new InvalidOperationException("qualities.json missing qualities array.");

        }



        var map = new Dictionary<int, QualityDefinition>();

        foreach (var el in arr.EnumerateArray())

        {

            var stars = el.GetProperty("stars").GetInt32();

            map[stars] = new QualityDefinition

            {

                Stars = stars,

                Name = el.GetProperty("name").GetString() ?? "",

                ColorStart = ReadRgb(el.GetProperty("colorStart")),

                ColorEnd = ReadRgb(el.GetProperty("colorEnd"))

            };

        }



        if (map.Count == 0)

        {

            throw new InvalidOperationException("No qualities defined.");

        }



        _byStars = map;

    }



    private static RgbColor ReadRgb(JsonElement el) =>

        new()

        {

            R = ClampByte(el.GetProperty("r").GetInt32()),

            G = ClampByte(el.GetProperty("g").GetInt32()),

            B = ClampByte(el.GetProperty("b").GetInt32())

        };



    private static int ClampByte(int v) => Math.Clamp(v, 0, 255);

}

