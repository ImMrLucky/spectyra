using System.Net.Http.Json;
using System.Text.Json;

namespace Spectyra;

/// <summary>Minimal client: HTTP to local runtime. Native FFI is a follow-up.</summary>
public sealed class SpectyraClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _base;

    public SpectyraClient(string? runtimeBaseUrl = null)
    {
        _base = (runtimeBaseUrl ?? Environment.GetEnvironmentVariable("SPECTYRA_RUNTIME_URL") ?? "http://127.0.0.1:4269").TrimEnd('/');
        _http = new HttpClient { BaseAddress = new Uri(_base + "/") };
    }

    public async Task<string> RunChatRuntimeAsync(string provider, string model, IReadOnlyList<ChatMessage> messages, CancellationToken ct = default)
    {
        var body = new { provider, model, messages };
        var res = await _http.PostAsJsonAsync("v1/chat/run", body, cancellationToken: ct).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
    }

    public void Dispose() => _http.Dispose();
}

public readonly record struct ChatMessage(string role, string content);
