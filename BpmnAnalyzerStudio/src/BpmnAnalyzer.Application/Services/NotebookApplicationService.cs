using System.Text.Json;
using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Application.Services;

public sealed class NotebookApplicationService(
    IFileStorageAdapter fileStorage,
    INoteDocxGeneratorAdapter noteDocxGenerator)
{
    private const string NotesFileName = "analyst_notes.json";

    public IReadOnlyList<NoteModel> LoadNotes()
    {
        var path = GetNotesPath();
        if (!fileStorage.FileExists(path))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<NoteModel>>(fileStorage.ReadAllText(path))
            ?? throw new InvalidDataException("Файл заметок содержит некорректные данные.");
    }

    public string SaveNotes(IEnumerable<NoteModel> notes)
    {
        ArgumentNullException.ThrowIfNull(notes);

        var path = GetNotesPath();
        var json = JsonSerializer.Serialize(notes, new JsonSerializerOptions { WriteIndented = true });
        fileStorage.WriteAllText(path, json);
        return path;
    }

    public string ExportToMarkdown(NoteModel note)
    {
        ArgumentNullException.ThrowIfNull(note);

        var path = GetExportPath(note.Title, ".md");
        var content = $"# {note.Title}\n\n*Обновлено: {note.UpdatedAt:dd.MM.yyyy HH:mm}*\n\n---\n\n{note.Content}";
        fileStorage.WriteAllText(path, content);
        return path;
    }

    public string ExportToWord(NoteModel note)
    {
        ArgumentNullException.ThrowIfNull(note);

        var path = GetExportPath(note.Title, ".docx");
        noteDocxGenerator.Generate(path, note);
        return path;
    }

    private string GetNotesPath() => Path.Combine(fileStorage.DesktopDirectory, NotesFileName);

    private string GetExportPath(string title, string extension)
    {
        var safeTitle = string.Join("_", title.Split(Path.GetInvalidFileNameChars()));
        return Path.Combine(fileStorage.DesktopDirectory, $"{safeTitle}{extension}");
    }
}
