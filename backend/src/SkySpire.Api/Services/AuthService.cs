using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;
using SkySpire.Api.Entities;

namespace SkySpire.Api.Services;

public sealed class AuthService(
    AppDbContext db,
    IOptions<AppSecretsOptions> secrets)
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<(User user, string token)?> RegisterAsync(
        string username,
        string email,
        string password,
        CancellationToken ct)
    {
        username = username.Trim();
        email = email.Trim().ToLowerInvariant();

        if (username.Length is < 3 or > 32)
        {
            throw new AuthException("Username must be 3–32 characters.");
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new AuthException("Invalid email.");
        }

        if (password.Length < 6)
        {
            throw new AuthException("Password must be at least 6 characters.");
        }

        var taken = await db.Users.AnyAsync(
            u => u.Username == username || u.Email == email,
            ct);
        if (taken)
        {
            throw new AuthException("Username or email already in use.");
        }

        var user = new User
        {
            Username = username,
            Email = email,
            AuthProvider = "local"
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, password);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return (user, CreateToken(user));
    }

    public async Task<(User user, string token)?> LoginAsync(
        string usernameOrEmail,
        string password,
        CancellationToken ct)
    {
        var key = usernameOrEmail.Trim();
        var emailKey = key.ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Username == key || u.Email == emailKey,
            ct);

        if (user is null)
        {
            throw new AuthException("Invalid credentials.");
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new AuthException("Invalid credentials.");
        }

        return (user, CreateToken(user));
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);

    private string CreateToken(User user)
    {
        var secret = secrets.Value.JwtSecret
            ?? throw new InvalidOperationException("JWT_SECRET is not configured.");

        if (secret.Length < 32)
        {
            throw new InvalidOperationException("JWT_SECRET must be at least 32 characters.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("has_character", string.IsNullOrEmpty(user.CharacterJsonPath) ? "0" : "1")
        };

        var token = new JwtSecurityToken(
            issuer: "skyspire",
            audience: "skyspire",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public sealed class AuthException(string message) : Exception(message);
