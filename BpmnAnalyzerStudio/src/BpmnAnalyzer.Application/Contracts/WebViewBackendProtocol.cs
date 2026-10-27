using System.Text.Encodings.Web;
using System.Text.Json;

namespace BpmnAnalyzer.Application.Contracts;

public sealed record WebViewBackendRequest(string Id, string Action, string Xml);

public sealed record WebViewBackendResponse(string Id, bool Ok, object? Result, string? Error);

public static class WebViewBackendProtocol
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static string SerializeRequest(WebViewBackendRequest request)
        => JsonSerializer.Serialize(request, JsonOptions);

    public static string SerializeResponse(WebViewBackendResponse response)
        => JsonSerializer.Serialize(response, JsonOptions);

    public static WebViewBackendRequest DeserializeRequest(string json)
        => JsonSerializer.Deserialize<WebViewBackendRequest>(json, JsonOptions)
            ?? throw new InvalidOperationException("Не удалось десериализовать запрос WebView.");
}
