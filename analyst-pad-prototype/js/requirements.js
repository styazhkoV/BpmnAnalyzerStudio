/**
 * Requirements Extractor
 * Собирает данные из BPMN и формирует структурированное ТЗ / список требований.
 */

const RequirementsExtractor = (() => {

  function getName(el) {
    return (el.businessObject && el.businessObject.name) || el.name || '';
  }

  function getType(el) {
    return el.type || (el.businessObject && el.businessObject.$type) || '';
  }

  function getId(el) {
    return el.id || (el.businessObject && el.businessObject.id) || '';
  }

  function getDocumentation(el) {
    const docs = el.businessObject && el.businessObject.documentation;
    if (!docs || !docs.length) return '';
    return docs.map(d => d.text || '').join('\n').trim();
  }

  /**
   * Извлекает структурированные данные из модели
   */
  function extract(modeler) {
    const elementRegistry = modeler.get('elementRegistry');
    const elements = elementRegistry.getAll();

    const participants = elements
      .filter(e => getType(e) === 'bpmn:Participant')
      .map(p => ({
        id: getId(p),
        name: getName(p) || 'Без названия',
        documentation: getDocumentation(p)
      }));

    const tasks = elements
      .filter(e => {
        const t = getType(e);
        return t.includes('Task') || t === 'bpmn:SubProcess' || t === 'bpmn:CallActivity';
      })
      .map(t => ({
        id: getId(t),
        name: getName(t) || 'Без названия',
        type: getType(t).replace('bpmn:', ''),
        documentation: getDocumentation(t),
        incoming: (t.incoming || []).length,
        outgoing: (t.outgoing || []).length
      }));

    const gateways = elements
      .filter(e => getType(e).includes('Gateway'))
      .map(g => ({
        id: getId(g),
        name: getName(g) || 'Без названия',
        type: getType(g).replace('bpmn:', ''),
        outgoing: (g.outgoing || []).map(flow => ({
          id: getId(flow),
          name: getName(flow) || '',
          target: flow.target ? getName(flow.target) || getId(flow.target) : '?'
        }))
      }));

    const events = elements
      .filter(e => getType(e).includes('Event'))
      .map(ev => ({
        id: getId(ev),
        name: getName(ev) || 'Без названия',
        type: getType(ev).replace('bpmn:', ''),
        documentation: getDocumentation(ev)
      }));

    const flows = elements
      .filter(e => getType(e) === 'bpmn:SequenceFlow')
      .map(f => ({
        id: getId(f),
        name: getName(f) || '',
        source: f.source ? getName(f.source) || getId(f.source) : '?',
        target: f.target ? getName(f.target) || getId(f.target) : '?'
      }));

    return { participants, tasks, gateways, events, flows };
  }

  /**
   * Генерирует Markdown ТЗ
   */
  function generateTZ(data, issues = []) {
    const now = new Date().toLocaleString('ru-RU');
    let md = '';

    md += `# Техническое задание\n`;
    md += `*Сгенерировано из BPMN-схемы — ${now}*\n\n`;
    md += `---\n\n`;

    // 1. Общее описание
    md += `## 1. Общее описание процесса\n\n`;
    if (data.participants.length) {
      md += `Процесс затрагивает следующие роли / системы:\n\n`;
      data.participants.forEach((p, i) => {
        md += `${i + 1}. **${p.name}**`;
        if (p.documentation) md += ` — ${p.documentation}`;
        md += `\n`;
      });
      md += `\n`;
    } else {
      md += `*Пулы не заданы. Рекомендуется добавить Participant для каждой роли/системы.*\n\n`;
    }

    // 2. Участники
    md += `## 2. Участники (Pools / Lanes)\n\n`;
    if (data.participants.length) {
      data.participants.forEach(p => {
        md += `### ${p.name}\n`;
        md += `- ID: \`${p.id}\`\n`;
        if (p.documentation) md += `- Описание: ${p.documentation}\n`;
        md += `\n`;
      });
    } else {
      md += `*Не заданы.*\n\n`;
    }

    // 3. События
    md += `## 3. События\n\n`;
    const starts = data.events.filter(e => e.type.includes('Start'));
    const ends = data.events.filter(e => e.type.includes('End'));
    const intermediate = data.events.filter(e => !e.type.includes('Start') && !e.type.includes('End'));

    md += `### Старт\n`;
    if (starts.length) {
      starts.forEach(e => {
        md += `- **${e.name}** (\`${e.type}\`)`;
        if (e.documentation) md += `\n  ${e.documentation}`;
        else md += `\n  *описание не заполнено*`;
        md += `\n`;
      });
    } else {
      md += `*Стартовое событие отсутствует*\n`;
    }
    md += `\n### Завершение\n`;
    if (ends.length) {
      ends.forEach(e => {
        md += `- **${e.name}** (\`${e.type}\`)`;
        if (e.documentation) md += `\n  ${e.documentation}`;
        else md += `\n  *описание не заполнено*`;
        md += `\n`;
      });
    } else {
      md += `*Конечное событие отсутствует*\n`;
    }
    if (intermediate.length) {
      md += `\n### Промежуточные\n`;
      intermediate.forEach(e => {
        md += `- **${e.name}** (\`${e.type}\`)`;
        if (e.documentation) md += `\n  ${e.documentation}`;
        else md += `\n  *описание не заполнено*`;
        md += `\n`;
      });
    }
    md += `\n`;

    // 4. Задачи / требования
    md += `## 4. Функциональные требования (задачи)\n\n`;
    if (data.tasks.length) {
      data.tasks.forEach((t, i) => {
        md += `### ТЗ-${String(i + 1).padStart(3, '0')}: ${t.name}\n`;
        md += `- **Тип**: ${t.type}\n`;
        md += `- **ID**: \`${t.id}\`\n`;
        if (t.documentation) {
          md += `- **Описание**:\n  ${t.documentation.replace(/\n/g, '\n  ')}\n`;
        } else {
          md += `- **Описание**: *не заполнено — требуется уточнение*\n`;
        }
        md += `- Входящих связей: ${t.incoming}, исходящих: ${t.outgoing}\n\n`;
      });
    } else {
      md += `*Задачи не найдены.*\n\n`;
    }

    // 5. Шлюзы и ветвления
    md += `## 5. Бизнес-правила и ветвления (шлюзы)\n\n`;
    if (data.gateways.length) {
      data.gateways.forEach((g, i) => {
        md += `### Шлюз ${i + 1}: ${g.name}\n`;
        md += `- Тип: ${g.type}\n`;
        if (g.outgoing.length) {
          md += `- Варианты:\n`;
          g.outgoing.forEach(o => {
            const cond = o.name ? `«${o.name}»` : '*условие не задано*';
            md += `  - ${cond} → ${o.target}\n`;
          });
        }
        md += `\n`;
      });
    } else {
      md += `*Шлюзы отсутствуют (линейный процесс).*\n\n`;
    }

    // 6. Поток
    md += `## 6. Последовательность выполнения\n\n`;
    if (data.flows.length) {
      data.flows.forEach(f => {
        const label = f.name ? ` [${f.name}]` : '';
        md += `- ${f.source} →${label} ${f.target}\n`;
      });
      md += `\n`;
    } else {
      md += `*Связи не заданы.*\n\n`;
    }

    // 7. Проблемы валидации
    if (issues.length) {
      md += `## 7. Замечания по качеству схемы\n\n`;
      const errors = issues.filter(i => i.level === 'error');
      const warnings = issues.filter(i => i.level === 'warning');
      if (errors.length) {
        md += `### Критические ошибки (${errors.length})\n`;
        errors.forEach(i => md += `- [ ] ${i.message} (${i.elementName})\n`);
        md += `\n`;
      }
      if (warnings.length) {
        md += `### Предупреждения (${warnings.length})\n`;
        warnings.forEach(i => md += `- [ ] ${i.message} (${i.elementName})\n`);
        md += `\n`;
      }
    }

    md += `---\n`;
    md += `*Документ сформирован автоматически модулем AnalystPad. Требуется ревью аналитиком.*\n`;

    return md;
  }

  /**
   * Генерирует короткий список требований
   */
  function generateRequirementsList(data) {
    let md = `# Список требований (из BPMN)\n\n`;
    data.tasks.forEach((t, i) => {
      md += `${i + 1}. **${t.name}** (${t.type})\n`;
      if (t.documentation) md += `   ${t.documentation}\n`;
      md += `\n`;
    });
    return md;
  }

  return { extract, generateTZ, generateRequirementsList };
})();
