using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class StatCalculatorTests
{
    [Fact]
    public void Evaluate_Respects_Operator_Precedence()
    {
        var stats = new Dictionary<string, double> { ["hpBase"] = 100, ["strength"] = 5 };
        var result = StatCalculator.Evaluate("hpBase + strength * 0.2", stats);
        Assert.Equal(101, result);
    }

    [Fact]
    public void ApplyAttributeFormulas_Adds_Scaled_Contribution()
    {
        var calc = CreateCalculator();
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["strength"] = 10,
            ["hpBase"] = 100,
            ["dmgBase"] = 10,
            ["capBase"] = 40
        };

        calc.ApplyAttributeFormulas(stats, "strength", ["hpBase * 0.2", "dmgBase * 0.4", "capBase * 0.3"]);

        Assert.Equal(102, stats["hpBase"]);
        Assert.Equal(14, stats["dmgBase"]);
        Assert.Equal(43, stats["capBase"]);
    }

    [Fact]
    public void ApplyAttributeFormulas_Skips_Missing_Attribute()
    {
        var calc = CreateCalculator();
        var stats = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["hpBase"] = 100
        };

        calc.ApplyAttributeFormulas(stats, "strength", ["hpBase * 0.2"]);
        Assert.Equal(100, stats["hpBase"]);
    }

    private static StatCalculator CreateCalculator()
    {
        var content = new ContentService(Microsoft.Extensions.Options.Options.Create(
            new Configuration.AppSecretsOptions { ContentPath = ".", DataPath = "." }));
        return new StatCalculator(content);
    }
}
