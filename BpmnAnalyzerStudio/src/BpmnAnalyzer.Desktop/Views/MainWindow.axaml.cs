// src/BpmnAnalyzer.Desktop/Views/MainWindow.axaml.cs
using Avalonia.Controls;
using BpmnAnalyzer.Core.Export;
using BpmnAnalyzer.Core.Parser;
using BpmnAnalyzer.Core.Validation;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BpmnAnalyzer.Desktop.Views;

public partial class MainWindow : Window
{
    private static readonly JsonSerializerOptions MessageJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MainWindow()
    {
        InitializeComponent();
        BpmnWebView.WebMessageReceived += OnWebMessageReceived;
        InitializeWebView();
    }

    private void InitializeWebView()
    {
        try
        {
            var basePath = AppDomain.CurrentDomain.BaseDirectory;
            var indexPath = Path.Combine(basePath, "Assets", "Web", "index.html");

            if (File.Exists(indexPath))
            {
                // Используем Navigate с Uri, чтобы WebKit корректно подгружал css/app.css и js/ скрипты
                var fileUri = new Uri(indexPath);
                BpmnWebView.Navigate(fileUri);
            }
            else
            {
                BpmnWebView.NavigateToString(
                    "<html><body style='background:#0f1419;color:#e7ecf3;font-family:sans-serif;padding:30px;'>" +
                    "<h2>Ошибка загрузки интерфейса</h2>" +
                    "<p>Файл <code>index.html</code> не найден в каталоге <code>Assets/Web</code>.</p>" +
                    "</body></html>"
                );
            }
        }
        catch (Exception ex)
        {
            BpmnWebView.NavigateToString($"<html><body style='background:#0f1419;color:#ef4444;padding:30px;'><h3>Ошибка WebView: {ex.Message}</h3></body></html>");
        }
    }

    private async void OnWebMessageReceived(object? sender, WebMessageReceivedEventArgs e)
    {
        string? requestId = null;
        try
        {
            var messageBody = e.Body;
            if (string.IsNullOrWhiteSpace(messageBody))
            {
                throw new InvalidOperationException("Получено пустое сообщение от редактора.");
            }

            var request = JsonSerializer.Deserialize<BackendRequest>(messageBody, MessageJsonOptions)
                ?? throw new InvalidOperationException("Получен пустой запрос от редактора.");
            requestId = request.Id;

            if (string.IsNullOrWhiteSpace(request.Id) || string.IsNullOrWhiteSpace(request.Xml))
            {
                throw new InvalidOperationException("Запрос должен содержать идентификатор и BPMN XML.");
            }

            var model = new BpmnXmlParser().Parse(request.Xml);
            object result = request.Action switch
            {
                "validate" => new
                {
                    errors = new BpmnValidator().Validate(model)
                        .Select(error => new
                        {
                            elementId = error.ElementId,
                            code = error.RuleCode,
                            message = error.Message
                        }).ToArray(),
                    counts = new
                    {
                        starts = model.StartEvents.Count,
                        ends = model.EndEvents.Count,
                        tasks = model.Tasks.Count,
                        gateways = model.Gateways.Count,
                        flows = model.Flows.Count
                    }
                },
                "generate-brd" => GenerateBrd(model),
                _ => throw new InvalidOperationException($"Неизвестная операция бэкенда: {request.Action}.")
            };

            await SendBackendResponse(request.Id, true, result, null);
        }
        catch (Exception ex)
        {
            if (!string.IsNullOrWhiteSpace(requestId))
            {
                await SendBackendResponse(requestId, false, null, ex.Message);
            }
            else
            {
                await BpmnWebView.InvokeScript($"window.onBackendError({JsonSerializer.Serialize(ex.Message)})");
            }
        }
    }

    private static object GenerateBrd(BpmnAnalyzer.Core.Domain.ProcessModel model)
    {
        var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrWhiteSpace(desktopPath))
        {
            throw new InvalidOperationException("Не удалось определить папку рабочего стола для сохранения BRD.");
        }

        const string fileName = "Agile_BRD_Requirements";
        var outputPath = Path.Combine(desktopPath, $"{fileName}.docx");
        for (var suffix = 1; File.Exists(outputPath); suffix++)
        {
            outputPath = Path.Combine(desktopPath, $"{fileName}_{suffix}.docx");
        }

        new BrdDocxGenerator().Generate(outputPath, model);
        return new { path = outputPath };
    }

    private async System.Threading.Tasks.Task SendBackendResponse(
        string id,
        bool ok,
        object? result,
        string? error)
    {
        var response = JsonSerializer.Serialize(new { id, ok, result, error });
        await BpmnWebView.InvokeScript($"window.onBackendResponse({response})");
    }

    private sealed record BackendRequest(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("action")] string Action,
        [property: JsonPropertyName("xml")] string Xml);
}