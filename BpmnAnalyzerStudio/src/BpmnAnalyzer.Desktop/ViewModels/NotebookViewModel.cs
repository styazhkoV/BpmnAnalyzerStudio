// src/BpmnAnalyzer.Desktop/ViewModels/NotebookViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Desktop.ViewModels;

public partial class NotebookViewModel : ViewModelBase
{
    public ObservableCollection<NoteModel> Notes { get; } = new();

    [ObservableProperty]
    private NoteModel? _selectedNote;

    [ObservableProperty]
    private string _statusMessage = "Блокнот готов к работе.";

    public NotebookViewModel()
    {
        LoadNotes();
        if (Notes.Count == 0)
        {
            AddNote();
        }
        else
        {
            SelectedNote = Notes.First();
        }
    }

    [RelayCommand]
    private void AddNote()
    {
        var newNote = new NoteModel
        {
            Title = $"Требования от {DateTime.Now:dd.MM.yyyy HH:mm}",
            Content = "# Интервью с заказчиком\n\n- **Цель:** \n- **Участники:** \n- **Боли существующего процесса:** \n"
        };
        Notes.Add(newNote);
        SelectedNote = newNote;
        StatusMessage = "Создана новая заметка.";
    }

    [RelayCommand]
    private void DeleteNote()
    {
        if (SelectedNote != null)
        {
            Notes.Remove(SelectedNote);
            SelectedNote = Notes.FirstOrDefault();
            StatusMessage = "Заметка удалена.";
            SaveNotes();
        }
    }

    [RelayCommand]
    private void SaveNotes()
    {
        try
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var filePath = Path.Combine(desktopPath, "analyst_notes.json");
            
            var json = JsonSerializer.Serialize(Notes, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filePath, json);

            StatusMessage = $"Заметки успешно сохранены: {filePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка сохранения заметок: {ex.Message}";
        }
    }

    [RelayCommand]
    private void ExportToMarkdown()
    {
        if (SelectedNote == null)
        {
            StatusMessage = "Выберите заметку для экспорта.";
            return;
        }

        try
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var safeTitle = string.Join("_", SelectedNote.Title.Split(Path.GetInvalidFileNameChars()));
            var filePath = Path.Combine(desktopPath, $"{safeTitle}.md");

            var mdContent = $"# {SelectedNote.Title}\n\n*Обновлено: {SelectedNote.UpdatedAt:dd.MM.yyyy HH:mm}*\n\n---\n\n{SelectedNote.Content}";
            File.WriteAllText(filePath, mdContent);

            StatusMessage = $"Заметка экспортирована в Markdown: {filePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка экспорта в Markdown: {ex.Message}";
        }
    }

    [RelayCommand]
    private void ExportToWord()
    {
        var selectedNote = SelectedNote;
        if (selectedNote == null)
        {
            StatusMessage = "Выберите заметку для экспорта.";
            return;
        }

        try
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var safeTitle = string.Join("_", selectedNote.Title.Split(Path.GetInvalidFileNameChars()));
            var filePath = Path.Combine(desktopPath, $"{safeTitle}.docx");

            using (var wordDocument = WordprocessingDocument.Create(filePath, WordprocessingDocumentType.Document))
            {
                var mainPart = wordDocument.AddMainDocumentPart();
                mainPart.Document = new Document(new Body());
                var body = mainPart.Document.Body
                    ?? throw new InvalidOperationException("Не удалось создать содержимое документа Word.");

                body.AppendChild(new Paragraph(new Run(new Text(selectedNote.Title))
                {
                    RunProperties = new RunProperties(new Bold(), new FontSize() { Val = "28" })
                }));

                body.AppendChild(new Paragraph(new Run(new Text($"Дата обновления: {selectedNote.UpdatedAt:dd.MM.yyyy HH:mm}"))
                {
                    RunProperties = new RunProperties(new Italic(), new Color() { Val = "666666" })
                }));

                body.AppendChild(new Paragraph());

                foreach (var line in selectedNote.Content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None))
                {
                    body.AppendChild(new Paragraph(new Run(new Text(line))));
                }

                mainPart.Document.Save();
            }

            StatusMessage = $"Заметка экспортирована в Word (.docx): {filePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка экспорта в Word: {ex.Message}";
        }
    }

    private void LoadNotes()
    {
        try
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var filePath = Path.Combine(desktopPath, "analyst_notes.json");

            if (File.Exists(filePath))
            {
                var json = File.ReadAllText(filePath);
                var loadedNotes = JsonSerializer.Deserialize<ObservableCollection<NoteModel>>(json);
                if (loadedNotes != null)
                {
                    Notes.Clear();
                    foreach (var note in loadedNotes)
                    {
                        Notes.Add(note);
                    }
                }
            }
        }
        catch
        {
            // Игнорируем при первом запуске
        }
    }
}