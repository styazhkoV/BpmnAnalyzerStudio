using System.Text.Encodings.Web;
using System.Text.Json;
using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Application.Ports;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Infrastructure.Adapters;

public sealed class JsonNoteStorageAdapter(IFileStorageAdapter fileStorage) : INoteStorage
{
    private const string NotesFileName = "analyst_notes.json";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public IReadOnlyList<NoteModel> LoadNotes()
    {
        var path = GetNotesPath();
        if (!fileStorage.FileExists(path))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<NoteModel>>(fileStorage.ReadAllText(path), JsonOptions)
            ?? throw new InvalidDataException("Файл заметок содержит некорректные данные.");
    }

    public void SaveNotes(IEnumerable<NoteModel> notes)
    {
        ArgumentNullException.ThrowIfNull(notes);
        var json = JsonSerializer.Serialize(notes, JsonOptions);
        fileStorage.WriteAllText(GetNotesPath(), json);
    }

    public string ExportMarkdown(NoteModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        var path = Path.Combine(fileStorage.DesktopDirectory, $"{Sanitize(note.Title)}.md");
        var content = $"# {note.Title}\n\n*Обновлено: {note.UpdatedAt:dd.MM.yyyy HH:mm}*\n\n---\n\n{note.Content}";
        fileStorage.WriteAllText(path, content);
        return path;
    }

    private string GetNotesPath() => Path.Combine(fileStorage.DesktopDirectory, NotesFileName);

    private static string Sanitize(string title) => string.Join("_", title.Split(Path.GetInvalidFileNameChars()));
}
