// src/BpmnAnalyzer.Desktop/Views/MainWindow.axaml.cs
using Avalonia.Controls;
using System;
using System.IO;

namespace BpmnAnalyzer.Desktop.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
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
}