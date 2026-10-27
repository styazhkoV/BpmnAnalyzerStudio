namespace BpmnAnalyzer.Core.Domain;

public class GatewayNode
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string GatewayType { get; set; } = "exclusiveGateway";
    public List<string> IncomingFlows { get; set; } = new();
    public List<string> OutgoingFlows { get; set; } = new();
}