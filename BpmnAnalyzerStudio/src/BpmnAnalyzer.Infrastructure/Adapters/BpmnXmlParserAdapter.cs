using BpmnAnalyzer.Application.Ports;
using BpmnAnalyzer.Core.Domain;
using BpmnAnalyzer.Core.Parser;

namespace BpmnAnalyzer.Infrastructure.Adapters;

public sealed class BpmnXmlParserAdapter : IProcessParser
{
    public ProcessModel Parse(string xml) => new BpmnXmlParser().Parse(xml);
}
