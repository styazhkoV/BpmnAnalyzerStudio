using BpmnAnalyzer.Core.Domain;
using BpmnAnalyzer.Core.Parser;
using BpmnAnalyzer.Core.Validation;

namespace BpmnAnalyzer.Tests;

public class UnitTest1
{
    [Fact]
    public void Parser_ExtractsProcessElementsAndFlows()
    {
        const string xml = """
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
              <participant id="pool" name="Pool" processRef="process" />
              <process id="process">
                <startEvent id="start" name="Start"><outgoing>flow1</outgoing></startEvent>
                <serviceTask id="task" name="Task">
                  <documentation>Details</documentation>
                  <incoming>flow1</incoming>
                  <outgoing>flow2</outgoing>
                </serviceTask>
                <exclusiveGateway id="gateway" name="Decision">
                  <incoming>flow2</incoming>
                  <outgoing>flow3</outgoing>
                </exclusiveGateway>
                <endEvent id="end" name="End"><incoming>flow3</incoming></endEvent>
                <sequenceFlow id="flow3" sourceRef="gateway" targetRef="end" />
              </process>
            </definitions>
            """;

        var model = new BpmnXmlParser().Parse(xml);

        Assert.Single(model.Participants);
        Assert.Equal("pool", model.Participants[0].Id);
        Assert.Single(model.Tasks);
        Assert.Equal("serviceTask", model.Tasks[0].TaskType);
        Assert.Equal("Details", model.Tasks[0].Documentation);
        Assert.Single(model.Gateways);
        Assert.Single(model.StartEvents);
        Assert.Single(model.EndEvents);
        Assert.Single(model.Flows);
        Assert.Equal("flow3", model.Flows[0].Id);
    }

    [Fact]
    public void Validator_OnlyRequiresConditionsWhenMultipleFlowsExist()
    {
        var model = new ProcessModel
        {
            Gateways =
            [
                new GatewayNode
                {
                    Id = "gateway",
                    GatewayType = "exclusiveGateway",
                    OutgoingFlows = ["flow1", "missing"]
                }
            ],
            Flows =
            [
                new SequenceFlow("flow1", "gateway", "end", false, false)
            ]
        };

        var errors = new BpmnValidator().Validate(model).ToList();

        Assert.DoesNotContain(errors, error => error.RuleCode == "RULE-6");
    }

    [Fact]
    public void Validator_FindsUnconditionedFlowOnExclusiveGateway()
    {
        var model = new ProcessModel
        {
            Gateways =
            [
                new GatewayNode
                {
                    Id = "gateway",
                    GatewayType = "exclusiveGateway",
                    OutgoingFlows = ["flow1", "flow2"]
                }
            ],
            Flows =
            [
                new SequenceFlow("flow1", "gateway", "task1", false, false),
                new SequenceFlow("flow2", "gateway", "task2", true, false)
            ]
        };

        var errors = new BpmnValidator().Validate(model).ToList();

        Assert.Contains(errors, error => error.RuleCode == "RULE-6" && error.Message.Contains("flow1"));
    }
}