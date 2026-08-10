namespace SkySpire.Api.Services;

public sealed record PixelLabCandidate(int Index, string PreviewPath);

/// <summary>Generation result before user picks a variant (static icon/sprite).</summary>
public sealed record PixelLabCandidatesResult(
    string DraftId,
    IReadOnlyList<PixelLabCandidate> Candidates,
    string Source,
    string? Reason,
    string Quality,
    string? Model,
    int Size);

/// <summary>Idle animation draft — approve or discard the whole frame group.</summary>
public sealed record PixelLabIdleDraftResult(
    string DraftId,
    IReadOnlyList<string> Frames,
    int FrameWidth,
    int FrameHeight,
    int FrameCount,
    double Fps,
    string Direction,
    string Source,
    string? Reason,
    string Quality,
    string? Model,
    int Size);
