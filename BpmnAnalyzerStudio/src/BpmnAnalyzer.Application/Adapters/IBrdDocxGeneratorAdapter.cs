using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Adapters;

public interface IBrdDocxGeneratorAdapter
{
    void Generate(string filePath, ProcessModel model);
}
