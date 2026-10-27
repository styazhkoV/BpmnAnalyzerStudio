using System.Text.Json;
using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Application.Ports;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Services;

public sealed class NotebookApplicationService(
    INoteStorage noteStorage,
    INoteDocxGeneratorAdapter noteDocxGenerator)
{
    public IReadOnlyList<NoteModel> LoadNotes() => noteStorage.LoadNotes();

    public string SaveNotes(IEnumerable<NoteModel> notes)
    {
        ArgumentNullException.ThrowIfNull(notes);
        noteStorage.SaveNotes(notes);
        return "ok";
    }

    public string ExportToMarkdown(NoteModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        return noteStorage.ExportMarkdown(note);
    }

    public string ExportToWord(NoteModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        var filePath = noteStorage.ExportMarkdown(note).Replace(".md", ".docx");
        noteDocxGenerator.Generate(filePath, note);
        return filePath;
    }
}
