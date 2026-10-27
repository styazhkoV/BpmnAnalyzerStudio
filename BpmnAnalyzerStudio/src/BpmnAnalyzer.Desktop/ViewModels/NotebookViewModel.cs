// src/BpmnAnalyzer.Desktop/ViewModels/NotebookViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using BpmnAnalyzer.Core.Domain;
using BpmnAnalyzer.Application.Services;

namespace BpmnAnalyzer.Desktop.ViewModels;

public partial class NotebookViewModel : ViewModelBase
{
    private readonly NotebookApplicationService _notebookApplicationService;

    public ObservableCollection<NoteModel> Notes { get; } = new();

    [ObservableProperty]
    private NoteModel? _selectedNote;

    [ObservableProperty]
    private string _statusMessage = "Блокнот готов к работе.";

    public NotebookViewModel(NotebookApplicationService notebookApplicationService)
    {
        _notebookApplicationService = notebookApplicationService;
        var loadError = LoadNotes();
        if (Notes.Count == 0)
        {
            AddNote();
        }
        else
        {
            SelectedNote = Notes.First();
        }

        if (loadError is not null)
        {
            StatusMessage = $"Ошибка загрузки заметок: {loadError}";
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
            var filePath = _notebookApplicationService.SaveNotes(Notes);

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
            var filePath = _notebookApplicationService.ExportToMarkdown(SelectedNote);

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
            var filePath = _notebookApplicationService.ExportToWord(selectedNote);

            StatusMessage = $"Заметка экспортирована в Word (.docx): {filePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка экспорта в Word: {ex.Message}";
        }
    }

    private string? LoadNotes()
    {
        try
        {
            foreach (var note in _notebookApplicationService.LoadNotes())
            {
                Notes.Add(note);
            }
            return null;
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }
}