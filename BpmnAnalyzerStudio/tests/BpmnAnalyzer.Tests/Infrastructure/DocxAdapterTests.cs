using System.IO;
using System.IO.Packaging;
using BpmnAnalyzer.Core.Domain;
using BpmnAnalyzer.Infrastructure.Adapters;
using DocumentFormat.OpenXml.Packaging;

namespace BpmnAnalyzer.Tests.Infrastructure;

public class DocxAdapterTests
{
    [Fact]
    public void BrdDocxGeneratorAdapter_CreatesWordDocument()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.docx");
        var model = new ProcessModel
        {
            Participants = [new Participant("pool", "Pool", "proc")],
            Tasks = [new TaskNode { Id = "task1", Name = "Task 1", TaskType = "task" }],
            Gateways = [],
            StartEvents = [new EventNode("start", "Start", [], ["flow1"])],
            EndEvents = [new EventNode("end", "End", ["flow1"], [])],
            Flows = [new SequenceFlow("flow1", "start", "end", false, false)]
        };

        var adapter = new BrdDocxGeneratorAdapter();
        adapter.Generate(path, model);

        Assert.True(File.Exists(path));
        using var doc = WordprocessingDocument.Open(path, false);
        var body = doc.MainDocumentPart!.Document.Body!;
        Assert.Contains("Agile Business Requirements Document", body.InnerText);
    }

    [Fact]
    public void NoteDocxGeneratorAdapter_CreatesWordDocument()
    {
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.docx");
        var note = new NoteModel
        {
            Title = "Требования",
            Content = "Содержание",
            UpdatedAt = new DateTime(2025, 1, 12, 12, 30, 0)
        };

        var adapter = new NoteDocxGeneratorAdapter();
        adapter.Generate(path, note);

        Assert.True(File.Exists(path));
        using var doc = WordprocessingDocument.Open(path, false);
        var body = doc.MainDocumentPart!.Document.Body!;
        Assert.Contains("Требования", body.InnerText);
    }
}
