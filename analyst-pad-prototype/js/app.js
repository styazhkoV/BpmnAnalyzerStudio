/**
 * AnalystPad — главный модуль
 */

(function () {
  'use strict';

  let modeler = null;
  let currentElement = null;
  /** @type {string|null} */
  let currentProjectId = null;
  /** @type {string} */
  let currentProjectName = '';

  // ---------- Инициализация BPMN ----------
  function initModeler() {
    modeler = new BpmnJS({
      container: '#canvas',
      keyboard: { bindTo: document }
    });

    // Слушаем выделение
    modeler.on('selection.changed', (e) => {
      const el = e.newSelection[0];
      currentElement = el || null;
      renderProperties(el);
    });

    // Новая пустая диаграмма
    createNewDiagram();
  }

  async function createNewDiagram() {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Начало"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="173" y="203" width="50" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    try {
      await modeler.importXML(emptyXml);
      modeler.get('canvas').zoom('fit-viewport');
      clearMarkers();
      if (typeof stopAnimation === 'function') stopAnimation();
      // сбрасываем список валидации
      const list = document.getElementById('validation-list');
      const summary = document.getElementById('validation-summary');
      if (list) list.innerHTML = '<p class="empty">Нажмите «Проверить схему», чтобы увидеть ошибки и предупреждения.</p>';
      if (summary) { summary.textContent = '—'; summary.className = 'badge'; }
    } catch (err) {
      console.error('Ошибка загрузки диаграммы', err);
    }
  }

  // ---------- Properties panel (простой) ----------
  function renderProperties(el) {
    const container = document.getElementById('props-content');
    if (!el) {
      container.innerHTML = '<p class="muted">Выберите элемент на схеме</p>';
      return;
    }

    const bo = el.businessObject;
    const name = bo.name || '';
    const id = el.id;
    const type = el.type.replace('bpmn:', '');
    const docs = (bo.documentation && bo.documentation[0] && bo.documentation[0].text) || '';

    // Подсказки по типу элемента
    const docRequiredTypes = [
      'UserTask', 'ServiceTask', 'ScriptTask', 'BusinessRuleTask',
      'ManualTask', 'SendTask', 'ReceiveTask', 'SubProcess', 'CallActivity',
      'StartEvent', 'EndEvent', 'IntermediateThrowEvent', 'IntermediateCatchEvent', 'BoundaryEvent'
    ];
    const isDocRequired = docRequiredTypes.includes(type);

    let docPlaceholder = 'Опишите, что должно происходить...';
    let docHint = '';
    if (type === 'UserTask') {
      docPlaceholder = 'Что делает пользователь? Кто исполнитель (роль)? Какой результат?';
      docHint = 'Обязательно: роль исполнителя + действие + ожидаемый результат';
    } else if (type === 'ServiceTask') {
      docPlaceholder = 'Какая система/сервис вызывается? Входные и выходные данные?';
      docHint = 'Обязательно: система/API + назначение интеграции';
    } else if (type === 'BusinessRuleTask') {
      docPlaceholder = 'Какое бизнес-правило или таблица решений применяется?';
      docHint = 'Укажите правило или ссылку на регламент';
    } else if (type === 'ScriptTask') {
      docPlaceholder = 'Что вычисляет/делает скрипт?';
      docHint = 'Кратко опишите назначение скрипта';
    } else if (type === 'SendTask' || type === 'ReceiveTask') {
      docPlaceholder = 'Сообщение, канал, контракт обмена...';
      docHint = 'Опишите сообщение и ожидаемый контракт';
    } else if (type === 'StartEvent') {
      docPlaceholder = 'Что инициирует процесс? Триггер, условие старта...';
      docHint = 'Обязательно: опишите триггер или условие начала процесса';
    } else if (type === 'EndEvent') {
      docPlaceholder = 'Какой результат завершения процесса или ветки?';
      docHint = 'Обязательно: опишите итог завершения';
    } else if (type.includes('Intermediate') || type === 'BoundaryEvent') {
      docPlaceholder = 'Смысл события: таймер, сообщение, ошибка, условие...';
      docHint = 'Обязательно: опишите тип и смысл события';
    } else if (isDocRequired) {
      docHint = 'Описание обязательно для генерации качественного ТЗ';
    }

    container.innerHTML = `
      <div class="prop-group">
        <label>Тип</label>
        <input type="text" value="${type}" readonly />
      </div>
      <div class="prop-group">
        <label>ID</label>
        <input type="text" value="${id}" readonly />
      </div>
      <div class="prop-group">
        <label>Название *</label>
        <input type="text" id="prop-name" value="${escapeHtml(name)}" placeholder="Обязательно заполнить" />
      </div>
      <div class="prop-group">
        <label>Описание / требование ${isDocRequired ? '*' : ''}</label>
        <textarea id="prop-docs" placeholder="${escapeHtml(docPlaceholder)}">${escapeHtml(docs)}</textarea>
        ${docHint ? `<p class="muted" style="margin-top:4px;font-size:0.75rem">${escapeHtml(docHint)}</p>` : ''}
      </div>
      <button class="btn primary" id="btn-save-props" style="width:100%;margin-top:8px">Сохранить</button>
    `;

    document.getElementById('btn-save-props').onclick = () => {
      const newName = document.getElementById('prop-name').value.trim();
      const newDocs = document.getElementById('prop-docs').value.trim();

      const modeling = modeler.get('modeling');
      modeling.updateProperties(el, { name: newName || undefined });

      const moddle = modeler.get('moddle');
      if (newDocs) {
        const doc = moddle.create('bpmn:Documentation', { text: newDocs });
        modeling.updateProperties(el, { documentation: [doc] });
      } else {
        modeling.updateProperties(el, { documentation: undefined });
      }
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Валидация + подсветка ----------
  const MARKER_ERROR = 'ap-error';
  const MARKER_WARN  = 'ap-warning';

  function clearMarkers() {
    if (!modeler) return;
    const canvas = modeler.get('canvas');
    const elementRegistry = modeler.get('elementRegistry');
    elementRegistry.getAll().forEach(el => {
      canvas.removeMarker(el.id, MARKER_ERROR);
      canvas.removeMarker(el.id, MARKER_WARN);
    });
  }

  function applyMarkers(issues) {
    if (!modeler) return;
    clearMarkers();
    const canvas = modeler.get('canvas');
    const elementRegistry = modeler.get('elementRegistry');

    // Группируем: ошибка важнее предупреждения
    const byId = {};
    issues.forEach(i => {
      if (!i.elementId) return;
      if (!byId[i.elementId] || i.level === 'error') {
        byId[i.elementId] = i.level;
      }
    });

    Object.entries(byId).forEach(([id, level]) => {
      const el = elementRegistry.get(id);
      if (!el) return;
      canvas.addMarker(id, level === 'error' ? MARKER_ERROR : MARKER_WARN);
    });
  }

  function focusElement(elementId) {
    if (!modeler || !elementId) return;
    const elementRegistry = modeler.get('elementRegistry');
    const canvas = modeler.get('canvas');
    const selection = modeler.get('selection');
    const el = elementRegistry.get(elementId);
    if (!el) return;
    selection.select(el);
    canvas.scrollToElement(el);
    // Переключаемся на вкладку BPMN, чтобы было видно
    switchTab('bpmn');
  }

  function runValidation() {
    if (!modeler) return [];
    const issues = Validator.validate(modeler);
    applyMarkers(issues);
    renderValidation(issues);
    return issues;
  }

  function renderValidation(issues) {
    const list = document.getElementById('validation-list');
    const summary = document.getElementById('validation-summary');

    if (!issues.length) {
      clearMarkers();
      list.innerHTML = '<p class="empty">Ошибок не найдено. Схема выглядит корректно.</p>';
      summary.textContent = 'OK';
      summary.className = 'badge ok';
      return;
    }

    const errors = issues.filter(i => i.level === 'error').length;
    const warnings = issues.filter(i => i.level === 'warning').length;
    summary.textContent = `${errors} ошибок, ${warnings} предупр.`;
    summary.className = 'badge ' + (errors ? 'error' : 'warn');

    list.innerHTML = issues.map((i, idx) => `
      <div class="validation-item ${i.level}${i.elementId ? ' clickable' : ''}" data-element-id="${escapeHtml(i.elementId || '')}" data-idx="${idx}">
        <span class="icon">${i.level === 'error' ? '✕' : '⚠'}</span>
        <div class="msg">
          <div>${escapeHtml(i.message)}</div>
          <div class="elem">${escapeHtml(i.elementName || i.elementId || '')}${i.elementId ? ' · нажмите, чтобы перейти' : ''}</div>
        </div>
      </div>
    `).join('');

    // Клик по замечанию → фокус на элемент на схеме
    list.querySelectorAll('.validation-item.clickable').forEach(node => {
      node.addEventListener('click', () => {
        const id = node.getAttribute('data-element-id');
        if (id) focusElement(id);
      });
    });
  }

  // ---------- Генерация ТЗ ----------
  function generateDocument() {
    const issues = runValidation();
    const data = RequirementsExtractor.extract(modeler);
    const type = document.getElementById('doc-type').value;

    let text;
    if (type === 'requirements') {
      text = RequirementsExtractor.generateRequirementsList(data);
    } else if (type === 'notes') {
      text = document.getElementById('notepad').value; // оставляем как есть
      return;
    } else {
      text = RequirementsExtractor.generateTZ(data, issues);
    }

    document.getElementById('notepad').value = text;
    // Переключаемся на вкладку блокнота
    switchTab('notepad');
  }

  // ---------- Tabs ----------
  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`panel-${tabId}`).classList.add('active');
  }

  // ---------- Export / Import ----------
  async function saveXml() {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      downloadFile(xml, 'diagram.bpmn', 'application/xml');
    } catch (err) {
      alert('Ошибка сохранения: ' + err.message);
    }
  }

  function loadXml(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await modeler.importXML(e.target.result);
        modeler.get('canvas').zoom('fit-viewport');
        clearMarkers();
      } catch (err) {
        alert('Не удалось загрузить файл: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Масштаб и экспорт диаграммы ----------
  function zoomIn() {
    if (!modeler) return;
    const canvas = modeler.get('canvas');
    canvas.zoom(canvas.zoom() * 1.2);
  }

  function zoomOut() {
    if (!modeler) return;
    const canvas = modeler.get('canvas');
    canvas.zoom(canvas.zoom() / 1.2);
  }

  function zoomFit() {
    if (!modeler) return;
    modeler.get('canvas').zoom('fit-viewport', 'auto');
  }

  async function exportSvg() {
    if (!modeler) return;
    try {
      const { svg } = await modeler.saveSVG();
      downloadFile(svg, 'diagram.svg', 'image/svg+xml');
    } catch (err) {
      alert('Не удалось экспортировать SVG: ' + err.message);
    }
  }

  async function exportPng() {
    if (!modeler) return;
    try {
      const { svg } = await modeler.saveSVG();
      // Рисуем SVG на canvas → PNG
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const padding = 24;
        const c = document.createElement('canvas');
        c.width = img.width + padding * 2;
        c.height = img.height + padding * 2;
        const ctx = c.getContext('2d');
        // Тёмный фон как у редактора
        ctx.fillStyle = '#1e2a3a';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, padding, padding);
        c.toBlob((pngBlob) => {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = 'diagram.png';
          a.click();
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert('Не удалось сформировать PNG.');
      };
      img.src = url;
    } catch (err) {
      alert('Не удалось экспортировать PNG: ' + err.message);
    }
  }

  // ---------- Анимация токена по процессу ----------
  let animRunning = false;
  let animTimers = [];
  let tokenDot = null;

  function clearAnimTimers() {
    animTimers.forEach(t => clearTimeout(t));
    animTimers = [];
  }

  function stopAnimation() {
    animRunning = false;
    clearAnimTimers();
    if (!modeler) return;
    const canvas = modeler.get('canvas');
    const registry = modeler.get('elementRegistry');
    registry.getAll().forEach(el => {
      canvas.removeMarker(el.id, 'ap-token-active');
      canvas.removeMarker(el.id, 'ap-token-done');
      canvas.removeMarker(el.id, 'ap-token-flow');
    });
    if (tokenDot) tokenDot.classList.remove('visible');
    const btnPlay = document.getElementById('btn-animate');
    const btnStop = document.getElementById('btn-animate-stop');
    if (btnPlay) btnPlay.style.display = '';
    if (btnStop) btnStop.style.display = 'none';
  }

  function ensureTokenDot() {
    if (tokenDot && tokenDot.parentNode) return tokenDot;
    const canvasEl = document.getElementById('canvas');
    tokenDot = document.createElement('div');
    tokenDot.className = 'ap-token-dot';
    canvasEl.style.position = 'relative';
    canvasEl.appendChild(tokenDot);
    return tokenDot;
  }

  function elementCenter(el) {
    const canvas = modeler.get('canvas');
    const viewbox = canvas.viewbox();
    const gx = el.x + (el.width || 0) / 2;
    const gy = el.y + (el.height || 0) / 2;
    const scale = viewbox.scale || 1;
    return {
      x: (gx - viewbox.x) * scale,
      y: (gy - viewbox.y) * scale
    };
  }

  function moveTokenTo(el, immediate) {
    const dot = ensureTokenDot();
    const pos = elementCenter(el);
    if (immediate) {
      dot.style.transition = 'none';
      dot.style.left = pos.x + 'px';
      dot.style.top = pos.y + 'px';
      void dot.offsetWidth;
      dot.style.transition = 'left 0.45s ease-in-out, top 0.45s ease-in-out';
    } else {
      dot.style.transition = 'left 0.45s ease-in-out, top 0.45s ease-in-out';
      dot.style.left = pos.x + 'px';
      dot.style.top = pos.y + 'px';
    }
    dot.classList.add('visible');
  }

  function buildAnimationPath() {
    const registry = modeler.get('elementRegistry');
    const all = registry.getAll();
    const starts = all.filter(e => e.type === 'bpmn:StartEvent');
    if (!starts.length) return [];

    const path = [];
    let current = starts[0];
    const visited = new Set();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push({ type: 'node', el: current });
      if (current.type === 'bpmn:EndEvent') break;
      const outs = current.outgoing || [];
      if (!outs.length) break;
      const flow = outs[0];
      path.push({ type: 'flow', el: flow });
      current = flow.target;
    }
    return path;
  }

  function startAnimation() {
    if (!modeler || animRunning) return;
    stopAnimation();

    const path = buildAnimationPath();
    if (path.length < 2) {
      alert('Недостаточно элементов для анимации. Добавьте Start → задачи → End и связи между ними.');
      return;
    }

    animRunning = true;
    document.getElementById('btn-animate').style.display = 'none';
    document.getElementById('btn-animate-stop').style.display = '';

    const canvas = modeler.get('canvas');
    const STEP_MS = 700;
    let delay = 0;

    const firstNode = path.find(p => p.type === 'node');
    if (firstNode) moveTokenTo(firstNode.el, true);

    path.forEach((step, index) => {
      const t = setTimeout(() => {
        if (!animRunning) return;

        if (step.type === 'node') {
          path.forEach((s, i) => {
            if (i < index && s.type === 'node') {
              canvas.removeMarker(s.el.id, 'ap-token-active');
              canvas.addMarker(s.el.id, 'ap-token-done');
            }
            if (s.type === 'flow') canvas.removeMarker(s.el.id, 'ap-token-flow');
          });
          canvas.addMarker(step.el.id, 'ap-token-active');
          moveTokenTo(step.el, false);

          if (index === path.length - 1) {
            const endT = setTimeout(() => {
              if (!animRunning) return;
              canvas.removeMarker(step.el.id, 'ap-token-active');
              canvas.addMarker(step.el.id, 'ap-token-done');
              const doneT = setTimeout(() => stopAnimation(), 900);
              animTimers.push(doneT);
            }, STEP_MS);
            animTimers.push(endT);
          }
        } else if (step.type === 'flow') {
          canvas.addMarker(step.el.id, 'ap-token-flow');
        }
      }, delay);
      animTimers.push(t);
      delay += STEP_MS;
    });
  }

  // ---------- Event bindings ----------
  function bindEvents() {
    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Toolbar — файл
    document.getElementById('btn-new').onclick = () => {
      if (confirm('Создать новую схему? Текущая будет потеряна.')) createNewDiagram();
    };
    document.getElementById('btn-save').onclick = saveXml;
    document.getElementById('btn-load').onclick = () => document.getElementById('file-input').click();
    document.getElementById('file-input').onchange = (e) => {
      if (e.target.files[0]) loadXml(e.target.files[0]);
    };

    // Toolbar — масштаб
    document.getElementById('btn-zoom-in').onclick = zoomIn;
    document.getElementById('btn-zoom-out').onclick = zoomOut;
    document.getElementById('btn-zoom-fit').onclick = zoomFit;

    // Toolbar — экспорт диаграммы
    document.getElementById('btn-export-svg').onclick = exportSvg;
    document.getElementById('btn-export-png').onclick = exportPng;

    // Toolbar — анимация
    document.getElementById('btn-animate').onclick = startAnimation;
    document.getElementById('btn-animate-stop').onclick = stopAnimation;

    // Actions
    document.getElementById('btn-validate').onclick = () => {
      runValidation();
      switchTab('validation');
    };
    document.getElementById('btn-generate').onclick = generateDocument;
    document.getElementById('btn-export').onclick = () => {
      const text = document.getElementById('notepad').value;
      if (!text.trim()) {
        alert('Блокнот пуст. Сначала сгенерируйте ТЗ.');
        return;
      }
      downloadFile(text, 'technical-specification.md', 'text/markdown');
    };

    // Notepad actions
    document.getElementById('btn-copy').onclick = () => {
      const ta = document.getElementById('notepad');
      ta.select();
      navigator.clipboard.writeText(ta.value);
    };
    document.getElementById('btn-download-md').onclick = () => {
      const text = document.getElementById('notepad').value;
      downloadFile(text, 'document.md', 'text/markdown');
    };

    // Projects / DB
    document.getElementById('btn-save-project').onclick = () => saveCurrentProject();
    document.getElementById('btn-project-save').onclick = () => saveCurrentProject();
    document.getElementById('btn-project-new').onclick = () => newProject();
    document.getElementById('btn-save-doc').onclick = () => saveNotepadToProject();
    document.getElementById('btn-db-export').onclick = async () => {
      try {
        const data = await APDatabase.exportAll();
        downloadFile(JSON.stringify(data, null, 2), 'analyst-pad-backup.json', 'application/json');
      } catch (e) {
        alert('Ошибка бэкапа: ' + e.message);
      }
    };
    document.getElementById('btn-db-import').onclick = () => document.getElementById('db-import-input').click();
    document.getElementById('db-import-input').onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await APDatabase.importAll(data, { merge: true });
        await refreshProjectsList();
        alert('Импорт выполнен.');
      } catch (err) {
        alert('Не удалось импортировать: ' + err.message);
      }
      e.target.value = '';
    };
  }

  // ---------- Projects UI ----------
  function updateProjectLabel() {
    const el = document.getElementById('current-project-label');
    if (!el) return;
    el.textContent = currentProjectId
      ? (currentProjectName || 'Проект')
      : 'не сохранён';
  }

  function formatDate(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('ru-RU');
    } catch {
      return '—';
    }
  }

  async function refreshProjectsList() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    try {
      const projects = await APDatabase.listProjects();
      if (!projects.length) {
        list.innerHTML = '<p class="empty">Пока нет сохранённых проектов.</p>';
        return;
      }
      list.innerHTML = projects.map(p => `
        <div class="project-card${p.id === currentProjectId ? ' active' : ''}" data-id="${p.id}">
          <div class="meta">
            <div class="title">${escapeHtml(p.name || 'Без названия')}</div>
            <div class="sub">обновлён ${formatDate(p.updatedAt)}</div>
          </div>
          <div class="actions-mini">
            <button class="btn-sm btn-open-project" data-id="${p.id}">Открыть</button>
            <button class="btn-sm btn-del-project" data-id="${p.id}">Удалить</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.btn-open-project').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          openProject(btn.getAttribute('data-id'));
        };
      });
      list.querySelectorAll('.btn-del-project').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          if (!confirm('Удалить проект и его документы?')) return;
          await APDatabase.deleteProject(id);
          if (currentProjectId === id) {
            currentProjectId = null;
            currentProjectName = '';
            updateProjectLabel();
          }
          await refreshProjectsList();
          await refreshDocumentsList();
        };
      });
      list.querySelectorAll('.project-card').forEach(card => {
        card.onclick = () => openProject(card.getAttribute('data-id'));
      });
    } catch (err) {
      list.innerHTML = `<p class="empty">Ошибка БД: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function refreshDocumentsList() {
    const box = document.getElementById('documents-list');
    if (!box) return;
    if (!currentProjectId) {
      box.innerHTML = '<p class="empty muted">Откройте проект, чтобы увидеть ТЗ и заметки.</p>';
      return;
    }
    try {
      const docs = await APDatabase.listDocuments(currentProjectId);
      if (!docs.length) {
        box.innerHTML = '<p class="empty muted">Документов пока нет. Сгенерируйте ТЗ и нажмите «Сохранить текст блокнота в проект».</p>';
        return;
      }
      box.innerHTML = docs.map(d => `
        <div class="doc-card" data-id="${d.id}">
          <div class="meta">
            <div class="title">${escapeHtml(d.title || d.type)}</div>
            <div class="sub">${escapeHtml(d.type)} · ${formatDate(d.updatedAt)}</div>
          </div>
          <button class="btn-sm btn-load-doc" data-id="${d.id}">В блокнот</button>
          <button class="btn-sm btn-del-doc" data-id="${d.id}">×</button>
        </div>
      `).join('');

      box.querySelectorAll('.btn-load-doc').forEach(btn => {
        btn.onclick = async () => {
          const docs2 = await APDatabase.listDocuments(currentProjectId);
          const doc = docs2.find(x => x.id === btn.getAttribute('data-id'));
          if (!doc) return;
          document.getElementById('notepad').value = doc.content || '';
          const sel = document.getElementById('doc-type');
          if (sel && doc.type) sel.value = doc.type;
          switchTab('notepad');
        };
      });
      box.querySelectorAll('.btn-del-doc').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Удалить документ?')) return;
          await APDatabase.deleteDocument(btn.getAttribute('data-id'));
          await refreshDocumentsList();
        };
      });
    } catch (err) {
      box.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function saveCurrentProject() {
    if (!modeler) return;
    try {
      const { xml } = await modeler.saveXML({ format: true });
      let name = currentProjectName;
      if (!currentProjectId || !name) {
        name = prompt('Название проекта:', name || 'Процесс ' + new Date().toLocaleDateString('ru-RU'));
        if (!name) return;
      }
      const project = await APDatabase.saveProject({
        id: currentProjectId || undefined,
        name,
        xml
      });
      currentProjectId = project.id;
      currentProjectName = project.name;
      updateProjectLabel();
      await refreshProjectsList();
      await refreshDocumentsList();
      alert('Проект сохранён: ' + project.name);
    } catch (err) {
      alert('Не удалось сохранить: ' + err.message);
    }
  }

  async function openProject(id) {
    try {
      const project = await APDatabase.getProject(id);
      if (!project) {
        alert('Проект не найден');
        return;
      }
      if (project.xml) {
        await modeler.importXML(project.xml);
        modeler.get('canvas').zoom('fit-viewport');
      }
      currentProjectId = project.id;
      currentProjectName = project.name || '';
      updateProjectLabel();
      clearMarkers();
      if (typeof stopAnimation === 'function') stopAnimation();
      await refreshProjectsList();
      await refreshDocumentsList();
      switchTab('bpmn');
    } catch (err) {
      alert('Не удалось открыть проект: ' + err.message);
    }
  }

  async function newProject() {
    if (!confirm('Создать новый проект? Несохранённые изменения текущей схемы будут потеряны.')) return;
    currentProjectId = null;
    currentProjectName = '';
    updateProjectLabel();
    await createNewDiagram();
    await refreshDocumentsList();
    switchTab('bpmn');
  }

  async function saveNotepadToProject() {
    if (!currentProjectId) {
      alert('Сначала сохраните или откройте проект.');
      switchTab('projects');
      return;
    }
    const content = document.getElementById('notepad').value;
    if (!content.trim()) {
      alert('Блокнот пуст.');
      return;
    }
    const type = document.getElementById('doc-type').value || 'tz';
    const titleMap = { tz: 'Техническое задание', requirements: 'Список требований', notes: 'Заметки' };
    const title = (titleMap[type] || 'Документ') + ' · ' + new Date().toLocaleString('ru-RU');
    try {
      await APDatabase.saveDocument({
        projectId: currentProjectId,
        title,
        type,
        content
      });
      await refreshDocumentsList();
      alert('Документ сохранён в проект.');
    } catch (err) {
      alert('Ошибка сохранения документа: ' + err.message);
    }
  }

  // ---------- Start ----------
  document.addEventListener('DOMContentLoaded', async () => {
    initModeler();
    bindEvents();
    updateProjectLabel();
    try {
      await APDatabase.open();
      await refreshProjectsList();
    } catch (err) {
      console.warn('IndexedDB недоступна:', err);
    }
  });
})();
