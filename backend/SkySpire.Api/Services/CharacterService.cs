using System.Security.Claims;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.DTOs;
using SkySpire.Api.Models;

namespace SkySpire.Api.Services;

public class CharacterService(
    AppDbContext db,
    GameDataLoader gameData,
    CharacterBuilder builder,
    CharacterStorage storage,
    CharacterSigner signer)
{
    public const int MaxSlots = 3;

    public IReadOnlyList<RaceSummaryDto> ListRaces() =>
        gameData.Races.Values
            .Select(r => new RaceSummaryDto(r.Id, r.Name, r.Description, r.Assets, r.Categories))
            .OrderBy(r => r.Name)
            .ToList();

    public IReadOnlyList<ClassSummaryDto> ListClasses() =>
        gameData.Classes.Values
            .Select(c => new ClassSummaryDto(c.Id, c.Name, c.Description, c.Assets, c.Categories))
            .OrderBy(c => c.Name)
            .ToList();

    public async Task<IReadOnlyList<CharacterSlotDto>> GetSlotsAsync(Guid userId, CancellationToken ct)
    {
        var characters = await db.Characters
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.SlotIndex)
            .ToListAsync(ct);

        var slots = new List<CharacterSlotDto>(MaxSlots);

        for (var i = 0; i < MaxSlots; i++)
        {
            var character = characters.FirstOrDefault(c => c.SlotIndex == i);
            if (character is null)
            {
                slots.Add(new CharacterSlotDto(i, false, null, null, null, null, null, null, null));
                continue;
            }

            slots.Add(await BuildSlotDtoAsync(character, ct));
        }

        return slots;
    }

    public async Task<(CharacterActionResponse? Result, string? Error)> SelectRaceAsync(
        Guid userId,
        int slotIndex,
        string raceId,
        CancellationToken ct)
    {
        if (slotIndex < 0 || slotIndex >= MaxSlots)
            return (null, "Slot inválido.");

        var race = gameData.GetRace(raceId);
        if (race is null)
            return (null, "Raça não encontrada.");

        var existing = await db.Characters
            .FirstOrDefaultAsync(c => c.UserId == userId && c.SlotIndex == slotIndex, ct);

        if (existing?.Status == CharacterStatus.Complete)
            return (null, "Este slot já possui um personagem completo.");

        JsonObject document;
        Character character;

        if (existing is null)
        {
            character = new Character
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                SlotIndex = slotIndex,
                RaceId = race.Id,
                ClassId = null,
                JsonPath = storage.GetFilePath(userId, Guid.Empty),
                Status = CharacterStatus.Draft,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            character.JsonPath = storage.GetFilePath(userId, character.Id);
            document = builder.BuildFromRace(character.Id, race);
            db.Characters.Add(character);
        }
        else
        {
            character = existing;
            var loaded = await storage.LoadForCharacterAsync(
                userId, character.Id, character.JsonPath, ct);
            document = loaded is not null
                ? builder.ReplaceRace(loaded, race)
                : builder.BuildFromRace(character.Id, race);

            character.RaceId = race.Id;
            character.ClassId = null;
            character.Status = CharacterStatus.Draft;
            character.UpdatedAt = DateTime.UtcNow;
        }

        await storage.SaveAsync(userId, character.Id, document, ct);
        await db.SaveChangesAsync(ct);

        var slot = await BuildSlotDtoAsync(character, document, ct);
        return (new CharacterActionResponse(slot, document), null);
    }

    public async Task<(CharacterActionResponse? Result, string? Error)> SelectClassAsync(
        Guid userId,
        int slotIndex,
        string classId,
        CancellationToken ct)
    {
        if (slotIndex < 0 || slotIndex >= MaxSlots)
            return (null, "Slot inválido.");

        var classDef = gameData.GetClass(classId);
        if (classDef is null)
            return (null, "Classe não encontrada.");

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.UserId == userId && c.SlotIndex == slotIndex, ct);

        if (character is null || string.IsNullOrEmpty(character.RaceId))
            return (null, "Escolha uma raça antes da classe.");

        if (character.Status == CharacterStatus.Complete)
            return (null, "Este personagem já está completo.");

        var document = await storage.LoadForCharacterAsync(
            userId, character.Id, character.JsonPath, ct);

        if (document is null &&
            !string.IsNullOrEmpty(character.RaceId) &&
            !string.IsNullOrEmpty(character.ClassId))
        {
            document = builder.RebuildComplete(
                character.Id, character.RaceId, character.ClassId);

            if (document is not null)
            {
                character.JsonPath = storage.GetFilePath(userId, character.Id);
                character.UpdatedAt = DateTime.UtcNow;
                await storage.SaveAsync(userId, character.Id, document, ct);
                await db.SaveChangesAsync(ct);
            }
        }

        if (document is null)
            return (null, "Dados do personagem não encontrados.");

        document = builder.ApplyClass(document, classDef);

        character.ClassId = classDef.Id;
        character.Status = CharacterStatus.Complete;
        character.UpdatedAt = DateTime.UtcNow;

        await storage.SaveAsync(userId, character.Id, document, ct);
        await db.SaveChangesAsync(ct);

        var slot = await BuildSlotDtoAsync(character, document, ct);
        return (new CharacterActionResponse(slot, document), null);
    }

    public async Task<string?> DeleteCharacterAsync(Guid userId, int slotIndex, CancellationToken ct)
    {
        if (slotIndex < 0 || slotIndex >= MaxSlots)
            return "Slot inválido.";

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.UserId == userId && c.SlotIndex == slotIndex, ct);

        if (character is null)
            return "Este slot já está vazio.";

        var jsonPath = character.JsonPath;
        db.Characters.Remove(character);
        await db.SaveChangesAsync(ct);
        await storage.DeleteAsync(jsonPath);

        return null;
    }

    private async Task<CharacterSlotDto> BuildSlotDtoAsync(Character character, CancellationToken ct)
    {
        var document = await LoadOrRecoverDocumentAsync(character, ct);
        return await BuildSlotDtoAsync(character, document, ct);
    }

    private async Task<JsonObject?> LoadOrRecoverDocumentAsync(Character character, CancellationToken ct)
    {
        var document = await storage.LoadForCharacterAsync(
            character.UserId, character.Id, character.JsonPath, ct);

        if (document is not null)
            return document;

        if (character.Status != CharacterStatus.Complete ||
            string.IsNullOrEmpty(character.RaceId) ||
            string.IsNullOrEmpty(character.ClassId))
        {
            return null;
        }

        document = builder.RebuildComplete(
            character.Id, character.RaceId, character.ClassId);

        if (document is null)
            return null;

        character.JsonPath = storage.GetFilePath(character.UserId, character.Id);
        character.UpdatedAt = DateTime.UtcNow;
        await storage.SaveAsync(character.UserId, character.Id, document, ct);
        await db.SaveChangesAsync(ct);

        return document;
    }

    private Task<CharacterSlotDto> BuildSlotDtoAsync(
        Character character,
        JsonObject? document,
        CancellationToken ct)
    {
        if (document is null)
        {
            return Task.FromResult(new CharacterSlotDto(
                character.SlotIndex,
                true,
                character.Id,
                character.RaceId,
                character.ClassId,
                character.Status.ToString().ToLowerInvariant(),
                null,
                null,
                null));
        }

        var hash = storage.ComputeHash(document);
        var (token, expiresAt) = signer.Sign(
            character.Id,
            character.UserId,
            character.RaceId,
            character.ClassId,
            character.Status.ToString().ToLowerInvariant(),
            hash);

        return Task.FromResult(new CharacterSlotDto(
            character.SlotIndex,
            true,
            character.Id,
            character.RaceId,
            character.ClassId,
            character.Status.ToString().ToLowerInvariant(),
            token,
            expiresAt,
            document));
    }
}
