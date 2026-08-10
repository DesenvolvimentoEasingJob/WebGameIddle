using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();
    public DbSet<MarketListing> MarketListings => Set<MarketListing>();
    public DbSet<CharacterStats> CharacterStats => Set<CharacterStats>();
    public DbSet<FloorOwnership> FloorOwnerships => Set<FloorOwnership>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("users");
        user.HasKey(x => x.Id);
        user.HasIndex(x => x.Username).IsUnique();
        user.HasIndex(x => x.Email).IsUnique();
        user.Property(x => x.Username).HasMaxLength(32).IsRequired();
        user.Property(x => x.Email).HasMaxLength(256).IsRequired();
        user.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        user.Property(x => x.CharacterJsonPath).HasMaxLength(512);
        user.Property(x => x.BagJsonPath).HasMaxLength(512);
        user.Property(x => x.FirebaseUid).HasMaxLength(128);
        user.Property(x => x.AuthProvider).HasMaxLength(32);
        user.Property(x => x.SkyCoin).HasDefaultValue(0L);

        var ledger = modelBuilder.Entity<LedgerEntry>();
        ledger.ToTable("ledger");
        ledger.HasKey(x => x.Id);
        ledger.HasIndex(x => x.UserId);
        ledger.Property(x => x.Reason).HasMaxLength(64).IsRequired();
        ledger.Property(x => x.Reference).HasMaxLength(128);

        var market = modelBuilder.Entity<MarketListing>();
        market.ToTable("market_listings");
        market.HasKey(x => x.Id);
        market.HasIndex(x => new { x.ItemId, x.Active });
        market.Property(x => x.ItemId).HasMaxLength(64).IsRequired();
        market.Property(x => x.ItemSnapshotJson);

        var stats = modelBuilder.Entity<CharacterStats>();
        stats.ToTable("character_stats");
        stats.HasKey(x => x.UserId);
        stats.Property(x => x.Username).HasMaxLength(32).IsRequired();
        stats.Property(x => x.CharacterName).HasMaxLength(32).IsRequired();

        var own = modelBuilder.Entity<FloorOwnership>();
        own.ToTable("floor_ownership");
        own.HasKey(x => x.FloorNumber);
        own.Property(x => x.OwnerUsername).HasMaxLength(32).IsRequired();
        own.Property(x => x.SnapshotPath).HasMaxLength(512).IsRequired();
    }
}
