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
    private static readonly XName ParticipantElementName = BpmnNs + "participant";
    private static readonly XName SequenceFlowElementName = BpmnNs + "sequenceFlow";

    public ProcessModel Parse(string xmlContent)
    {
        var doc = XDocument.Parse(xmlContent);
        var root = doc.Root;

        if (root == null)
        {
            throw new InvalidOperationException("Некорректный BPMN XML: корневой элемент отсутствует.");
        }

        var participants = new List<Participant>();
        var tasks = new List<TaskNode>();
        var gateways = new List<GatewayNode>();
        var startEvents = new List<EventNode>();
        var endEvents = new List<EventNode>();
        var flows = new List<SequenceFlow>();

        foreach (var element in root.Descendants())
        {
            var localName = element.Name.LocalName;

            if (element.Name == ParticipantElementName)
            {
                participants.Add(new Participant(
                    element.Attribute("id")?.Value ?? string.Empty,
                    element.Attribute("name")?.Value ?? string.Empty,
                    element.Attribute("processRef")?.Value ?? string.Empty));
            }

            if (localName is "task" or "userTask" or "serviceTask")
            {
                tasks.Add(new TaskNode
                {
                    Id = element.Attribute("id")?.Value ?? string.Empty,
                    Name = element.Attribute("name")?.Value ?? string.Empty,
                    TaskType = localName,
                    Documentation = element.Element(BpmnNs + "documentation")?.Value,
                    IncomingFlows = element.Elements(BpmnNs + "incoming").Select(incoming => incoming.Value).ToList(),
                    OutgoingFlows = element.Elements(BpmnNs + "outgoing").Select(outgoing => outgoing.Value).ToList()
                });
            }

            if (localName.EndsWith("Gateway", StringComparison.Ordinal))
            {
                gateways.Add(new GatewayNode
                {
                    Id = element.Attribute("id")?.Value ?? string.Empty,
                    Name = element.Attribute("name")?.Value ?? string.Empty,
                    GatewayType = localName,
                    IncomingFlows = element.Elements(BpmnNs + "incoming").Select(incoming => incoming.Value).ToList(),
                    OutgoingFlows = element.Elements(BpmnNs + "outgoing").Select(outgoing => outgoing.Value).ToList()
                });
            }

            if (localName == "startEvent")
            {
                startEvents.Add(CreateEventNode(element));
            }
            else if (localName == "endEvent")
            {
                endEvents.Add(CreateEventNode(element));
            }

            if (element.Name == SequenceFlowElementName)
            {
                flows.Add(new SequenceFlow(
                    element.Attribute("id")?.Value ?? string.Empty,
                    element.Attribute("sourceRef")?.Value ?? string.Empty,
                    element.Attribute("targetRef")?.Value ?? string.Empty,
                    element.Element(BpmnNs + "conditionExpression") != null,
                    element.Attribute("default") != null));
            }
        }

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

    private static EventNode CreateEventNode(XElement element) => new(
        element.Attribute("id")?.Value ?? string.Empty,
        element.Attribute("name")?.Value ?? string.Empty,
        element.Elements(BpmnNs + "incoming").Select(incoming => incoming.Value).ToList(),
        element.Elements(BpmnNs + "outgoing").Select(outgoing => outgoing.Value).ToList());
}