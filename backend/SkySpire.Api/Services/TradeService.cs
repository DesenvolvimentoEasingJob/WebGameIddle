using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.DTOs;
using SkySpire.Api.Models;
using SkySpire.Api.Models.GameData;

namespace SkySpire.Api.Services;

public class TradeService(
    AppDbContext db,
    CharacterStorage storage,
    ItemIntegrityService integrityService)
{
    public async Task<(GamePatchResponse? SourcePatch, GamePatchResponse? TargetPatch, string? Error)> TransferItemAsync(
        Guid userId,
        int sourceSlotIndex,
        int targetSlotIndex,
        string instanceId,
        Func<JsonObject, GamePatchResponse> buildPatch,
        CancellationToken ct)
    {
        if (sourceSlotIndex == targetSlotIndex)
            return (null, null, "Selecione um slot de destino diferente.");

        var (sourceChar, sourceDoc, sourceError) = await LoadCharacterAsync(userId, sourceSlotIndex, ct);
        if (sourceError is not null)
            return (null, null, sourceError);

        var (targetChar, targetDoc, targetError) = await LoadCharacterAsync(userId, targetSlotIndex, ct);
        if (targetError is not null)
            return (null, null, targetError);

        var sourceItems = sourceDoc!["inventory"]?["items"]?.AsArray()
            ?? throw new InvalidOperationException("Inventário inválido.");

        var entry = sourceItems
            .OfType<JsonObject>()
            .FirstOrDefault(i => i["instanceId"]?.GetValue<string>() == instanceId);

        if (entry is null)
            return (null, null, "Item não encontrado no inventário de origem.");

        if (entry["integrity"] is not null && !integrityService.TryVerify(entry))
            return (null, null, "Integridade do item inválida. Trade bloqueado.");

        var targetInventory = targetDoc!["inventory"]?.AsObject()
            ?? throw new InvalidOperationException("Inventário de destino inválido.");
        var targetItems = targetInventory["items"]?.AsArray() ?? new JsonArray();
        var capacity = targetInventory["capacity"]?.GetValue<int>() ?? 40;

        if (targetItems.Count >= capacity)
            return (null, null, "Inventário do destino está cheio.");

        targetItems.Add(entry.DeepClone());
        sourceItems.Remove(entry);

        var now = DateTime.UtcNow.ToString("O");
        sourceDoc["updatedAt"] = now;
        targetDoc["updatedAt"] = now;

        await storage.SaveAsync(userId, sourceChar!.Id, sourceDoc, ct);
        await storage.SaveAsync(userId, targetChar!.Id, targetDoc, ct);

        return (buildPatch(sourceDoc), buildPatch(targetDoc), null);
    }

    private async Task<(Character? Character, JsonObject? Document, string? Error)> LoadCharacterAsync(
        Guid userId,
        int slotIndex,
        CancellationToken ct)
    {
        if (slotIndex < 0 || slotIndex >= CharacterService.MaxSlots)
            return (null, null, "Slot inválido.");

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.UserId == userId && c.SlotIndex == slotIndex, ct);

        if (character is null)
            return (null, null, "Slot de destino vazio.");

        if (character.Status != CharacterStatus.Complete)
            return (null, null, "Personagem de destino incompleto.");

        var document = await storage.LoadForCharacterAsync(
            userId, character.Id, character.JsonPath, ct);

        if (document is null)
            return (null, null, "Dados do personagem não encontrados.");

        return (character, document, null);
    }
}
