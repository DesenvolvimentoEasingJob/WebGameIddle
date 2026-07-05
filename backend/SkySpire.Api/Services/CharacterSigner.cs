using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SkySpire.Api.Services;

public class CharacterSigner(IConfiguration configuration)
{
    public (string Token, DateTime ExpiresAt) Sign(
        Guid characterId,
        Guid userId,
        string? raceId,
        string? classId,
        string status,
        string jsonHash)
    {
        var secret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        var issuer = configuration["Jwt:Issuer"] ?? "SkySpire";
        var audience = configuration["Jwt:Audience"] ?? "SkySpire";
        var expirationHours = int.TryParse(configuration["Jwt:CharacterExpirationHours"], out var hours)
            ? hours
            : 168;

        var expiresAt = DateTime.UtcNow.AddHours(expirationHours);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new("typ", "character"),
            new(JwtRegisteredClaimNames.Sub, characterId.ToString()),
            new("uid", userId.ToString()),
            new("status", status),
            new("jsh", jsonHash),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        if (raceId is not null)
            claims.Add(new Claim("race", raceId));

        if (classId is not null)
            claims.Add(new Claim("class", classId));

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
