namespace BpmnAnalyzer.Core.Domain;

public record ValidationError(
    string ElementId,
    string RuleCode,
    string Message
);