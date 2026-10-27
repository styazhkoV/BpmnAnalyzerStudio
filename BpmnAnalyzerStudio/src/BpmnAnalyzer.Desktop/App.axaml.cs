// src/BpmnAnalyzer.Desktop/App.axaml.cs
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using BpmnAnalyzer.Desktop.Views;
using BpmnAnalyzer.Desktop.ViewModels;
using BpmnAnalyzer.Application.Services;
using BpmnAnalyzer.Infrastructure.Adapters;

namespace BpmnAnalyzer.Desktop;

public partial class App : Avalonia.Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var fileStorage = new LocalFileStorageAdapter();
            var bpmnApplicationService = new BpmnApplicationService(
                new BrdDocxGeneratorAdapter(),
                fileStorage);
            var notebookApplicationService = new NotebookApplicationService(
                fileStorage,
                new NoteDocxGeneratorAdapter());
            var viewModel = new MainViewModel(bpmnApplicationService, notebookApplicationService);

            var mainWindow = new MainWindow();
            mainWindow.Configure(bpmnApplicationService, viewModel);
            desktop.MainWindow = mainWindow;
        }

        base.OnFrameworkInitializationCompleted();
    }
}