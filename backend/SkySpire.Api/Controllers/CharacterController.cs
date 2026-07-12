using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.DTOs;
using SkySpire.Api.Services;
using System.Security.Claims;

namespace SkySpire.Api.Controllers;

[ApiController]
[Route("api/game")]
public class GameController(GameDataLoader gameData) : ControllerBase
{
    [HttpGet("races")]
    [AllowAnonymous]
    public IActionResult ListRaces()
    {
        var races = gameData.Races.Values
            .Select(r => new RaceSummaryDto(r.Id, r.Name, r.Description, r.Assets, r.Categories))
            .OrderBy(r => r.Name)
            .ToList();

        return Ok(races);
    }

    [HttpGet("classes")]
    [AllowAnonymous]
    public IActionResult ListClasses()
    {
        var classes = gameData.Classes.Values
            .Select(c => new ClassSummaryDto(c.Id, c.Name, c.Description, c.Assets, c.Categories))
            .OrderBy(c => c.Name)
            .ToList();

        return Ok(classes);
    }

    [HttpGet("loot-config")]
    [AllowAnonymous]
    public IActionResult GetLootConfig()
    {
        return Ok(LootConfigBuilder.Build(gameData));
    }
}

[ApiController]
[Route("api/characters")]
[Authorize]
public class CharacterController(CharacterService characterService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSlots(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var slots = await characterService.GetSlotsAsync(userId.Value, ct);
        return Ok(slots);
    }

    [HttpPost("{slotIndex:int}/race")]
    public async Task<IActionResult> SelectRace(
        int slotIndex,
        [FromBody] SelectRaceRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .ToDictionary(
                    x => x.Key,
                    x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

            return BadRequest(new ErrorResponse("Dados inválidos.", errors));
        }

        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await characterService.SelectRaceAsync(
            userId.Value, slotIndex, request.RaceId, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("{slotIndex:int}/class")]
    public async Task<IActionResult> SelectClass(
        int slotIndex,
        [FromBody] SelectClassRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .ToDictionary(
                    x => x.Key,
                    x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

            return BadRequest(new ErrorResponse("Dados inválidos.", errors));
        }

        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await characterService.SelectClassAsync(
            userId.Value, slotIndex, request.ClassId, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpDelete("{slotIndex:int}")]
    public async Task<IActionResult> DeleteCharacter(int slotIndex, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var error = await characterService.DeleteCharacterAsync(userId.Value, slotIndex, ct);
        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        return sub is not null && Guid.TryParse(sub, out var userId) ? userId : null;
    }
}
