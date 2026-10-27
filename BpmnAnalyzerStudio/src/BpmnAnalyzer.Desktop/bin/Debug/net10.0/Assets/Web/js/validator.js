(() => {
  function validate(modeler) {
    const registry = modeler.get("elementRegistry");
    const elements = registry.getAll().filter((element) => element.businessObject && !element.labelTarget);
    const businessObjects = elements.map((element) => element.businessObject);
    const errors = [];
    const add = (element, code, message) => errors.push({
      elementId: element?.id,
      code,
      message
    });
    const hasType = (element, type) => element.businessObject?.$type === type;
    const sequenceFlows = businessObjects.filter((bo) => bo.$type === "bpmn:SequenceFlow");
    const starts = businessObjects.filter((bo) => bo.$type === "bpmn:StartEvent");
    const ends = businessObjects.filter((bo) => bo.$type === "bpmn:EndEvent");
    const tasks = businessObjects.filter((bo) => bo.$type.endsWith("Task"));
    const gateways = businessObjects.filter((bo) => /Gateway$/.test(bo.$type));
    const participants = businessObjects.filter((bo) => bo.$type === "bpmn:Participant");
    const connected = (element, direction) => (element[direction] || [])
      .filter((flow) => flow.businessObject?.$type === "bpmn:SequenceFlow");

    if (starts.length !== 1) {
      add(null, "RULE-1", `Процесс должен содержать ровно одно стартовое событие. Найдено: ${starts.length}.`);
    }
    if (ends.length < 1) {
      add(null, "RULE-1", "Процесс должен содержать как минимум одно конечное событие.");
    }

    for (const element of elements) {
      const bo = element.businessObject;
      if (tasks.includes(bo)) {
        if (connected(element, "incoming").length === 0) {
          add(bo, "RULE-2", `Задача «${bo.name || bo.id}» не имеет входящего потока.`);
        }
        if (connected(element, "outgoing").length === 0) {
          add(bo, "RULE-2", `Задача «${bo.name || bo.id}» не имеет исходящего потока.`);
        }
        if (!bo.name?.trim()) {
          add(bo, "RULE-4", `У задачи ${bo.id} не заполнено название.`);
        }
        if (bo.$type === "bpmn:ServiceTask" && !bo.documentation?.some((item) => item.text?.trim())) {
          add(bo, "RULE-5", `Сервисная задача «${bo.name || bo.id}» не задокументирована.`);
        }
      }

      if (gateways.includes(bo)) {
        const incoming = connected(element, "incoming");
        const outgoing = connected(element, "outgoing");
        if (incoming.length === 0) add(bo, "RULE-2", `Шлюз ${bo.id} не имеет входящего потока.`);
        if (outgoing.length === 0) add(bo, "RULE-2", `Шлюз ${bo.id} не имеет исходящего потока.`);
        if (bo.$type === "bpmn:ExclusiveGateway" && outgoing.length > 1) {
          for (const flow of outgoing) {
            const flowBo = flow.businessObject;
            if (!flowBo.conditionExpression && bo.default !== flowBo) {
              add(bo, "RULE-6", `Исходящий поток «${flowBo.name || flowBo.id}» должен иметь условие или быть веткой по умолчанию.`);
            }
          }
        }
      }
    }

    for (const participant of participants) {
      if (!participant.name?.trim()) {
        add(participant, "RULE-3", `У пула ${participant.id} не заполнено название.`);
      }
    }

    const diverging = gateways.filter((gateway) => {
      const element = registry.get(gateway.id);
      return connected(element, "outgoing").length > 1;
    }).length;
    const converging = gateways.filter((gateway) => {
      const element = registry.get(gateway.id);
      return connected(element, "incoming").length > 1;
    }).length;
    if (diverging > 0 && converging === 0 && ends.length <= 1) {
      add(null, "RULE-7", "Есть ветвление, но не найден сходящийся шлюз или несколько конечных событий.");
    }

    return { errors, counts: { starts: starts.length, ends: ends.length, tasks: tasks.length, gateways: gateways.length, flows: sequenceFlows.length } };
  }

  window.BpmnValidation = Object.freeze({ validate });
})();