using System.Text.Json.Nodes;
using SkySpire.Api.Services;

namespace SkySpire.Api.Tests;

public class EquipmentGripHelperTests
{
    [Fact]
    public void ResolveHandSlotCount_Defaults_To_One()
    {
        Assert.Equal(1, EquipmentGripHelper.ResolveHandSlotCount(new JsonObject()));
        Assert.Equal(1, EquipmentGripHelper.ResolveHandSlotCount(new JsonObject { ["grip"] = "oneHand" }));
        Assert.Equal(2, EquipmentGripHelper.ResolveHandSlotCount(new JsonObject { ["grip"] = "twoHand" }));
        Assert.Equal(3, EquipmentGripHelper.ResolveHandSlotCount(new JsonObject
        {
            ["grip"] = "twoHand",
            ["handSlots"] = 3
        }));
    }

    [Fact]
    public void OrderedHandSlotNames_Filters_Hand_Compatible_Slots()
    {
        var slots = JsonNode.Parse("""
            [
              { "name": "head", "itemType": ["helmet"], "boxSize": 1 },
              { "name": "mainHand", "itemType": ["weapon"], "boxSize": 1 },
              { "name": "offHand", "itemType": ["weapon", "shield"], "boxSize": 1 },
              { "name": "hand3", "itemType": ["weapon"], "boxSize": 1 },
              { "name": "hand4", "itemType": ["focus"], "boxSize": 1 },
              { "name": "ring1", "itemType": ["ring"], "boxSize": 10 }
            ]
            """) as JsonArray ?? [];

        var hands = EquipmentGripHelper.OrderedHandSlotNames(slots);
        Assert.Equal(["mainHand", "offHand", "hand3", "hand4"], hands);
    }

    [Fact]
    public void PickHandSlotsToOccupy_TwoHand_Uses_Anchor_Plus_Next()
    {
        var hands = new List<string> { "mainHand", "offHand", "hand3", "hand4" };
        Assert.Equal(
            ["mainHand", "offHand"],
            EquipmentGripHelper.PickHandSlotsToOccupy(hands, "mainHand", 2));
        Assert.Equal(
            ["hand3", "mainHand"],
            EquipmentGripHelper.PickHandSlotsToOccupy(hands, "hand3", 2));
        Assert.Equal(
            ["hand3", "mainHand", "offHand", "hand4"],
            EquipmentGripHelper.PickHandSlotsToOccupy(hands, "hand3", 4));
    }

    [Fact]
    public void PickHandSlotsToOccupy_Throws_When_Not_Enough_Hands()
    {
        var hands = new List<string> { "mainHand", "offHand" };
        Assert.Throws<InventoryException>(() =>
            EquipmentGripHelper.PickHandSlotsToOccupy(hands, "mainHand", 3));
    }

    [Fact]
    public void UnequipGripGroup_Removes_Ghosts_And_Returns_Real_Once()
    {
        var real = new JsonObject
        {
            ["instanceId"] = "abc",
            ["templateId"] = "briar-spear",
            ["grip"] = "twoHand",
            ["stats"] = new JsonObject { ["dmgBase"] = 6 }
        };
        var equipment = new JsonObject
        {
            ["mainHand"] = real,
            ["offHand"] = EquipmentGripHelper.BuildGhost(real, "abc", "mainHand"),
            ["head"] = new JsonObject { ["instanceId"] = "helm", ["templateId"] = "leather-helm" }
        };
        var bag = new JsonArray();

        var returned = EquipmentGripHelper.UnequipGripGroup(equipment, bag, "offHand");

        Assert.NotNull(returned);
        Assert.Equal("abc", returned!["instanceId"]?.GetValue<string>());
        Assert.Null(equipment["mainHand"]);
        Assert.Null(equipment["offHand"]);
        Assert.NotNull(equipment["head"]);
        Assert.Single(bag);
        Assert.Null(bag[0]!["ghost"]);
    }

    [Fact]
    public void CollectGripGroupSlots_From_Anchor_Or_Ghost()
    {
        var real = new JsonObject { ["instanceId"] = "x", ["grip"] = "twoHand" };
        var equipment = new JsonObject
        {
            ["mainHand"] = real,
            ["offHand"] = EquipmentGripHelper.BuildGhost(real, "x", "mainHand")
        };

        Assert.Equal(
            ["mainHand", "offHand"],
            EquipmentGripHelper.CollectGripGroupSlots(equipment, "mainHand").OrderBy(s => s));
        Assert.Contains("mainHand", EquipmentGripHelper.CollectGripGroupSlots(equipment, "offHand"));
        Assert.Contains("offHand", EquipmentGripHelper.CollectGripGroupSlots(equipment, "offHand"));
    }
}
