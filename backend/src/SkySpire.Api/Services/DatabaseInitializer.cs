using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;

namespace SkySpire.Api.Services;

public static class DatabaseInitializer
{
    public static async Task EnsureSchemaAsync(AppDbContext db, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS "SkyCoin" bigint NOT NULL DEFAULT 0;
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS ledger (
                "Id" uuid PRIMARY KEY,
                "UserId" uuid NOT NULL,
                "Amount" bigint NOT NULL,
                "BalanceAfter" bigint NOT NULL,
                "Reason" varchar(64) NOT NULL,
                "Reference" varchar(128) NULL,
                "CreatedAt" timestamptz NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_ledger_UserId ON ledger ("UserId");
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS market_listings (
                "Id" uuid PRIMARY KEY,
                "SellerId" uuid NOT NULL,
                "ItemId" varchar(64) NOT NULL,
                "Quantity" int NOT NULL,
                "PriceEach" bigint NOT NULL,
                "CreatedAt" timestamptz NOT NULL,
                "Active" boolean NOT NULL DEFAULT TRUE
            );
            CREATE INDEX IF NOT EXISTS IX_market_item_active ON market_listings ("ItemId", "Active");
            ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS "ItemSnapshotJson" text NULL;
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS character_stats (
                "UserId" uuid PRIMARY KEY,
                "Username" varchar(32) NOT NULL,
                "CharacterName" varchar(32) NOT NULL,
                "Level" int NOT NULL DEFAULT 1,
                "LastFloor" int NOT NULL DEFAULT 0,
                "LastRoom" int NOT NULL DEFAULT 0,
                "Kills" int NOT NULL DEFAULT 0,
                "FloorsOwned" int NOT NULL DEFAULT 0,
                "SkyCoin" bigint NOT NULL DEFAULT 0,
                "UpdatedAt" timestamptz NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS floor_ownership (
                "FloorNumber" int PRIMARY KEY,
                "OwnerUserId" uuid NOT NULL,
                "OwnerUsername" varchar(32) NOT NULL,
                "SnapshotPath" varchar(512) NOT NULL,
                "ClaimedAt" timestamptz NOT NULL
            );
            """, ct);
    }
}
