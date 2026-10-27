// src/BpmnAnalyzer.Core/Domain/ProcessModel.cs
using System.Collections.Generic;

namespace BpmnAnalyzer.Core.Domain;

public class ProcessModel
{
    public List<Participant> Participants { get; set; } = new();
    public List<TaskNode> Tasks { get; set; } = new();
    public List<GatewayNode> Gateways { get; set; } = new();
    public List<EventNode> StartEvents { get; set; } = new();
    public List<EventNode> EndEvents { get; set; } = new();
    public List<SequenceFlow> Flows { get; set; } = new();
}

public record Participant(
    string Id, 
    string Name, 
    string ProcessRef
);

public record EventNode(
    string Id, 
    string Name, 
    List<string> IncomingFlows, 
    List<string> OutgoingFlows
);

public record SequenceFlow(
    string Id, 
    string SourceRef, 
    string TargetRef, 
    bool HasCondition, 
    bool IsDefault
);