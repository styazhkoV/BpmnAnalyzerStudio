using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Ports;

public interface INoteStorage
{
    IReadOnlyList<NoteModel> LoadNotes();
    void SaveNotes(IEnumerable<NoteModel> notes);
    string ExportMarkdown(NoteModel note);
}
