using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SkySpire.Api.Data;
using SkySpire.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<GameDataLoader>();
builder.Services.AddSingleton<GameDataWriter>();
builder.Services.AddSingleton<GameDataItemEnsurer>();
builder.Services.AddSingleton<GameDataItemRenamer>();
builder.Services.AddSingleton<CharacterSigner>();
builder.Services.AddSingleton<CharacterStorage>();
builder.Services.AddSingleton<GameStateInitializer>();
builder.Services.AddSingleton<CharacterBuilder>();
builder.Services.AddScoped<CharacterService>();
builder.Services.AddHttpClient("OpenAI", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddSingleton<ItemNamingService>();
builder.Services.Configure<LootOptions>(
    builder.Configuration.GetSection(LootOptions.SectionName));
builder.Services.AddSingleton<ItemIntegrityService>();
builder.Services.AddSingleton<ItemAffixRoller>();
builder.Services.AddSingleton<ItemInstanceBuilder>();
builder.Services.AddScoped<TradeService>();
builder.Services.AddSingleton<ProceduralItemGenerator>();
builder.Services.AddSingleton<ItemDropService>();
builder.Services.AddScoped<GamePlayService>();

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SkySpire";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "SkySpire";

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
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontDev", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

{
    var itemEnsurer = app.Services.GetRequiredService<GameDataItemEnsurer>();
    var gameDataWriter = app.Services.GetRequiredService<GameDataWriter>();
    var itemRenamer = app.Services.GetRequiredService<GameDataItemRenamer>();
    gameDataWriter.OrganizeItemStorage();
    itemRenamer.RenameLegacyItems();
    itemEnsurer.MigrateCharacterGeneratedItems();
    itemEnsurer.EnsureReferencedItems();
}

app.UseCors("FrontDev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
