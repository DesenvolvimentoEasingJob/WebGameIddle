using System.Security.Cryptography;
using System.Text;

namespace SkySpire.Api.Services;

public static class LootSeedService
{
    public static string BuildBatchSeed(
        Guid userId,
        Guid characterId,
        int floor,
        int mobsKilledAtStart,
        int batchIndex,
        string serverSecret)
    {
        var payload = $"{userId}:{characterId}:{floor}:{mobsKilledAtStart}:{batchIndex}";
        var key = Encoding.UTF8.GetBytes(serverSecret);
        var bytes = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static Random CreateRng(string seed, int rollIndex)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{seed}:{rollIndex}"));
        return new Random(BitConverter.ToInt32(bytes, 0));
    }
}
