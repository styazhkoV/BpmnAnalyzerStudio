// src/BpmnAnalyzer.Core/Validation/BpmnValidator.cs
using System.Collections.Generic;
using System.Linq;
using BpmnAnalyzer.Core.Domain;

namespace BpmnAnalyzer.Core.Validation;

public class BpmnValidator
{
    public IEnumerable<ValidationError> Validate(ProcessModel model)
    {
        var errors = new List<ValidationError>();
        var startOutgoingFlows = new HashSet<string>(
            model.StartEvents.SelectMany(startEvent => startEvent.OutgoingFlows));

        // --- Правило 1: Старт и Финиш (ровно 1 StartEvent, >= 1 EndEvent) ---
        if (model.StartEvents.Count != 1)
        {
            errors.Add(new ValidationError(
                "Process", 
                "RULE-1", 
                $"Процесс должен содержать ровно 1 стартовое событие (StartEvent). Найдено: {model.StartEvents.Count}."
            ));
        }

        if (model.EndEvents.Count < 1)
        {
            errors.Add(new ValidationError(
                "Process", 
                "RULE-1", 
                "Процесс должен содержать как минимум 1 конечное событие (EndEvent)."
            ));
        }

        // --- Правило 2: Отсутствие висячих нод (задачи и шлюзы должны иметь входящие и исходящие потоки) ---
        foreach (var task in model.Tasks)
        {
            if (task.IncomingFlows.Count == 0 &&
                !task.OutgoingFlows.Any(startOutgoingFlows.Contains))
            {
                errors.Add(new ValidationError(task.Id, "RULE-2", $"Задача '{task.Name}' ({task.Id}) не имеет входящих потоков управления."));
            }
            if (task.OutgoingFlows.Count == 0)
            {
                errors.Add(new ValidationError(task.Id, "RULE-2", $"Задача '{task.Name}' ({task.Id}) не имеет исходящих потоков управления."));
            }
        }

        foreach (var gateway in model.Gateways)
        {
            if (gateway.IncomingFlows.Count == 0)
            {
                errors.Add(new ValidationError(gateway.Id, "RULE-2", $"Шлюз ({gateway.Id}) не имеет входящих потоков."));
            }
            if (gateway.OutgoingFlows.Count == 0)
            {
                errors.Add(new ValidationError(gateway.Id, "RULE-2", $"Шлюз ({gateway.Id}) не имеет исходящих потоков."));
            }
        }

        // --- Правило 3: Привязка к пулу (проверка наличия пулов, если модель многопуловая) ---
        if (model.Participants.Count > 0)
        {
            // Убеждаемся, что пулы заданы корректно
            foreach (var participant in model.Participants.Where(p => string.IsNullOrWhiteSpace(p.Name)))
            {
                errors.Add(new ValidationError(participant.Id, "RULE-3", $"Пул (Participant) с ID {participant.Id} не имеет названия."));
            }
        }

        // --- Правило 4: Наличие имен у элементов ---
        foreach (var task in model.Tasks.Where(t => string.IsNullOrWhiteSpace(t.Name)))
        {
            errors.Add(new ValidationError(task.Id, "RULE-4", $"Задача с ID {task.Id} не имеет обязательного названия (name)."));
        }

        // --- Правило 5: Документирование сервисных и пользовательских задач ---
        foreach (var task in model.Tasks.Where(t => t.TaskType == "serviceTask" && string.IsNullOrWhiteSpace(t.Documentation)))
        {
            errors.Add(new ValidationError(task.Id, "RULE-5", $"Сервисная задача '{task.Name}' ({task.Id}) не задокументирована (поле documentation пустое)."));
        }

        // --- Правило 6: Условия на исходящих потоках развилочных шлюзов ---
        Dictionary<string, List<(int Index, SequenceFlow Flow)>>? flowsById = null;

        foreach (var gateway in model.Gateways.Where(g => g.GatewayType == "exclusiveGateway"))
        {
            if (flowsById == null)
            {
                flowsById = new Dictionary<string, List<(int Index, SequenceFlow Flow)>>();
                for (var index = 0; index < model.Flows.Count; index++)
                {
                    var flow = model.Flows[index];
                    if (!flowsById.TryGetValue(flow.Id, out var matchingFlows))
                    {
                        matchingFlows = new List<(int Index, SequenceFlow Flow)>();
                        flowsById.Add(flow.Id, matchingFlows);
                    }

                    matchingFlows.Add((index, flow));
                }
            }

            var visitedFlowIds = new HashSet<string>();
            var matchingFlowCount = 0;
            foreach (var flowId in gateway.OutgoingFlows)
            {
                if (visitedFlowIds.Add(flowId) && flowsById.TryGetValue(flowId, out var matchingFlows))
                {
                    matchingFlowCount += matchingFlows.Count;
                }
            }

            if (matchingFlowCount <= 1)
            {
                continue;
            }

            visitedFlowIds.Clear();
            var orderedMatchingFlows = new List<(int Index, SequenceFlow Flow)>(matchingFlowCount);
            foreach (var flowId in gateway.OutgoingFlows)
            {
                if (!visitedFlowIds.Add(flowId) ||
                    !flowsById.TryGetValue(flowId, out var matchingFlows))
                {
                    continue;
                }

                orderedMatchingFlows.AddRange(matchingFlows);
            }

            orderedMatchingFlows.Sort(static (left, right) => left.Index.CompareTo(right.Index));
            foreach (var (_, flow) in orderedMatchingFlows)
            {
                if (!flow.HasCondition && !flow.IsDefault)
                {
                    errors.Add(new ValidationError(gateway.Id, "RULE-6", $"Исходящий поток '{flow.Id}' из шлюза '{gateway.Name}' не содержит обязательное условие (conditionExpression)."));
                }
            }
        }

        // --- Правило 7: Сходимость ветвлений (проверка баланса развилок и сходимости) ---
        // Упрощенная эвристика: количество сходящихся шлюзов должно соотноситься с расходящимися
        var divergingGateways = model.Gateways.Count(g => g.OutgoingFlows.Count > 1);
        var convergingGateways = model.Gateways.Count(g => g.IncomingFlows.Count > 1);
        
        if (divergingGateways > 0 && convergingGateways == 0 && model.EndEvents.Count <= 1)
        {
            errors.Add(new ValidationError("Process", "RULE-7", "Обнаружены ветвления (Gateway), но отсутствуют сходящиеся шлюзы или множественные конечные события для закрытия ветвей."));
        }

        return errors;
    }
}