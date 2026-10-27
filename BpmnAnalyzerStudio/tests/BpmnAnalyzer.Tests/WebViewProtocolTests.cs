using BpmnAnalyzer.Application.Contracts;

namespace BpmnAnalyzer.Tests;

public class WebViewProtocolTests
{
    [Fact]
    public void Request_And_Response_Can_RoundTrip_As_Json()
    {
        var request = new WebViewBackendRequest("req-1", "validate", "<bpmn />");
        var serializedRequest = WebViewBackendProtocol.SerializeRequest(request);
        var roundTripRequest = WebViewBackendProtocol.DeserializeRequest(serializedRequest);

        Assert.Equal(request.Id, roundTripRequest.Id);
        Assert.Equal(request.Action, roundTripRequest.Action);
        Assert.Equal(request.Xml, roundTripRequest.Xml);

        var response = new WebViewBackendResponse("req-1", true, new { ok = true }, null);
        var serializedResponse = WebViewBackendProtocol.SerializeResponse(response);

        Assert.Contains("\"id\":\"req-1\"", serializedResponse);
        Assert.Contains("\"ok\":true", serializedResponse);
    }
}
