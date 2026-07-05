using Microsoft.EntityFrameworkCore;
using SkySpire.Api.Data;
using SkySpire.Api.DTOs;
using SkySpire.Api.Models;

namespace SkySpire.Api.Services;

public class AuthService(AppDbContext db, TokenService tokenService)
{
    public async Task<(AuthResponse? Result, string? Error)> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedUsername = request.Username.Trim();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
            return (null, "Este e-mail já está em uso.");

        if (await db.Users.AnyAsync(u => u.Username == normalizedUsername, ct))
            return (null, "Este nome de usuário já está em uso.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            Username = normalizedUsername,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var (token, expiresAt) = tokenService.CreateToken(user);
        return (new AuthResponse(token, expiresAt, ToDto(user)), null);
    }

    public async Task<(AuthResponse? Result, string? Error)> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var login = request.Login.Trim();
        var normalizedLogin = login.Contains('@')
            ? login.ToLowerInvariant()
            : login;

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Email == normalizedLogin || u.Username == normalizedLogin,
            ct);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return (null, "E-mail/usuário ou senha inválidos.");

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var (token, expiresAt) = tokenService.CreateToken(user);
        return (new AuthResponse(token, expiresAt, ToDto(user)), null);
    }

    public async Task<UserDto?> GetUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : ToDto(user);
    }

    private static UserDto ToDto(User user) =>
        new(user.Id, user.Email, user.Username, user.CreatedAt);
}
