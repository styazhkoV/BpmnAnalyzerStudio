// src/BpmnAnalyzer.Desktop/Program.cs
using System;
using Avalonia;

namespace BpmnAnalyzer.Desktop;

public class Program
{
    // Инициализация приложения для Avalonia
    [STAThread]
    public static void Main(string[] args) => BuildAvaloniaApp()
        .StartWithClassicDesktopLifetime(args);

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();
}