namespace BpmnAnalyzer.Application.Models;

public sealed record BpmnValidationIssue(string ElementId, string Code, string Message);

public sealed record BpmnElementCounts(
    int Starts,
    int Ends,
    int Tasks,
    int Gateways,
    int Flows);

public sealed record BpmnValidationResult(
    IReadOnlyList<BpmnValidationIssue> Errors,
    BpmnElementCounts Counts);
