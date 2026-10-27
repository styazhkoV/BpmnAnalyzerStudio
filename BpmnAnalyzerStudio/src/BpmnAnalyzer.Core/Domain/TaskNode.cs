namespace BpmnAnalyzer.Core.Domain;

public class TaskNode
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string TaskType { get; set; } = "task"; // task, userTask, serviceTask
    public string? Documentation { get; set; }
    public List<string> IncomingFlows { get; set; } = new();
    public List<string> OutgoingFlows { get; set; } = new();
}