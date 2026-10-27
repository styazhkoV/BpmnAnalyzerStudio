using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using Avalonia;
using BpmnAnalyzer.Core.Parser;
using BpmnAnalyzer.Core.Validation;
using BpmnAnalyzer.Core.Export;

namespace BpmnAnalyzer.Desktop.ViewModels;

public partial class MainViewModel : ViewModelBase
{
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

    public NotebookViewModel Notebook { get; } = new();

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
        if (!string.Equals(_bpmnXmlContent, newXml))
        {
            _bpmnXmlContent = newXml;
            OnPropertyChanged(nameof(BpmnXmlContent));
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
            var parser = new BpmnXmlParser();
            var model = parser.Parse(BpmnXmlContent);
            var validator = new BpmnValidator();
            var errors = validator.Validate(model).ToList();

            foreach (var err in errors)
            {
                ValidationErrors.Add($"[{err.RuleCode}] {err.Message}");
            }

            StatusMessage = errors.Any()
                ? $"Найдено нарушений правил: {errors.Count}."
                : "Валидация успешна! Все правила соблюдены.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Ошибка разбора XML: {ex.Message}";
        }
    }

    [RelayCommand]
    private void GenerateBrd()
    {
        if (string.IsNullOrWhiteSpace(BpmnXmlContent)) return;

        try
        {
            var parser = new BpmnXmlParser();
            var model = parser.Parse(BpmnXmlContent);

            string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string outputPath = Path.Combine(desktopPath, "Agile_BRD_Requirements.docx");

            var generator = new BrdDocxGenerator();
            generator.Generate(outputPath, model);

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
        if (Application.Current != null)
        {
            var currentVariant = Application.Current.RequestedThemeVariant;
            Application.Current.RequestedThemeVariant =
                currentVariant == Avalonia.Styling.ThemeVariant.Dark
                    ? Avalonia.Styling.ThemeVariant.Light
                    : Avalonia.Styling.ThemeVariant.Dark;

            StatusMessage = "Тема интерфейса переключена.";
        }
    }
}
