using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Application.Contracts;
using BpmnAnalyzer.Application.Models;
using BpmnAnalyzer.Application.Ports;
using BpmnAnalyzer.Application.Services;
using BpmnAnalyzer.Core.Domain;
using BpmnAnalyzer.Core.Validation;
using BpmnAnalyzer.Infrastructure.Adapters;

namespace BpmnAnalyzer.Tests.Application;

public class BpmnApplicationServiceTests
{
    [Fact]
    public void Validate_ReturnsValidationSummary()
    {
        const string xml = """
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
              <process id="process" isExecutable="false">
                <startEvent id="start" name="Start"><outgoing>flow1</outgoing></startEvent>
                <task id="task" name="Task"><incoming>flow1</incoming><outgoing>flow2</outgoing></task>
                <endEvent id="end" name="End"><incoming>flow2</incoming></endEvent>
                <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
                <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
              </process>
            </definitions>
            """;

        var service = new BpmnApplicationService(
            new BpmnXmlParserAdapter(),
            new BpmnValidator(),
            new FakeBrdDocxGenerator(),
            new FakeFileStorage());

        var result = service.Validate(xml);

        Assert.Empty(result.Errors);
        Assert.Equal(1, result.Counts.Starts);
        Assert.Equal(1, result.Counts.Ends);
        Assert.Equal(1, result.Counts.Tasks);
        Assert.Equal(0, result.Counts.Gateways);
        Assert.Equal(2, result.Counts.Flows);
    }

    [Fact]
    public void GenerateBrd_WritesDocumentToDesktopPath()
    {
        const string xml = """
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
              <process id="process" isExecutable="false">
                <startEvent id="start" name="Start"><outgoing>flow1</outgoing></startEvent>
                <task id="task" name="Task"><incoming>flow1</incoming><outgoing>flow2</outgoing></task>
                <endEvent id="end" name="End"><incoming>flow2</incoming></endEvent>
                <sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
                <sequenceFlow id="flow2" sourceRef="task" targetRef="end" />
              </process>
            </definitions>
            """;

        var storage = new FakeFileStorage();
        var generator = new FakeBrdDocxGenerator();
        var service = new BpmnApplicationService(
            new BpmnXmlParserAdapter(),
            new BpmnValidator(),
            generator,
            storage);

        var outputPath = service.GenerateBrd(xml);

        Assert.EndsWith("Agile_BRD_Requirements.docx", outputPath);
        Assert.True(generator.Generated);
        Assert.Equal(outputPath, generator.LastFilePath);
    }

    private sealed class FakeFileStorage : IFileStorageAdapter
    {
        public string DesktopDirectory { get; } = Path.Combine(Path.GetTempPath(), $"bpmn-tests-{Guid.NewGuid():N}");

        public FakeFileStorage()
        {
            Directory.CreateDirectory(DesktopDirectory);
        }

        public bool FileExists(string filePath) => File.Exists(filePath);

        public string ReadAllText(string filePath) => File.ReadAllText(filePath);

        public void WriteAllText(string filePath, string content) => File.WriteAllText(filePath, content);
    }

    private sealed class FakeBrdDocxGenerator : IBrdDocxGeneratorAdapter
    {
        public bool Generated { get; private set; }
        public string? LastFilePath { get; private set; }

        public void Generate(string filePath, ProcessModel model)
        {
            Generated = true;
            LastFilePath = filePath;
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            File.WriteAllText(filePath, "mock-docx");
        }
    }
}
