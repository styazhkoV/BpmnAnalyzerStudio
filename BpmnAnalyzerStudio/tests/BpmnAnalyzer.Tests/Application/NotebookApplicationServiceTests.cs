using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Application.Ports;
using BpmnAnalyzer.Application.Services;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Tests.Application;

public class NotebookApplicationServiceTests
{
    [Fact]
    public void SaveNotes_And_ExportMarkdown_And_ExportToWord_WriteArtifacts()
    {
        var storage = new FakeNoteStorage();
        var generator = new FakeNoteDocxGenerator();
        var service = new NotebookApplicationService(storage, generator);
        var note = new NoteModel
        {
            Title = "Результаты интервью",
            Content = "# Детали\n\n- цель",
            UpdatedAt = new DateTime(2025, 01, 15, 9, 30, 0)
        };

        service.SaveNotes(new[] { note });
        var markdownPath = service.ExportToMarkdown(note);
        var wordPath = service.ExportToWord(note);

        Assert.Contains("Результаты интервью", storage.LastSavedContent);
        Assert.Contains("# Результаты интервью", File.ReadAllText(markdownPath));
        Assert.Equal(wordPath, generator.LastFilePath);
        Assert.Equal(note, generator.LastNote);
    }

    private sealed class FakeNoteStorage : INoteStorage
    {
        public string LastSavedContent { get; private set; } = string.Empty;

        public IReadOnlyList<NoteModel> LoadNotes() => [];

        public void SaveNotes(IEnumerable<NoteModel> notes)
        {
            LastSavedContent = System.Text.Json.JsonSerializer.Serialize(
                notes,
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                });
        }

        public string ExportMarkdown(NoteModel note)
        {
            var path = Path.Combine(Path.GetTempPath(), $"{note.Title}.md");
            File.WriteAllText(path, $"# {note.Title}\n\n{note.Content}");
            return path;
        }
    }

    private sealed class FakeNoteDocxGenerator : INoteDocxGeneratorAdapter
    {
        public string? LastFilePath { get; private set; }
        public NoteModel? LastNote { get; private set; }

        public void Generate(string filePath, NoteModel note)
        {
            LastFilePath = filePath;
            LastNote = note;
            File.WriteAllText(filePath, "mock-note-docx");
        }
    }
}
