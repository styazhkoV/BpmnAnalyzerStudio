using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Core.Domain;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace BpmnAnalyzer.Infrastructure.Adapters;

public sealed class NoteDocxGeneratorAdapter : INoteDocxGeneratorAdapter
{
    public void Generate(string filePath, NoteModel note)
    {
        using var wordDocument = WordprocessingDocument.Create(filePath, WordprocessingDocumentType.Document);
        var mainPart = wordDocument.AddMainDocumentPart();
        mainPart.Document = new Document(new Body());
        var body = mainPart.Document.Body
            ?? throw new InvalidOperationException("Не удалось создать содержимое документа Word.");

        body.AppendChild(new Paragraph(new Run(new Text(note.Title))
        {
            RunProperties = new RunProperties(new Bold(), new FontSize { Val = "28" })
        }));

        body.AppendChild(new Paragraph(new Run(new Text($"Дата обновления: {note.UpdatedAt:dd.MM.yyyy HH:mm}"))
        {
            RunProperties = new RunProperties(new Italic(), new Color { Val = "666666" })
        }));

        body.AppendChild(new Paragraph());

        foreach (var line in note.Content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None))
        {
            body.AppendChild(new Paragraph(new Run(new Text(line))));
        }

        mainPart.Document.Save();
    }
}
