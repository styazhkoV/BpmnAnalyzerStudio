using BpmnAnalyzer.Application.Adapters;
using BpmnAnalyzer.Application.Models;
using BpmnAnalyzer.Core.Parser;
using BpmnAnalyzer.Core.Validation;

namespace BpmnAnalyzer.Application.Services;

public sealed class BpmnApplicationService(
    IBrdDocxGeneratorAdapter brdDocxGenerator,
    IFileStorageAdapter fileStorage)
{
    public BpmnValidationResult Validate(string xml)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(xml);

        var model = new BpmnXmlParser().Parse(xml);
        var errors = new BpmnValidator().Validate(model)
            .Select(error => new BpmnValidationIssue(error.ElementId, error.RuleCode, error.Message))
            .ToArray();

        return new BpmnValidationResult(
            errors,
            new BpmnElementCounts(
                model.StartEvents.Count,
                model.EndEvents.Count,
                model.Tasks.Count,
                model.Gateways.Count,
                model.Flows.Count));
    }

    public string GenerateBrd(string xml)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(xml);

        var model = new BpmnXmlParser().Parse(xml);
        var desktopDirectory = fileStorage.DesktopDirectory;
        if (string.IsNullOrWhiteSpace(desktopDirectory))
        {
            throw new InvalidOperationException("Не удалось определить папку рабочего стола для сохранения BRD.");
        }

        const string fileName = "Agile_BRD_Requirements";
        var outputPath = Path.Combine(desktopDirectory, $"{fileName}.docx");
        for (var suffix = 1; fileStorage.FileExists(outputPath); suffix++)
        {
            outputPath = Path.Combine(desktopDirectory, $"{fileName}_{suffix}.docx");
        }

        brdDocxGenerator.Generate(outputPath, model);
        return outputPath;
    }
}
