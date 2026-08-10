namespace SkySpire.Api.Configuration;

public static class ConfigurationExtensions
{
    /// <summary>
    /// Carrega arquivo .env (KEY=VALUE) para a configuração, sem sobrescrever
    /// variáveis já definidas no ambiente.
    /// </summary>
    public static void AddDotEnvFile(this IConfigurationBuilder builder, string path)
    {
        if (!File.Exists(path))
        {
            return;
        }

        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var sep = line.IndexOf('=');
            if (sep <= 0)
            {
                continue;
            }

            var key = line[..sep].Trim();
            var value = line[(sep + 1)..].Trim();
            if (value.Length >= 2 &&
                ((value.StartsWith('"') && value.EndsWith('"')) ||
                 (value.StartsWith('\'') && value.EndsWith('\''))))
            {
                value = value[1..^1];
            }

            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                continue;
            }

            data[key] = value;
        }

        if (data.Count > 0)
        {
            builder.AddInMemoryCollection(data);
        }
    }

    public static IServiceCollection AddSkySpireOptions(this IServiceCollection services, IConfiguration config)
    {
        // Playable balance lives in content/config/global.json (GameConfigService).
        services.Configure<AppSecretsOptions>(opts => BindSecrets(opts, config));
        return services;
    }

    private static void BindSecrets(AppSecretsOptions opts, IConfiguration c)
    {
        opts.JwtSecret = c["JWT_SECRET"];
        opts.HmacSecret = c["HMAC_SECRET"] ?? c["JSON_SIGNING_KEY"];
        opts.PixellabApiKey = c["PIXELLAB_API_KEY"] ?? c["PIXEL_API_KEY"];
        opts.OpenAiApiKey = c["OPENAI_API_KEY"];
        opts.GoogleGeminiApiKey = c["GOOGLE_GEMINI_API_KEY"];
        opts.GoogleGeminiModel = c["GOOGLE_GEMINI_MODEL"];
        opts.GoogleProjectId = c["GOOGLE_PROJECT_ID"];
        opts.ContentPath = c["ContentPath"] ?? opts.ContentPath;
        opts.DataPath = c["DataPath"] ?? opts.DataPath;
    }
}
