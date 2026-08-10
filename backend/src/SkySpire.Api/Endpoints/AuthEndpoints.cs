using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SkySpire.Api.Services;

namespace SkySpire.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", async (
            [FromBody] RegisterRequest body,
            AuthService auth,
            CancellationToken ct) =>
        {
            try
            {
                var result = await auth.RegisterAsync(body.Username, body.Email, body.Password, ct);
                if (result is null)
                {
                    return Results.BadRequest(new { error = "Registration failed." });
                }

                var (user, token) = result.Value;
                return Results.Ok(ToAuthResponse(user, token));
            }
            catch (AuthException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireRateLimiting("auth");

        group.MapPost("/login", async (
            [FromBody] LoginRequest body,
            AuthService auth,
            CancellationToken ct) =>
        {
            try
            {
                var result = await auth.LoginAsync(body.UsernameOrEmail, body.Password, ct);
                if (result is null)
                {
                    return Results.Unauthorized();
                }

                var (user, token) = result.Value;
                return Results.Ok(ToAuthResponse(user, token));
            }
            catch (AuthException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireRateLimiting("auth");

        group.MapGet("/me", async (ClaimsPrincipal principal, AuthService auth, CancellationToken ct) =>
        {
            var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? principal.FindFirstValue("sub");
            if (!Guid.TryParse(idValue, out var id))
            {
                return Results.Unauthorized();
            }

            var user = await auth.GetByIdAsync(id, ct);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok(new MeResponse(
                user.Id,
                user.Username,
                user.Email,
                !string.IsNullOrEmpty(user.CharacterJsonPath)));
        }).RequireAuthorization();

        return group;
    }

    private static AuthResponse ToAuthResponse(Entities.User user, string token) =>
        new(
            token,
            new MeResponse(
                user.Id,
                user.Username,
                user.Email,
                !string.IsNullOrEmpty(user.CharacterJsonPath)));
}

public sealed record RegisterRequest(string Username, string Email, string Password);
public sealed record LoginRequest(string UsernameOrEmail, string Password);
public sealed record MeResponse(Guid Id, string Username, string Email, bool HasCharacter);
public sealed record AuthResponse(string Token, MeResponse User);
