namespace SkySpire.Api.Services;

/// <param name="Reason">Código curto (ex.: http_429, no_api_key).</param>
/// <param name="Detail">Mensagem legível da API/exception para o editor diagnosticar.</param>
public sealed record FloorBackgroundResult(
    string BackgroundPath,
    string Source,
    string? Reason,
    string? Detail = null);
