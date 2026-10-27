using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Ports;

public interface IProcessParser
{
    ProcessModel Parse(string xml);
}
