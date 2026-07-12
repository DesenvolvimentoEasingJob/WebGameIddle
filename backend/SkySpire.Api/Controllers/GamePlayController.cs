using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.DTOs;
using SkySpire.Api.Services;
using System.Security.Claims;

namespace SkySpire.Api.Controllers;

[ApiController]
[Route("api/characters/{slotIndex:int}/game")]
[Authorize]
public class GamePlayController(GamePlayService gamePlayService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetGameState(int slotIndex, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.GetGameStateAsync(userId.Value, slotIndex, ct);
        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("equip")]
    public async Task<IActionResult> EquipItem(
        int slotIndex,
        [FromBody] EquipItemRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.EquipItemAsync(
            userId.Value, slotIndex, request.InstanceId, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("unequip")]
    public async Task<IActionResult> UnequipItem(
        int slotIndex,
        [FromBody] UnequipItemRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.UnequipItemAsync(
            userId.Value, slotIndex, request.EquipSlot, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("discard")]
    public async Task<IActionResult> DiscardItem(
        int slotIndex,
        [FromBody] DiscardItemRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.DiscardItemAsync(
            userId.Value, slotIndex, request.InstanceId, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPatch("tower")]
    public async Task<IActionResult> UpdateTowerSettings(
        int slotIndex,
        [FromBody] UpdateTowerSettingsRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.UpdateTowerSettingsAsync(
            userId.Value, slotIndex, request.AutoAscend, request.ContinuousAttack, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("tower/combat")]
    public async Task<IActionResult> StartTowerCombat(int slotIndex, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.StartTowerCombatAsync(
            userId.Value, slotIndex, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("tower/combat-batch")]
    public async Task<IActionResult> StartTowerCombatBatch(
        int slotIndex,
        [FromBody] TowerCombatBatchRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.StartTowerCombatBatchAsync(
            userId.Value, slotIndex, request.KillCount, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("trade")]
    public async Task<IActionResult> TradeItem(
        int slotIndex,
        [FromBody] TradeItemRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.TradeItemAsync(
            userId.Value, slotIndex, request.TargetSlotIndex, request.InstanceId, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("apply-gem")]
    public async Task<IActionResult> ApplyGem(
        int slotIndex,
        [FromBody] ApplyGemRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.ApplyGemAsync(
            userId.Value,
            slotIndex,
            request.ItemInstanceId,
            request.GemInstanceId,
            ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("tower/repeat")]
    public async Task<IActionResult> RepeatTowerFloor(int slotIndex, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.RepeatTowerFloorAsync(
            userId.Value, slotIndex, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("tower/advance")]
    public async Task<IActionResult> AdvanceTowerFloor(int slotIndex, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.AdvanceTowerFloorAsync(
            userId.Value, slotIndex, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("tower/navigate")]
    public async Task<IActionResult> NavigateTowerFloor(
        int slotIndex,
        [FromBody] NavigateTowerFloorRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new ErrorResponse("Token inválido."));

        var (result, error) = await gamePlayService.NavigateTowerFloorAsync(
            userId.Value, slotIndex, request.Direction, ct);

        if (error is not null)
            return BadRequest(new ErrorResponse(error));

        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        return sub is not null && Guid.TryParse(sub, out var userId) ? userId : null;
    }
}
