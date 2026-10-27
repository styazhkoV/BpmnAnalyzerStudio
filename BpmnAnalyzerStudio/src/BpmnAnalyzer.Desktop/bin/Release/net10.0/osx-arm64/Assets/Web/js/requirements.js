(() => {
  function generate(modeler, documentType) {
    const objects = modeler.get("elementRegistry").getAll()
      .filter((element) => element.businessObject && !element.labelTarget)
      .map((element) => element.businessObject);
    const participants = objects.filter((bo) => bo.$type === "bpmn:Participant");
    const tasks = objects.filter((bo) => /Task$/.test(bo.$type));
    const gateways = objects.filter((bo) => /Gateway$/.test(bo.$type));
    const starts = objects.filter((bo) => bo.$type === "bpmn:StartEvent");
    const ends = objects.filter((bo) => bo.$type === "bpmn:EndEvent");
    const process = objects.find((bo) => bo.$type === "bpmn:Process");
    const title = process?.name?.trim() || "Описание бизнес-процесса";
    const lines = [`# ${title}`, "", `Сформировано: ${new Date().toLocaleString("ru-RU")}`, ""];

    if (documentType === "notes") {
      lines.push("## Заметки", "", "### Участники процесса", "");
      lines.push(...(participants.length ? participants.map((item) => `- ${item.name || item.id}`) : ["- Пулы не заданы."]));
      lines.push("", "### Задачи", "");
      lines.push(...(tasks.length ? tasks.map((item) => `- ${item.name || item.id}`) : ["- Задачи не заданы."]));
      return lines.join("\n");
    }

    if (documentType === "requirements") {
      lines.push("## Требования", "");
      lines.push(...tasks.map((task, index) => `${index + 1}. Система должна поддерживать выполнение процесса «${task.name || task.id}».`));
      if (!tasks.length) lines.push("1. Добавьте задачи на BPMN-схему, чтобы сформировать требования.");
      return lines.join("\n");
    }

    lines.push("## Цель и границы", "", "Процесс описывает последовательность действий и условий, представленных на BPMN-схеме.", "");
    lines.push("## Участники", "");
    lines.push(...(participants.length ? participants.map((item) => `- ${item.name || item.id}`) : ["- Участники на схеме не заданы."]));
    lines.push("", "## Основной сценарий", "");
    if (starts.length) lines.push("1. Процесс начинается с события «" + (starts[0].name || "Старт") + "».");
    tasks.forEach((task, index) => lines.push(`${index + 1}. Выполняется действие «${task.name || "Задача без названия"}».`));
    gateways.forEach((gateway) => lines.push(`- На шлюзе «${gateway.name || gateway.id}» выбирается дальнейшая ветвь процесса.`));
    if (ends.length) lines.push(`${tasks.length + 1}. Процесс завершается событием «${ends[0].name || "Завершение"}».`);
    if (!starts.length && !tasks.length && !gateways.length && !ends.length) {
      lines.push("Добавьте элементы на BPMN-схему, чтобы заполнить сценарий.");
    }
    lines.push("", "## События завершения", "");
    lines.push(...(ends.length ? ends.map((item) => `- ${item.name || item.id}`) : ["- Конечные события не заданы."]));
    return lines.join("\n");
  }

  window.BpmnRequirements = Object.freeze({ generate });
})();