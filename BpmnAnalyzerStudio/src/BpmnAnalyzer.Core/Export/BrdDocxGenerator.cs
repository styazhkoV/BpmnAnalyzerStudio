// src/BpmnAnalyzer.Core/Export/BrdDocxGenerator.cs
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Core.Export;

public class BrdDocxGenerator
{
    public void Generate(string filePath, ProcessModel model, string documentTitle = "Agile Business Requirements Document (BRD)")
    {
        using var wordDocument = WordprocessingDocument.Create(filePath, WordprocessingDocumentType.Document);
        
        var mainPart = wordDocument.AddMainDocumentPart();
        mainPart.Document = new Document(new Body());
        var body = mainPart.Document.Body;

        // 1. Заголовок документа
        AddHeading(body, documentTitle, 28, true);
        AddParagraph(body, "Автоматически сгенерировано с помощью BpmnAnalyzer Studio (.NET 8).");
        AddEmptyParagraph(body);

        // 2. Раздел 1: Executive Summary
        AddHeading(body, "1. Executive Summary", 20);
        AddParagraph(body, "Данный документ описывает требования к бизнес-процессу, формализованные на основе BPMN-схемы.");
        AddBulletPoint(body, $"Всего пулов (Participants): {model.Participants.Count}");
        AddBulletPoint(body, $"Общее количество задач (Tasks): {model.Tasks.Count}");
        AddBulletPoint(body, $"Количество развилочных шлюзов (Gateways): {model.Gateways.Count}");
        AddBulletPoint(body, $"Количество сервисных задач (Integrations): {model.Tasks.Count(t => t.TaskType == "serviceTask")}");
        AddEmptyParagraph(body);

        // 3. Раздел 2: Process Overview & Pools
        AddHeading(body, "2. Process Overview & Pools", 20);
        if (model.Participants.Any())
        {
            foreach (var p in model.Participants)
            {
                AddBulletPoint(body, $"Пул / Участник: {p.Name} (ID: {p.Id})");
            }
        }
        else
        {
            AddParagraph(body, "Процесс функционирует в рамках единого пула / пулы не заданы явно.");
        }
        AddEmptyParagraph(body);

        // 4. Раздел 3: Task & User Story Matrix
        AddHeading(body, "3. Task & User Story Matrix", 20);
        AddParagraph(body, "Матрица задач процесса:");
        
        var taskTable = CreateStyledTable();
        taskTable.AppendChild(new TableRow(
            CreateTableCell("ID задачи", true),
            CreateTableCell("Название", true),
            CreateTableCell("Тип", true),
            CreateTableCell("Описание / Документация", true)
        ));

        foreach (var task in model.Tasks)
        {
            taskTable.AppendChild(new TableRow(
                CreateTableCell(task.Id),
                CreateTableCell(task.Name),
                CreateTableCell(task.TaskType),
                CreateTableCell(task.Documentation ?? "—")
            ));
        }
        body.AppendChild(taskTable);
        AddEmptyParagraph(body);

        // 5. Раздел 4: Business Rules & Gateways Specification (Детальная спецификация шлюзов)
        AddHeading(body, "4. Business Rules & Gateways Specification", 20);
        AddParagraph(body, "Ниже приведена детальная спецификация развилочных шлюзов и бизнес-правил ветвления потоков:");

        if (model.Gateways.Any())
        {
            var gwTable = CreateStyledTable();
            gwTable.AppendChild(new TableRow(
                CreateTableCell("ID шлюза", true),
                CreateTableCell("Название / Описание", true),
                CreateTableCell("Тип шлюза", true),
                CreateTableCell("Входящие / Исходящие потоки", true)
            ));

            foreach (var gw in model.Gateways)
            {
                string flowsInfo = $"Вход: {string.Join(", ", gw.IncomingFlows)}\nВыход: {string.Join(", ", gw.OutgoingFlows)}";
                gwTable.AppendChild(new TableRow(
                    CreateTableCell(gw.Id),
                    CreateTableCell(string.IsNullOrWhiteSpace(gw.Name) ? "Без названия" : gw.Name),
                    CreateTableCell(gw.GatewayType),
                    CreateTableCell(flowsInfo)
                ));
            }
            body.AppendChild(gwTable);
        }
        else
        {
            AddParagraph(body, "В процессной модели шлюзы (Gateways) отсутствуют.");
        }
        AddEmptyParagraph(body);

        // 6. Раздел 5: Data & Integration Requirements (Расширенная таблица интеграций)
        AddHeading(body, "5. Data & Integration Requirements", 20);
        AddParagraph(body, "Спецификация интеграционных вызовов, системных задач и требований к обмену данными:");

        var serviceTasks = model.Tasks.Where(t => t.TaskType == "serviceTask").ToList();
        if (serviceTasks.Any())
        {
            var intTable = CreateStyledTable();
            intTable.AppendChild(new TableRow(
                CreateTableCell("ID сервиса", true),
                CreateTableCell("Название интеграции", true),
                CreateTableCell("Техническая документация / Параметры", true)
            ));

            foreach (var st in serviceTasks)
            {
                intTable.AppendChild(new TableRow(
                    CreateTableCell(st.Id),
                    CreateTableCell(st.Name),
                    CreateTableCell(string.IsNullOrWhiteSpace(st.Documentation) ? "Требуется уточнение API / контракта" : st.Documentation)
                ));
            }
            body.AppendChild(intTable);
        }
        else
        {
            AddParagraph(body, "Сервисные задачи (Service Tasks) в модели не обнаружены. Интеграционные требования не задействованы.");
        }

        mainPart.Document.Save();
    }

    private Table CreateStyledTable()
    {
        var table = new Table();
        var tblPr = new TableProperties(
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                new BottomBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                new LeftBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                new RightBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" }
            )
        );
        table.AppendChild(tblPr);
        return table;
    }

    private void AddHeading(Body body, string text, int fontSize, bool isBold = true)
    {
        var run = new Run(new Text(text)) { RunProperties = new RunProperties(new FontSize() { Val = fontSize.ToString() }, new Bold()) };
        body.AppendChild(new Paragraph(run));
    }

    private void AddParagraph(Body body, string text)
    {
        body.AppendChild(new Paragraph(new Run(new Text(text))));
    }

    private void AddBulletPoint(Body body, string text)
    {
        body.AppendChild(new Paragraph(new Run(new Text($"• {text}"))));
    }

    private void AddEmptyParagraph(Body body)
    {
        body.AppendChild(new Paragraph());
    }

    private TableCell CreateTableCell(string text, bool isHeader = false)
    {
        var run = new Run(new Text(text));
        if (isHeader)
        {
            run.RunProperties = new RunProperties(new Bold());
        }
        return new TableCell(new Paragraph(run));
    }
}