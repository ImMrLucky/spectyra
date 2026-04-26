using System.Text.Json;
using System.Text.Json.Nodes;

namespace Spectyra;

/// <summary>Runtime vs embedded integration (parity with Python <c>Spectyra</c> / Java <c>Spectyra</c>).</summary>
public enum SpectyraIntegrationMode
{
    Runtime,
    Embedded,
}

public sealed record SpectyraSdkConfiguration(
    SpectyraIntegrationMode Mode,
    string? RuntimeBaseUrl = null,
    string? FfiPath = null)
{
    public static SpectyraSdkConfiguration RuntimeDefaults() => new(
        SpectyraIntegrationMode.Runtime,
        (Environment.GetEnvironmentVariable("SPECTYRA_RUNTIME_URL") ?? "http://127.0.0.1:4269").TrimEnd('/'),
        null);

    public static SpectyraSdkConfiguration EmbeddedDefaults(string? ffiPath = null) => new(
        SpectyraIntegrationMode.Embedded,
        null,
        string.IsNullOrWhiteSpace(ffiPath) ? Environment.GetEnvironmentVariable("SPECTYRA_FFI_PATH") : ffiPath);
}

/// <summary>High-level entry: HTTP to local-runtime or native <c>spectyra_ffi</c> + your provider.</summary>
public sealed class SpectyraSession : IAsyncDisposable
{
    private readonly SpectyraSdkConfiguration _cfg;
    private readonly SpectyraClient? _http;
    private readonly SpectyraFfi? _ffi;

    public SpectyraSession(SpectyraSdkConfiguration? cfg = null)
    {
        _cfg = cfg ?? SpectyraSdkConfiguration.RuntimeDefaults();
        if (_cfg.Mode == SpectyraIntegrationMode.Runtime)
        {
            _http = new SpectyraClient(_cfg.RuntimeBaseUrl);
            _ffi = null;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(_cfg.FfiPath))
            {
                throw new InvalidOperationException("Embedded mode requires FfiPath or SPECTYRA_FFI_PATH");
            }

            _ffi = SpectyraFfi.Load(_cfg.FfiPath);
            _http = null;
        }
    }

    private static readonly JsonSerializerOptions JsonDeserializeMessages = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<JsonNode> RunChatRuntimeAsync(
        string provider,
        string model,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken ct = default)
    {
        if (_http == null)
        {
            throw new InvalidOperationException("RunChatRuntimeAsync requires runtime mode");
        }

        var txt = await _http.RunChatRuntimeAsync(provider, model, messages, ct).ConfigureAwait(false);
        return JsonNode.Parse(txt)!;
    }

    /// <summary>
    /// <paramref name="runtime"/>: same as <see cref="RunChatRuntimeAsync"/>. Embedded: runs pipeline then
    /// <paramref name="callProvider"/> with optimized messages.
    /// </summary>
    public async Task<JsonNode> RunChatAsync(
        string provider,
        string model,
        IReadOnlyList<ChatMessage> messages,
        JsonObject entitlement,
        bool sessionFrozen,
        Func<IReadOnlyList<ChatMessage>, Task<string>> callProvider,
        CancellationToken ct = default)
    {
        if (_cfg.Mode == SpectyraIntegrationMode.Runtime)
        {
            return await RunChatRuntimeAsync(provider, model, messages, ct).ConfigureAwait(false);
        }

        if (_ffi == null)
        {
            throw new InvalidOperationException("Native FFI not loaded");
        }

        var inner = new JsonObject
        {
            ["provider"] = provider,
            ["model"] = model,
            ["messages"] = JsonSerializer.SerializeToNode(messages)!,
        };
        var body = new JsonObject
        {
            ["request"] = inner,
            ["entitlement"] = entitlement,
            ["sessionFrozen"] = sessionFrozen,
        };
        var raw = _ffi.RunChatPipelineJson(body.ToJsonString());
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        if (!root.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
        {
            var err = root.TryGetProperty("error", out var e) ? e.GetString() : "pipeline error";
            throw new InvalidOperationException(err);
        }

        var msgs = root.GetProperty("output").GetProperty("request").GetProperty("messages");
        var optimized = JsonSerializer.Deserialize<List<ChatMessage>>(msgs.GetRawText(), JsonDeserializeMessages)
                        ?? new List<ChatMessage>();
        var providerOut = await callProvider(optimized).ConfigureAwait(false);
        return JsonNode.Parse(providerOut)!;
    }

    public ValueTask DisposeAsync()
    {
        _ffi?.Dispose();
        _http?.Dispose();
        return ValueTask.CompletedTask;
    }
}
