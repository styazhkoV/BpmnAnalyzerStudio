using Avalonia.Controls;
using BpmnAnalyzer.Desktop.ViewModels;

namespace BpmnAnalyzer.Desktop.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
    }
}
