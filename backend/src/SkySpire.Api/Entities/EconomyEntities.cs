namespace SkySpire.Api.Entities;

public sealed class LedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public long Amount { get; set; }
    public long BalanceAfter { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class MarketListing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SellerId { get; set; }
    public string ItemId { get; set; } = string.Empty;
    /// <summary>JSON completo do item listado (snapshot da bag).</summary>
    public string? ItemSnapshotJson { get; set; }
    public int Quantity { get; set; } = 1;
    public long PriceEach { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool Active { get; set; } = true;
}

public sealed class CharacterStats
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string CharacterName { get; set; } = string.Empty;
    public int Level { get; set; } = 1;
    public int LastFloor { get; set; }
    public int LastRoom { get; set; }
    public int Kills { get; set; }
    public int FloorsOwned { get; set; }
    public long SkyCoin { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class FloorOwnership
{
    public int FloorNumber { get; set; }
    public Guid OwnerUserId { get; set; }
    public string OwnerUsername { get; set; } = string.Empty;
    public string SnapshotPath { get; set; } = string.Empty;
    public DateTimeOffset ClaimedAt { get; set; } = DateTimeOffset.UtcNow;
}
