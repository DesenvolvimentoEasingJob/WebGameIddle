using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class UniqueItemDropTests
{
    [Fact]
    public void ComposeUniqueName_Appends_Character()
    {
        var name = UniqueItemDropService.ComposeUniqueName("Espada de ossos", "SukerBerg");
        Assert.Equal("Espada de Ossos de SukerBerg", name);
    }

    [Fact]
    public void ComposeUniqueName_Does_Not_Duplicate_Character_Suffix()
    {
        var name = UniqueItemDropService.ComposeUniqueName("Espada de ossos de SukerBerg", "SukerBerg");
        Assert.Equal("Espada de Ossos de SukerBerg", name);
    }

    [Fact]
    public void ComposeUniqueName_Fallback_Theme()
    {
        var name = UniqueItemDropService.ComposeUniqueName("  ", "Felipe");
        Assert.Equal("Relíquia de Felipe", name);
    }
}
