using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Adapters;

public interface INoteDocxGeneratorAdapter
{
    void Generate(string filePath, NoteModel note);
}
