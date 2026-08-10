using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Services;

/// <summary>
/// SkyCoin authority. Common ledger reasons: battle_reward, boss_gate_fee,
/// floor_registry_fee, ownership_share, market_buy, market_sell, training.
/// </summary>
public sealed class EconomyService(
    AppDbContext db,
    JsonSigningService signing,
    GameConfigService gameConfig)
{
    public static long BattleRewardCoins(GameBalanceOptions opts, int floorNumber)
    {
        var floor = Math.Max(1, floorNumber);
        var raw = opts.BattleCoinRewardBase * Math.Pow(opts.FloorRewardMult, floor - 1);
        return Math.Max(1, (long)Math.Round(raw));
    }

    public async Task<long> GetBalanceAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new EconomyException("User not found.");
        return user.SkyCoin;
    }

    public async Task EnsureCanAffordAsync(Guid userId, long amount, CancellationToken ct)
    {
        if (amount < 0)
        {
            throw new EconomyException("Amount must be non-negative.");
        }

        var bal = await GetBalanceAsync(userId, ct);
        if (bal < amount)
        {
            throw new EconomyException("Insufficient SkyCoin.");
        }
    }

    public async Task<long> CreditAsync(Guid userId, long amount, string reason, string? reference, CancellationToken ct)
    {
        if (amount <= 0)
        {
            throw new EconomyException("Credit amount must be positive.");
        }

        return await MutateAsync(userId, amount, reason, reference, ct);
    }

    public async Task<long> DebitAsync(Guid userId, long amount, string reason, string? reference, CancellationToken ct)
    {
        if (amount <= 0)
        {
            throw new EconomyException("Debit amount must be positive.");
        }

        return await MutateAsync(userId, -amount, reason, reference, ct);
    }

    public long BattleRewardForFloor(int floorNumber) =>
        BattleRewardCoins(gameConfig.GetBalance(), floorNumber);

    public async Task TransferAsync(
        Guid fromUserId,
        Guid toUserId,
        long amount,
        string reason,
        string? reference,
        CancellationToken ct)
    {
        if (amount <= 0)
        {
            throw new EconomyException("Transfer amount must be positive.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await DebitAsync(fromUserId, amount, reason, reference, ct);
        await CreditAsync(toUserId, amount, reason, reference, ct);
        await tx.CommitAsync(ct);
    }

    private async Task<long> MutateAsync(
        Guid userId,
        long delta,
        string reason,
        string? reference,
        CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new EconomyException("User not found.");

        var next = user.SkyCoin + delta;
        if (next < 0)
        {
            throw new EconomyException("Insufficient SkyCoin.");
        }

        user.SkyCoin = next;
        db.Ledger.Add(new LedgerEntry
        {
            UserId = userId,
            Amount = delta,
            BalanceAfter = next,
            Reason = reason,
            Reference = reference
        });

        await db.SaveChangesAsync(ct);
        await SyncCharacterWalletAsync(user, ct);
        return next;
    }

    private async Task SyncCharacterWalletAsync(User user, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(user.CharacterJsonPath) || !File.Exists(user.CharacterJsonPath))
        {
            return;
        }

        var text = await File.ReadAllTextAsync(user.CharacterJsonPath, ct);
        if (JsonNode.Parse(text) is not JsonObject node)
        {
            return;
        }

        node["skyCoin"] = user.SkyCoin;
        signing.SignInPlace(node);
        await File.WriteAllTextAsync(user.CharacterJsonPath, node.ToJsonString(ContentService.SerializerOptions), ct);
    }
}

public sealed class EconomyException(string message) : Exception(message);
