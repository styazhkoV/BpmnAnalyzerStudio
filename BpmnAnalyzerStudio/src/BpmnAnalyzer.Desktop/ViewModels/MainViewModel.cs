using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using Avalonia;
using BpmnAnalyzer.Application.Services;

namespace BpmnAnalyzer.Desktop.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    private readonly BpmnApplicationService _bpmnApplicationService;

    public MainViewModel(
        BpmnApplicationService bpmnApplicationService,
        NotebookApplicationService notebookApplicationService)
    {
        _bpmnApplicationService = bpmnApplicationService;
        Notebook = new NotebookViewModel(notebookApplicationService);
    }

    [ObservableProperty]
    private string _statusMessage = "Готово к работе. Загрузите или отредактируйте BPMN схему.";

    [ObservableProperty]
    private string _bpmnXmlContent = @"<?xml version='1.0' encoding='UTF-8'?>
<definitions xmlns='http://www.omg.org/spec/BPMN/20100524/MODEL' 
             xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' 
             id='Definitions_1' targetNamespace='http://bpmn.io/schema/bpmn'>
  <process id='Process_1' isExecutable='false'>
    <startEvent id='StartEvent_1' name='Старт'/>
  </process>
</definitions>";

    public ObservableCollection<string> ValidationErrors { get; } = new();

    public NotebookViewModel Notebook { get; }

    public event Action<string>? RequestLoadIntoEditor;

    [RelayCommand]
    private void PushToEditor()
    {
        if (!string.IsNullOrWhiteSpace(BpmnXmlContent))
        {
            RequestLoadIntoEditor?.Invoke(BpmnXmlContent);
            StatusMessage = "Схема отправлена в визуальный редактор.";
        }
    }

    public void UpdateXmlFromEditor(string newXml)
    {
        if (!string.Equals(BpmnXmlContent, newXml))
        {
            BpmnXmlContent = newXml; // Безопасное обновление через сгенерированное свойство
            StatusMessage = "Схема обновлена из визуального редактора.";
        }
    }

    [RelayCommand]
    private void ValidateProcess()
    {
        ValidationErrors.Clear();
        if (string.IsNullOrWhiteSpace(BpmnXmlContent)) return;

        try
        {
            var result = _bpmnApplicationService.Validate(BpmnXmlContent);

            foreach (var error in result.Errors)
            {
                ValidationErrors.Add($"[{error.Code}] {error.Message}");
            }

            StatusMessage = result.Errors.Any()
                ? $"Найдено нарушений правил: {result.Errors.Count}."
                : "Валидация успешна! Все правила соблюдены.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка валидации BPMN: {ex.Message}";
        }
    }

    [RelayCommand]
    private void GenerateBrd()
    {
        if (string.IsNullOrWhiteSpace(BpmnXmlContent)) return;

        try
        {
            var outputPath = _bpmnApplicationService.GenerateBrd(BpmnXmlContent);

            StatusMessage = $"Документ Agile BRD сохранен: {outputPath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка генерации .docx: {ex.Message}";
        }
    }

    [RelayCommand]
    private void ToggleTheme()
    {
        if (Avalonia.Application.Current != null)
        {
            var currentVariant = Avalonia.Application.Current.RequestedThemeVariant;
            Avalonia.Application.Current.RequestedThemeVariant =
                currentVariant == Avalonia.Styling.ThemeVariant.Dark 
                    ? Avalonia.Styling.ThemeVariant.Light 
                    : Avalonia.Styling.ThemeVariant.Dark;

            StatusMessage = "Тема интерфейса переключена.";
        }
    }
}