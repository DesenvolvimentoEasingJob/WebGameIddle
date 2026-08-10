using System.Text.Json.Nodes;

namespace SkySpire.Api.Services;

/// <summary>
/// Grip (oneHand/twoHand) = quantos slots de mão o item ocupa.
/// Ghost = cópia visual nos slots satélite; não conta stats.
/// </summary>
public static class EquipmentGripHelper
{
    public static readonly HashSet<string> HandItemTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "weapon",
        "shield",
        "focus"
    };

    public const string GripOneHand = "oneHand";
    public const string GripTwoHand = "twoHand";

    public static bool IsHandItemType(string? type) =>
        !string.IsNullOrEmpty(type) && HandItemTypes.Contains(type);

    public static bool IsHandSlot(JsonObject slotDef)
    {
        if (slotDef["itemType"] is not JsonArray allowed)
        {
            return false;
        }

        return allowed.Any(a =>
        {
            var t = a?.GetValue<string>();
            return t == "*" || IsHandItemType(t);
        });
    }

    public static List<string> OrderedHandSlotNames(JsonArray equipmentSlots)
    {
        var names = new List<string>();
        foreach (var s in equipmentSlots)
        {
            if (s is not JsonObject o)
            {
                continue;
            }

            if (!IsHandSlot(o))
            {
                continue;
            }

            var name = o["name"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(name))
            {
                names.Add(name);
            }
        }

        return names;
    }

    public static string NormalizeGrip(string? grip) =>
        string.Equals(grip, GripTwoHand, StringComparison.OrdinalIgnoreCase)
            ? GripTwoHand
            : GripOneHand;

    /// <summary>Slots ocupados: oneHand=1, twoHand=2. handSlots numérico sobrescreve.</summary>
    public static int ResolveHandSlotCount(JsonObject item)
    {
        if (item["handSlots"] is JsonValue hv && hv.TryGetValue(out int n) && n >= 1)
        {
            return n;
        }

        return NormalizeGrip(item["grip"]?.GetValue<string>()) == GripTwoHand ? 2 : 1;
    }

    public static bool IsGhost(JsonObject? node) =>
        node is not null && node["ghost"]?.GetValue<bool>() == true;

    public static string? GhostOccupiedBy(JsonObject ghost) =>
        ghost["occupiedBy"]?.GetValue<string>();

    public static string? GhostAnchorSlot(JsonObject ghost) =>
        ghost["anchorSlot"]?.GetValue<string>();

    public static string? InstanceIdOf(JsonObject item) =>
        item["instanceId"]?.GetValue<string>();

    /// <summary>
    /// Escolhe slots de mão a ocupar: âncora + próximos livres/deslocáveis na ordem da raça.
    /// </summary>
    public static List<string> PickHandSlotsToOccupy(
        IReadOnlyList<string> handSlotNames,
        string anchorSlot,
        int slotCount)
    {
        if (slotCount < 1)
        {
            throw new InventoryException("Invalid grip slot count.");
        }

        if (!handSlotNames.Contains(anchorSlot, StringComparer.Ordinal))
        {
            throw new InventoryException("Grip items must be equipped on a hand slot.");
        }

        if (slotCount == 1)
        {
            return [anchorSlot];
        }

        if (handSlotNames.Count < slotCount)
        {
            throw new InventoryException(
                $"Not enough hand slots for this grip (needs {slotCount}, race has {handSlotNames.Count}).");
        }

        var chosen = new List<string> { anchorSlot };
        foreach (var name in handSlotNames)
        {
            if (chosen.Count >= slotCount)
            {
                break;
            }

            if (string.Equals(name, anchorSlot, StringComparison.Ordinal))
            {
                continue;
            }

            chosen.Add(name);
        }

        if (chosen.Count < slotCount)
        {
            throw new InventoryException($"Not enough hand slots for this grip (needs {slotCount}).");
        }

        return chosen;
    }

    /// <summary>
    /// Todos os nomes de slot que fazem parte do mesmo item (âncora + ghosts).
    /// </summary>
    public static List<string> CollectGripGroupSlots(JsonObject equipment, string slotName)
    {
        if (equipment[slotName] is not JsonObject node)
        {
            return [];
        }

        string? instanceId;
        string? anchor;

        if (IsGhost(node))
        {
            instanceId = GhostOccupiedBy(node);
            anchor = GhostAnchorSlot(node);
        }
        else
        {
            instanceId = InstanceIdOf(node);
            anchor = slotName;
        }

        var result = new List<string>();
        if (!string.IsNullOrEmpty(anchor) && equipment[anchor] is not null)
        {
            result.Add(anchor);
        }

        if (string.IsNullOrEmpty(instanceId))
        {
            if (result.Count == 0)
            {
                result.Add(slotName);
            }

            return result.Distinct(StringComparer.Ordinal).ToList();
        }

        foreach (var prop in equipment.ToList())
        {
            if (prop.Value is not JsonObject o)
            {
                continue;
            }

            if (IsGhost(o) &&
                string.Equals(GhostOccupiedBy(o), instanceId, StringComparison.Ordinal))
            {
                if (!result.Contains(prop.Key, StringComparer.Ordinal))
                {
                    result.Add(prop.Key);
                }
            }
            else if (!IsGhost(o) &&
                     string.Equals(InstanceIdOf(o), instanceId, StringComparison.Ordinal) &&
                     !result.Contains(prop.Key, StringComparer.Ordinal))
            {
                result.Add(prop.Key);
            }
        }

        if (result.Count == 0)
        {
            result.Add(slotName);
        }

        return result;
    }

    /// <summary>
    /// Remove o grupo grip e devolve o item real (não-ghost) para a bag, se houver.
    /// </summary>
    public static JsonObject? UnequipGripGroup(JsonObject equipment, JsonArray bagItems, string slotName)
    {
        var group = CollectGripGroupSlots(equipment, slotName);
        JsonObject? real = null;

        foreach (var name in group)
        {
            if (equipment[name] is not JsonObject node)
            {
                continue;
            }

            if (!IsGhost(node) && real is null)
            {
                real = node.DeepClone() as JsonObject;
            }

            equipment.Remove(name);
        }

        if (real is not null)
        {
            real.Remove("ghost");
            real.Remove("occupiedBy");
            real.Remove("anchorSlot");
            bagItems.Add(real);
        }

        return real;
    }

    public static JsonObject BuildGhost(JsonObject realItem, string instanceId, string anchorSlot)
    {
        var ghost = new JsonObject
        {
            ["ghost"] = true,
            ["occupiedBy"] = instanceId,
            ["anchorSlot"] = anchorSlot,
            ["qty"] = 1
        };

        CopyIfPresent(realItem, ghost, "templateId");
        CopyIfPresent(realItem, ghost, "name");
        CopyIfPresent(realItem, ghost, "type");
        CopyIfPresent(realItem, ghost, "grip");
        CopyIfPresent(realItem, ghost, "itemLevel");
        CopyIfPresent(realItem, ghost, "rarityId");
        CopyIfPresent(realItem, ghost, "rarityName");
        CopyIfPresent(realItem, ghost, "stars");
        CopyIfPresent(realItem, ghost, "qualityName");

        if (realItem["assets"] is not null)
        {
            ghost["assets"] = realItem["assets"]!.DeepClone();
        }

        if (realItem["colorStart"] is not null)
        {
            ghost["colorStart"] = realItem["colorStart"]!.DeepClone();
        }

        if (realItem["colorEnd"] is not null)
        {
            ghost["colorEnd"] = realItem["colorEnd"]!.DeepClone();
        }

        return ghost;
    }

    private static void CopyIfPresent(JsonObject src, JsonObject dst, string key)
    {
        if (src[key] is not null)
        {
            dst[key] = src[key]!.DeepClone();
        }
    }
}
