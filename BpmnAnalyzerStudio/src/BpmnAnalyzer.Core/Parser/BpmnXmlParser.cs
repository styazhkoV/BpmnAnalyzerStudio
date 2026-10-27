// src/BpmnAnalyzer.Core/Parser/BpmnXmlParser.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Core.Parser;

public class BpmnXmlParser
{
    private static readonly XNamespace BpmnNs = "http://www.omg.org/spec/BPMN/20100524/MODEL";

    public ProcessModel Parse(string xmlContent)
    {
        var doc = XDocument.Parse(xmlContent);
        var root = doc.Root;

        if (root == null)
        {
            throw new InvalidOperationException("Некорректный BPMN XML: корневой элемент отсутствует.");
        }

        // 1. Извлечение пулов (Participants)
        var participants = root.Descendants(BpmnNs + "participant")
            .Select(p => new Participant(
                p.Attribute("id")?.Value ?? string.Empty,
                p.Attribute("name")?.Value ?? string.Empty,
                p.Attribute("processRef")?.Value ?? string.Empty
            )).ToList();

        // 2. Извлечение задач (Task, UserTask, ServiceTask)
        var tasks = root.Descendants()
            .Where(e => e.Name.LocalName == "task" || 
                        e.Name.LocalName == "userTask" || 
                        e.Name.LocalName == "serviceTask")
            .Select(t => new TaskNode
            {
                Id = t.Attribute("id")?.Value ?? string.Empty,
                Name = t.Attribute("name")?.Value ?? string.Empty,
                TaskType = t.Name.LocalName,
                Documentation = t.Element(BpmnNs + "documentation")?.Value,
                IncomingFlows = t.Elements(BpmnNs + "incoming").Select(i => i.Value).ToList(),
                OutgoingFlows = t.Elements(BpmnNs + "outgoing").Select(o => o.Value).ToList()
            }).ToList();

        // 3. Извлечение шлюзов (Gateways)
        var gateways = root.Descendants()
            .Where(e => e.Name.LocalName.EndsWith("Gateway"))
            .Select(g => new GatewayNode
            {
                Id = g.Attribute("id")?.Value ?? string.Empty,
                Name = g.Attribute("name")?.Value ?? string.Empty,
                GatewayType = g.Name.LocalName,
                IncomingFlows = g.Elements(BpmnNs + "incoming").Select(i => i.Value).ToList(),
                OutgoingFlows = g.Elements(BpmnNs + "outgoing").Select(o => o.Value).ToList()
            }).ToList();

        // 4. Извлечение стартовых событий (StartEvent)
        var startEvents = root.Descendants()
            .Where(e => e.Name.LocalName == "startEvent")
            .Select(s => new EventNode(
                s.Attribute("id")?.Value ?? string.Empty,
                s.Attribute("name")?.Value ?? string.Empty,
                s.Elements(BpmnNs + "incoming").Select(i => i.Value).ToList(),
                s.Elements(BpmnNs + "outgoing").Select(o => o.Value).ToList()
            )).ToList();

        // 5. Извлечение конечных событий (EndEvent)
        var endEvents = root.Descendants()
            .Where(e => e.Name.LocalName == "endEvent")
            .Select(e => new EventNode(
                e.Attribute("id")?.Value ?? string.Empty,
                e.Attribute("name")?.Value ?? string.Empty,
                e.Elements(BpmnNs + "incoming").Select(i => i.Value).ToList(),
                e.Elements(BpmnNs + "outgoing").Select(o => o.Value).ToList()
            )).ToList();

        // 6. Извлечение потоков управления (Sequence Flows)
        var flows = root.Descendants(BpmnNs + "sequenceFlow")
            .Select(f => new SequenceFlow(
                f.Attribute("id")?.Value ?? string.Empty,
                f.Attribute("sourceRef")?.Value ?? string.Empty,
                f.Attribute("targetRef")?.Value ?? string.Empty,
                f.Element(BpmnNs + "conditionExpression") != null,
                f.Attribute("default") != null
            )).ToList();

        return new ProcessModel
        {
            Participants = participants,
            Tasks = tasks,
            Gateways = gateways,
            StartEvents = startEvents,
            EndEvents = endEvents,
            Flows = flows
        };
    }
}