using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.DTOs;
using SkySpire.Api.Services;

namespace SkySpire.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
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

        var (result, error) = await authService.RegisterAsync(request, ct);
        if (error is not null)
            return Conflict(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
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

        var (result, error) = await authService.LoginAsync(request, ct);
        if (error is not null)
            return Unauthorized(new ErrorResponse(error));

        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (sub is null || !Guid.TryParse(sub, out var userId))
            return Unauthorized(new ErrorResponse("Token inválido."));

        var user = await authService.GetUserAsync(userId, ct);
        if (user is null)
            return NotFound(new ErrorResponse("Usuário não encontrado."));

        return Ok(user);
    }
}
