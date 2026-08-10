using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Services;

public sealed class MarketService(
    AppDbContext db,
    EconomyService economy,
    CharacterService characters,
    ItemRollService itemRoll)
{
    public async Task<IReadOnlyList<object>> ListAsync(CancellationToken ct)
    {
        var active = await db.MarketListings.AsNoTracking()
            .Where(x => x.Active)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return active.Select(x =>
        {
            object? preview = null;
            if (!string.IsNullOrWhiteSpace(x.ItemSnapshotJson))
            {
                try
                {
                    preview = JsonSerializer.Deserialize<object>(x.ItemSnapshotJson);
                }
                catch
                {
                    preview = null;
                }
            }

            return (object)new
            {
                id = x.Id,
                itemId = x.ItemId,
                priceEach = x.PriceEach,
                quantity = x.Quantity,
                sellerId = x.SellerId,
                createdAt = x.CreatedAt,
                item = preview
            };
        }).ToList();
    }

    /// <summary>Lista um slot da bag (snapshot completo). Materiais podem usar quantity &gt; 1.</summary>
    public async Task<object> ListFromBagAsync(
        Guid sellerId,
        int bagIndex,
        int quantity,
        long priceEach,
        CancellationToken ct)
    {
        if (quantity < 1)
        {
            throw new MarketException("Quantity must be at least 1.");
        }

        if (priceEach < 1)
        {
            throw new MarketException("Price must be at least 1.");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == sellerId, ct)
            ?? throw new MarketException("User not found.");
        if (string.IsNullOrEmpty(user.BagJsonPath) || !File.Exists(user.BagJsonPath))
        {
            throw new MarketException("No bag.");
        }

        var (bagPath, bag) = await characters.LoadMutableBagAsync(sellerId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();
        if (bagIndex < 0 || bagIndex >= items.Count || items[bagIndex] is not JsonObject raw)
        {
            throw new MarketException("Invalid bag index.");
        }

        var item = await itemRoll.ExpandLegacyOrPassthroughAsync((JsonObject)raw.DeepClone(), ct);
        var have = item["qty"]?.GetValue<int>() ?? 1;
        if (quantity > have)
        {
            throw new MarketException("Not enough quantity.");
        }

        var templateId = ItemRollService.ResolveTemplateId(item) ?? "unknown";
        JsonObject listedSnapshot;

        if (ItemRollService.IsStackable(item))
        {
            listedSnapshot = (JsonObject)item.DeepClone();
            listedSnapshot["qty"] = quantity;
            if (have == quantity)
            {
                items.RemoveAt(bagIndex);
            }
            else
            {
                raw["qty"] = have - quantity;
            }
        }
        else
        {
            if (quantity != 1)
            {
                throw new MarketException("Unique equipment must be listed with quantity 1.");
            }

            listedSnapshot = item;
            items.RemoveAt(bagIndex);
        }

        bag["items"] = items;
        await characters.SaveBagNodeAsync(bagPath, bag, ct);

        var listing = new MarketListing
        {
            SellerId = sellerId,
            ItemId = templateId,
            Quantity = quantity,
            PriceEach = priceEach,
            Active = true,
            ItemSnapshotJson = listedSnapshot.ToJsonString()
        };
        db.MarketListings.Add(listing);
        await db.SaveChangesAsync(ct);

        return new
        {
            listing.Id,
            listing.ItemId,
            listing.Quantity,
            listing.PriceEach,
            item = JsonSerializer.Deserialize<object>(listing.ItemSnapshotJson)
        };
    }

    public async Task<object> BuyAsync(Guid buyerId, Guid listingId, int quantity, CancellationToken ct)
    {
        if (quantity < 1)
        {
            throw new MarketException("Quantity must be at least 1.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var listing = await db.MarketListings.FirstOrDefaultAsync(x => x.Id == listingId && x.Active, ct)
            ?? throw new MarketException("Listing not found.");

        if (listing.SellerId == buyerId)
        {
            throw new MarketException("Cannot buy your own listing.");
        }

        if (quantity > listing.Quantity)
        {
            throw new MarketException("Not enough quantity on listing.");
        }

        var total = listing.PriceEach * quantity;
        await economy.TransferAsync(
            buyerId,
            listing.SellerId,
            total,
            "market_buy",
            listing.Id.ToString(),
            ct);

        var buyer = await db.Users.FirstOrDefaultAsync(u => u.Id == buyerId, ct)
            ?? throw new MarketException("Buyer not found.");
        if (string.IsNullOrEmpty(buyer.BagJsonPath) || !File.Exists(buyer.BagJsonPath))
        {
            throw new MarketException("Buyer has no bag.");
        }

        var (bagPath, bag) = await characters.LoadMutableBagAsync(buyerId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();

        if (string.IsNullOrWhiteSpace(listing.ItemSnapshotJson))
        {
            // Legado: só itemId
            AddLegacyMaterial(items, listing.ItemId, quantity);
        }
        else
        {
            var snap = JsonNode.Parse(listing.ItemSnapshotJson) as JsonObject
                ?? throw new MarketException("Invalid listing snapshot.");

            if (ItemRollService.IsStackable(snap))
            {
                var chunk = (JsonObject)snap.DeepClone();
                chunk["qty"] = quantity;
                chunk["instanceId"] = Guid.NewGuid().ToString();
                items.Add(chunk);
            }
            else
            {
                if (quantity != 1 || listing.Quantity != 1)
                {
                    throw new MarketException("Unique listings must be bought as a whole.");
                }

                var unique = (JsonObject)snap.DeepClone();
                unique["instanceId"] = Guid.NewGuid().ToString();
                unique["qty"] = 1;
                items.Add(unique);
            }
        }

        bag["items"] = items;
        await characters.SaveBagNodeAsync(bagPath, bag, ct);

        listing.Quantity -= quantity;
        if (listing.Quantity <= 0)
        {
            listing.Active = false;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new
        {
            listingId = listing.Id,
            itemId = listing.ItemId,
            quantity,
            totalPaid = total,
            skyCoin = await economy.GetBalanceAsync(buyerId, ct)
        };
    }

    public async Task CancelAsync(Guid sellerId, Guid listingId, CancellationToken ct)
    {
        var listing = await db.MarketListings.FirstOrDefaultAsync(x => x.Id == listingId && x.Active, ct)
            ?? throw new MarketException("Listing not found.");
        if (listing.SellerId != sellerId)
        {
            throw new MarketException("Not your listing.");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == sellerId, ct)
            ?? throw new MarketException("User not found.");
        if (string.IsNullOrEmpty(user.BagJsonPath) || !File.Exists(user.BagJsonPath))
        {
            throw new MarketException("No bag.");
        }

        var (bagPath, bag) = await characters.LoadMutableBagAsync(sellerId, ct);
        var items = bag["items"] as JsonArray ?? new JsonArray();

        if (!string.IsNullOrWhiteSpace(listing.ItemSnapshotJson) &&
            JsonNode.Parse(listing.ItemSnapshotJson) is JsonObject snap)
        {
            var restored = (JsonObject)snap.DeepClone();
            restored["qty"] = listing.Quantity;
            if (restored["instanceId"] is null)
            {
                restored["instanceId"] = Guid.NewGuid().ToString();
            }

            items.Add(restored);
        }
        else
        {
            AddLegacyMaterial(items, listing.ItemId, listing.Quantity);
        }

        bag["items"] = items;
        await characters.SaveBagNodeAsync(bagPath, bag, ct);

        listing.Active = false;
        listing.Quantity = 0;
        await db.SaveChangesAsync(ct);
    }

    private static void AddLegacyMaterial(JsonArray items, string itemId, int qty)
    {
        foreach (var n in items)
        {
            if (n is JsonObject o &&
                string.Equals(ItemRollService.ResolveTemplateId(o), itemId, StringComparison.OrdinalIgnoreCase) &&
                ItemRollService.IsStackable(o))
            {
                o["qty"] = (o["qty"]?.GetValue<int>() ?? 0) + qty;
                return;
            }
        }

        items.Add(new JsonObject
        {
            ["templateId"] = itemId,
            ["itemId"] = itemId,
            ["type"] = "material",
            ["stackable"] = true,
            ["qty"] = qty,
            ["instanceId"] = Guid.NewGuid().ToString()
        });
    }
}

public sealed class MarketException(string message) : Exception(message);
