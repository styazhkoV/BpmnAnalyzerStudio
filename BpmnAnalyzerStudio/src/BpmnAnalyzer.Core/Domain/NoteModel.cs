// src/BpmnAnalyzer.Core/Domain/NoteModel.cs
using System;

namespace BpmnAnalyzer.Core.Domain;

public class NoteModel
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = "Новая заметка";
    public string Content { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}