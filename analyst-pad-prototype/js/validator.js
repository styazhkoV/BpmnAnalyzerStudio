/**
 * BPMN Validator (строгий режим для бизнес- и системных аналитиков)
 *
 * Правила ориентированы на подготовку качественного ТЗ:
 * - у каждой задачи должно быть понятное название и описание требования
 * - UserTask / ServiceTask имеют повышенные требования
 * - шлюзы должны иметь именованные/условные ветки
 * - связи и структура процесса проверяются жёстче
 */

const Validator = (() => {

  // ---------- Конфигурация правил ----------
  const TASK_TYPES = [
    'bpmn:Task',
    'bpmn:UserTask',
    'bpmn:ServiceTask',
    'bpmn:ScriptTask',
    'bpmn:BusinessRuleTask',
    'bpmn:ManualTask',
    'bpmn:SendTask',
    'bpmn:ReceiveTask'
  ];

  const GATEWAY_TYPES = [
    'bpmn:ExclusiveGateway',
    'bpmn:InclusiveGateway',
    'bpmn:ParallelGateway',
    'bpmn:ComplexGateway',
    'bpmn:EventBasedGateway'
  ];

  // Типы, для которых название обязательно
  const REQUIRE_NAME = [
    ...TASK_TYPES,
    ...GATEWAY_TYPES,
    'bpmn:StartEvent',
    'bpmn:EndEvent',
    'bpmn:IntermediateThrowEvent',
    'bpmn:IntermediateCatchEvent',
    'bpmn:BoundaryEvent',
    'bpmn:Participant',
    'bpmn:Lane',
    'bpmn:SubProcess',
    'bpmn:CallActivity'
  ];

  // Типы, для которых описание (documentation) обязательно
  const REQUIRE_DOCUMENTATION = [
    'bpmn:UserTask',
    'bpmn:ServiceTask',
    'bpmn:ScriptTask',
    'bpmn:BusinessRuleTask',
    'bpmn:ManualTask',
    'bpmn:SendTask',
    'bpmn:ReceiveTask',
    'bpmn:SubProcess',
    'bpmn:CallActivity',
    // События
    'bpmn:StartEvent',
    'bpmn:EndEvent',
    'bpmn:IntermediateThrowEvent',
    'bpmn:IntermediateCatchEvent',
    'bpmn:BoundaryEvent'
  ];

  // Минимальная длина описания (символов)
  const MIN_DOC_LENGTH = 15;

  // ---------- Хелперы ----------
  function getName(el) {
    return ((el.businessObject && el.businessObject.name) || el.name || '').trim();
  }

  function getType(el) {
    return el.type || (el.businessObject && el.businessObject.$type) || '';
  }

  function getId(el) {
    return el.id || (el.businessObject && el.businessObject.id) || '?';
  }

  function getDocumentation(el) {
    const docs = el.businessObject && el.businessObject.documentation;
    if (!docs || !docs.length) return '';
    return docs.map(d => (d.text || '').trim()).filter(Boolean).join('\n');
  }

  function shortType(type) {
    return (type || '').replace('bpmn:', '');
  }

  function issue(level, message, el, extraName) {
    return {
      level,
      message,
      elementId: el ? getId(el) : '',
      elementName: extraName || (el ? (getName(el) || getId(el)) : 'Схема')
    };
  }

  // ---------- Основные проверки ----------

  function checkProcessStructure(elements, issues) {
    const participants = elements.filter(e => getType(e) === 'bpmn:Participant');
    const processes = elements.filter(e => getType(e) === 'bpmn:Process');
    const startEvents = elements.filter(e => getType(e) === 'bpmn:StartEvent');
    const endEvents = elements.filter(e => getType(e) === 'bpmn:EndEvent');
    const tasks = elements.filter(e => TASK_TYPES.includes(getType(e)));

    if (participants.length === 0 && processes.length === 0) {
      issues.push(issue('error', 'Схема не содержит ни одного пула (Participant) или процесса.'));
    }

    if (startEvents.length === 0) {
      issues.push(issue('error', 'Отсутствует стартовое событие (Start Event). Без него процесс нельзя начать.'));
    }
    if (endEvents.length === 0) {
      issues.push(issue('error', 'Отсутствует конечное событие (End Event). Процесс должен иметь точку завершения.'));
    }

    // Для аналитического ТЗ желательно наличие хотя бы одной осмысленной задачи
    if (tasks.length === 0) {
      issues.push(issue('warning', 'В схеме нет ни одной задачи (UserTask / ServiceTask и т.д.). ТЗ будет пустым.'));
    }

    // Пулы без названия
    participants.forEach(p => {
      if (!getName(p)) {
        issues.push(issue('error', 'Пул (Participant) обязан иметь название — роль или система.', p));
      }
    });

    // Пулы без содержимого
    participants.forEach(p => {
      const children = elements.filter(e => e.parent === p || (e.businessObject && e.businessObject.$parent === p.businessObject));
      // Простая эвристика: если у пула нет дочерних shape-элементов кроме самого process
      const hasMeaningful = elements.some(e => {
        const t = getType(e);
        return (TASK_TYPES.includes(t) || GATEWAY_TYPES.includes(t) || t.includes('Event')) &&
               e.parent && (e.parent === p || getId(e.parent) === getId(p));
      });
      // Более надёжно через businessObject
      const bo = p.businessObject;
      if (bo && bo.processRef) {
        // есть ссылка на процесс — ок
      }
    });
  }

  function checkNames(elements, issues) {
    elements.forEach(el => {
      const type = getType(el);
      if (!REQUIRE_NAME.includes(type)) return;

      if (!getName(el)) {
        issues.push(issue(
          'error',
          `«${shortType(type)}» не имеет названия. Для ТЗ название обязательно.`,
          el
        ));
      }
    });
  }

  function checkDocumentation(elements, issues) {
    elements.forEach(el => {
      const type = getType(el);
      if (!REQUIRE_DOCUMENTATION.includes(type)) return;

      const docs = getDocumentation(el);
      const name = getName(el) || getId(el);

      if (!docs) {
        let hint = 'Добавьте описание требования.';
        if (type === 'bpmn:UserTask') {
          hint = 'Укажите, что делает пользователь, кто исполнитель и какой результат ожидается.';
        } else if (type === 'bpmn:ServiceTask') {
          hint = 'Укажите вызываемую систему/сервис, входные/выходные данные и назначение.';
        } else if (type === 'bpmn:BusinessRuleTask') {
          hint = 'Укажите правило или ссылку на регламент/таблицу решений.';
        } else if (type === 'bpmn:ScriptTask') {
          hint = 'Кратко опишите назначение скрипта и что он вычисляет.';
        } else if (type === 'bpmn:SendTask' || type === 'bpmn:ReceiveTask') {
          hint = 'Опишите сообщение, канал и ожидаемый контракт.';
        } else if (type === 'bpmn:StartEvent') {
          hint = 'Опишите, что инициирует процесс (триггер, условие старта).';
        } else if (type === 'bpmn:EndEvent') {
          hint = 'Опишите результат завершения процесса или ветки.';
        } else if (type.includes('Intermediate') || type === 'bpmn:BoundaryEvent') {
          hint = 'Опишите смысл события (таймер, сообщение, ошибка, условие и т.д.).';
        }

        issues.push(issue(
          'error',
          `«${shortType(type)}» «${name}» не имеет описания (documentation). ${hint}`,
          el
        ));
      } else if (docs.length < MIN_DOC_LENGTH) {
        issues.push(issue(
          'warning',
          `Описание «${name}» слишком короткое (${docs.length} симв.). Рекомендуется ≥ ${MIN_DOC_LENGTH} символов для понятного ТЗ.`,
          el
        ));
      }
    });
  }

  /**
   * Проверка наличия связей у КАЖДОГО элемента потока управления.
   * Правила:
   * - StartEvent          → обязана ≥ 1 исходящая, входящих быть не должно
   * - EndEvent            → обязана ≥ 1 входящая,  исходящих быть не должно
   * - Intermediate Event  → обязана ≥ 1 входящая и ≥ 1 исходящая
   * - BoundaryEvent       → исходящая обязательна (входящая — от activity)
   * - Task / SubProcess / CallActivity → обязана ≥ 1 входящая и ≥ 1 исходящая
   * - Gateway             → входящие и исходящие (детально проверяется в checkGateways)
   * - Любой flow-node без связей вообще → ошибка «изолированный элемент»
   */
  function checkAllConnectivity(elements, issues) {
    const FLOW_NODE_TYPES = new Set([
      ...TASK_TYPES,
      ...GATEWAY_TYPES,
      'bpmn:StartEvent',
      'bpmn:EndEvent',
      'bpmn:IntermediateThrowEvent',
      'bpmn:IntermediateCatchEvent',
      'bpmn:BoundaryEvent',
      'bpmn:SubProcess',
      'bpmn:CallActivity'
    ]);

    elements.forEach(el => {
      const type = getType(el);
      if (!FLOW_NODE_TYPES.has(type)) return;

      // Пропускаем label и служебные shape
      if (el.labelTarget) return;

      const incoming = el.incoming || [];
      const outgoing = el.outgoing || [];
      const inCount = incoming.length;
      const outCount = outgoing.length;
      const name = getName(el) || getId(el);
      const st = shortType(type);

      // --- Полностью изолированный элемент ---
      if (inCount === 0 && outCount === 0) {
        // BoundaryEvent крепится к activity, у него может не быть classical incoming
        if (type === 'bpmn:BoundaryEvent') {
          issues.push(issue(
            'error',
            `BoundaryEvent «${name}» не имеет исходящей связи. Укажите, куда переходить при срабатывании.`,
            el
          ));
        } else {
          issues.push(issue(
            'error',
            `Элемент «${st}» «${name}» не имеет ни входящих, ни исходящих связей (изолирован).`,
            el
          ));
        }
        return;
      }

      // --- StartEvent ---
      if (type === 'bpmn:StartEvent') {
        if (outCount === 0) {
          issues.push(issue(
            'error',
            `Стартовое событие «${name}» не имеет исходящей связи. Процесс некуда продолжать.`,
            el
          ));
        }
        if (inCount > 0) {
          issues.push(issue(
            'warning',
            `Стартовое событие «${name}» имеет входящие связи. Обычно Start Event — точка входа без входов.`,
            el
          ));
        }
        return;
      }

      // --- EndEvent ---
      if (type === 'bpmn:EndEvent') {
        if (inCount === 0) {
          issues.push(issue(
            'error',
            `Конечное событие «${name}» не имеет входящей связи. До него невозможно дойти.`,
            el
          ));
        }
        if (outCount > 0) {
          issues.push(issue(
            'warning',
            `Конечное событие «${name}» имеет исходящие связи. Обычно End Event — точка выхода без выходов.`,
            el
          ));
        }
        return;
      }

      // --- BoundaryEvent ---
      if (type === 'bpmn:BoundaryEvent') {
        if (outCount === 0) {
          issues.push(issue(
            'error',
            `BoundaryEvent «${name}» не имеет исходящей связи.`,
            el
          ));
        }
        return;
      }

      // --- Intermediate Events ---
      if (type.includes('Intermediate')) {
        if (inCount === 0) {
          issues.push(issue(
            'error',
            `Промежуточное событие «${name}» (${st}) не имеет входящей связи — недостижимо.`,
            el
          ));
        }
        if (outCount === 0) {
          issues.push(issue(
            'error',
            `Промежуточное событие «${name}» (${st}) не имеет исходящей связи — процесс застревает.`,
            el
          ));
        }
        return;
      }

      // --- Tasks, SubProcess, CallActivity ---
      if (TASK_TYPES.includes(type) || type === 'bpmn:SubProcess' || type === 'bpmn:CallActivity') {
        if (inCount === 0) {
          issues.push(issue(
            'error',
            `«${st}» «${name}» не имеет входящих связей. Элемент недостижим.`,
            el
          ));
        }
        if (outCount === 0) {
          issues.push(issue(
            'error',
            `«${st}» «${name}» не имеет исходящих связей. Процесс застревает.`,
            el
          ));
        }
        return;
      }

      // --- Gateways (базовая проверка; детальная — в checkGateways) ---
      if (GATEWAY_TYPES.includes(type)) {
        if (inCount === 0 && outCount === 0) {
          issues.push(issue(
            'error',
            `Шлюз «${name}» полностью изолирован (нет связей).`,
            el
          ));
        }
      }
    });
  }

  function checkUserTaskSpecific(elements, issues) {
    elements
      .filter(e => getType(e) === 'bpmn:UserTask')
      .forEach(el => {
        const docs = getDocumentation(el).toLowerCase();
        const name = getName(el) || getId(el);

        // Рекомендация: в описании желательно указать роль / исполнителя
        const roleHints = ['роль', 'исполнитель', 'пользователь', 'менеджер', 'оператор',
                           'аналитик', 'администратор', 'клиент', 'сотрудник', 'assignee', 'role'];
        const hasRoleHint = roleHints.some(h => docs.includes(h));

        if (docs && !hasRoleHint) {
          issues.push(issue(
            'warning',
            `UserTask «${name}»: в описании не указана роль/исполнитель. Добавьте, кто выполняет задачу.`,
            el
          ));
        }
      });
  }

  function checkServiceTaskSpecific(elements, issues) {
    elements
      .filter(e => getType(e) === 'bpmn:ServiceTask')
      .forEach(el => {
        const docs = getDocumentation(el).toLowerCase();
        const name = getName(el) || getId(el);

        const systemHints = ['система', 'сервис', 'api', ' entрация', 'endpoint',
                             'микросервис', 'crm', 'erp', 'база', 'service', 'system'];
        const hasSystemHint = systemHints.some(h => docs.includes(h));

        if (docs && !hasSystemHint) {
          issues.push(issue(
            'warning',
            `ServiceTask «${name}»: в описании не указана вызываемая система/сервис. Укажите интеграцию.`,
            el
          ));
        }
      });
  }

  function checkGateways(elements, issues) {
    elements.forEach(el => {
      const type = getType(el);
      if (!GATEWAY_TYPES.includes(type)) return;

      const outgoing = el.outgoing || [];
      const incoming = el.incoming || [];
      const name = getName(el) || getId(el);
      const isParallel = type === 'bpmn:ParallelGateway';
      const isExclusiveOrInclusive = type === 'bpmn:ExclusiveGateway' || type === 'bpmn:InclusiveGateway';

      if (incoming.length < 1) {
        issues.push(issue('error', `Шлюз «${name}» не имеет входящих связей.`, el));
      }

      if (!isParallel && outgoing.length < 2) {
        issues.push(issue(
          'error',
          `Шлюз «${name}» (${shortType(type)}) имеет ${outgoing.length} исходящую(их) связь(ей). Для ветвления нужно ≥ 2.`,
          el
        ));
      }

      if (isParallel && outgoing.length < 2) {
        issues.push(issue(
          'warning',
          `Parallel Gateway «${name}» имеет меньше 2 исходящих связей — параллельное ветвление не имеет смысла.`,
          el
        ));
      }

      // Для Exclusive / Inclusive — каждая исходящая ветка должна быть подписана
      if (isExclusiveOrInclusive) {
        outgoing.forEach(flow => {
          const flowName = getName(flow);
          const condition = flow.businessObject && flow.businessObject.conditionExpression;
          if (!flowName && !condition) {
            issues.push(issue(
              'error',
              `Исходящая ветка из шлюза «${name}» не имеет ни названия, ни условия. Аналитик и разработчик не поймут, когда идти по этой ветке.`,
              flow,
              `ветка → ${flow.target ? (getName(flow.target) || getId(flow.target)) : '?'}`
            ));
          }
        });
      }
    });
  }

  function checkSequenceFlows(elements, issues) {
    elements.forEach(el => {
      if (getType(el) !== 'bpmn:SequenceFlow') return;

      if (!el.source || !el.target) {
        issues.push(issue('error', 'Связь (SequenceFlow) не подключена с одной из сторон.', el));
      }
    });
  }

  function checkEvents(elements, issues) {
    elements.forEach(el => {
      const type = getType(el);
      if (!type.includes('Event')) return;

      const name = getName(el);
      // Промежуточные и граничные события почти всегда должны иметь имя
      if ((type.includes('Intermediate') || type.includes('Boundary')) && !name) {
        issues.push(issue(
          'warning',
          `Событие «${shortType(type)}» без названия. Рекомендуется подписать (таймер, сообщение, ошибка и т.д.).`,
          el
        ));
      }
    });
  }

  // ---------- Публичный API ----------
  /**
   * @param {Object} modeler - экземпляр bpmn-js Modeler
   * @returns {Array<{level:'error'|'warning', message:string, elementId:string, elementName:string}>}
   */
  function validate(modeler) {
    const issues = [];
    const elementRegistry = modeler.get('elementRegistry');
    const elements = elementRegistry.getAll();

    checkProcessStructure(elements, issues);
    checkNames(elements, issues);
    checkDocumentation(elements, issues);
    checkAllConnectivity(elements, issues);   // связи у каждого элемента
    checkUserTaskSpecific(elements, issues);
    checkServiceTaskSpecific(elements, issues);
    checkGateways(elements, issues);
    checkSequenceFlows(elements, issues);
    checkEvents(elements, issues);

    // Сортировка: сначала ошибки, потом предупреждения
    issues.sort((a, b) => {
      if (a.level === b.level) return 0;
      return a.level === 'error' ? -1 : 1;
    });

    return issues;
  }

  return { validate };
})();
