using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SkySpire.Api.Configuration;
using SkySpire.Api.Data;
using SkySpire.Api.Endpoints;
using SkySpire.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var envCandidates = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, ".env"),
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", ".env")),
};

foreach (var envPath in envCandidates)
{
    builder.Configuration.AddDotEnvFile(envPath);
}

builder.Services.AddSkySpireOptions(builder.Configuration);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["DB_CONNECTION"]
    ?? throw new InvalidOperationException("Database connection string is missing.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddHttpClient("pixellab", client =>
{
    // Idle animations (animate-with-text-v2) can take 1–3+ minutes including poll.
    client.Timeout = TimeSpan.FromMinutes(6);
});
builder.Services.AddHttpClient("openai", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddHttpClient("gemini", client =>
{
    client.Timeout = TimeSpan.FromMinutes(3);
});
builder.Services.AddSingleton<JsonSigningService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ContentService>();
builder.Services.AddScoped<CharacterService>();
builder.Services.AddScoped<StatCalculator>();
builder.Services.AddScoped<XpService>();
builder.Services.AddScoped<LevelGrowthService>();
builder.Services.AddScoped<HpService>();
builder.Services.AddScoped<RarityService>();
builder.Services.AddScoped<QualityService>();
builder.Services.AddScoped<ItemRollService>();
builder.Services.AddScoped<UniqueItemDropService>();
builder.Services.AddScoped<CombatService>();
builder.Services.AddScoped<OwnershipService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddScoped<TowerService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<EconomyService>();
builder.Services.AddScoped<MarketService>();
builder.Services.AddScoped<TrainingService>();
builder.Services.AddScoped<PixelLabService>();
builder.Services.AddScoped<GeminiImageService>();
builder.Services.AddScoped<ItemDraftService>();
builder.Services.AddScoped<MonsterDraftService>();
builder.Services.AddScoped<FloorDraftService>();
builder.Services.AddSingleton<GameConfigService>();

var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? throw new InvalidOperationException("JWT_SECRET is not configured.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "skyspire",
            ValidAudience = "skyspire",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            NameClaimType = "unique_name",
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

const string ViteCors = "ViteDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(ViteCors, policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    await DatabaseInitializer.EnsureSchemaAsync(db);

    var characters = scope.ServiceProvider.GetRequiredService<CharacterService>();
    var migrated = await characters.MigrateExistingCharactersHpAsync(CancellationToken.None);
    if (migrated > 0)
    {
        app.Logger.LogInformation("Migrated currentHp/lastHpAt on {Count} character file(s).", migrated);
    }
}

app.UseCors(ViteCors);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
{
    try
    {
        var canConnect = await db.Database.CanConnectAsync(ct);
        if (!canConnect)
        {
            return Results.Json(new { status = "degraded", database = "down" },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Results.Ok(new { status = "ok", database = "up" });
    }
    catch (Exception ex)
    {
        return Results.Json(new
        {
            status = "degraded",
            database = "down",
            error = ex.Message
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapAuthEndpoints();
app.MapContentEndpoints();
app.MapCharacterEndpoints();
app.MapTowerEndpoints();
app.MapInventoryEndpoints();
app.MapEconomyEndpoints();
app.MapMarketEndpoints();
app.MapTrainingEndpoints();
app.MapRankingEndpoints();
app.MapAssetsEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapEditorEndpoints();
    app.MapGet("/api/debug/config", (GameConfigService gameConfig) =>
    {
        var b = gameConfig.GetBalance();
        return Results.Ok(new
        {
            source = "content/config/global.json (+ optional env overrides)",
            generative = new
            {
                monsterImageComplement = gameConfig.GetMonsterImageComplement(),
                floorImageComplement = gameConfig.GetFloorImageComplement()
            },
            balance = new
            {
                b.XpBase,
                b.XpScale,
                b.XpScaleStepEvery,
                b.XpScaleStep,
                b.FloorDifficultyMult,
                b.FloorRewardMult,
                b.BossChallengeAttrMult,
                b.BossChallengeFee,
                b.FloorOwnerFeeShare,
                b.DeathXpPenalty,
                b.TrainingCostBase,
                b.TrainingGoldScale,
                b.BattleCoinRewardBase,
                b.HpRegenGlobalMult,
                b.HpDefeatRevivePct,
                b.CombatBaseActionMs,
                b.CombatMaxDurationMs,
                b.CombatRegenTickMs,
                b.CombatDamageNoise,
                b.CombatArmorMidDef,
                b.CombatArmorPower,
                note = "Edit balance/generative in content/config/global.json via the content editor."
            }
        });
    });
}

app.Run();
