namespace BpmnAnalyzer.Application.Adapters;

public interface IFileStorageAdapter
{
    string DesktopDirectory { get; }
    bool FileExists(string filePath);
    string ReadAllText(string filePath);
    void WriteAllText(string filePath, string content);
}
