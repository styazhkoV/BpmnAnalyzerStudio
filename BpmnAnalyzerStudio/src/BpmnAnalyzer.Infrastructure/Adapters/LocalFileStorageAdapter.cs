using BpmnAnalyzer.Application.Adapters;

namespace BpmnAnalyzer.Infrastructure.Adapters;

public sealed class LocalFileStorageAdapter : IFileStorageAdapter
{
    public string DesktopDirectory { get; } =
        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);

    public bool FileExists(string filePath) => File.Exists(filePath);

    public string ReadAllText(string filePath) => File.ReadAllText(filePath);

    public void WriteAllText(string filePath, string content) => File.WriteAllText(filePath, content);
}
