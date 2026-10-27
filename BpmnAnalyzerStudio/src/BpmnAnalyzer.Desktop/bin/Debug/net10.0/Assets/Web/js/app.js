(() => {
  const $ = (selector) => document.querySelector(selector);
  const statusElement = $("#app-status");
  const propertiesContent = $("#props-content");
  const canvasElement = $("#canvas");
  const modelerControls = [
    "#btn-new", "#btn-load", "#btn-save", "#btn-zoom-out", "#btn-zoom-fit",
    "#btn-zoom-in", "#btn-export-svg", "#btn-export-png", "#btn-animate",
    "#btn-validate", "#btn-generate", "#btn-generate-brd", "#btn-export", "#btn-save-project",
    "#btn-project-save", "#btn-save-doc"
  ];

  let modeler;
  let currentProjectId = null;
  let animationTimer = null;
  let activeOverlay = null;
  let backendRequestSequence = 0;
  const pendingBackendRequests = new Map();

  window.onBackendResponse = (response) => {
    const pending = pendingBackendRequests.get(response?.id);
    if (!pending) return;
    pendingBackendRequests.delete(response.id);
    window.clearTimeout(pending.timeout);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.error || "Ошибка обработки запроса бэкендом."));
  };

  window.onBackendError = (message) => setStatus(`Ошибка бэкенда: ${message}`, "error");

  function requestBackend(action, xml) {
    if (typeof window.invokeCSharpAction !== "function") return Promise.resolve(null);

    const id = `backend-${++backendRequestSequence}`;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingBackendRequests.delete(id);
        reject(new Error("Бэкенд не ответил вовремя."));
      }, 30000);
      pendingBackendRequests.set(id, { resolve, reject, timeout });

      try {
        window.invokeCSharpAction(JSON.stringify({ id, action, xml }));
      } catch (error) {
        window.clearTimeout(timeout);
        pendingBackendRequests.delete(id);
        reject(error);
      }
    });
  }

  function setStatus(message, kind = "info") {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
    const projectsStatus = $("#projects-status");
    if (projectsStatus) {
      projectsStatus.textContent = message;
      projectsStatus.dataset.kind = kind;
    }
  }

  function reportError(action, error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${action}: ${message}`, error);
    setStatus(`${action}: ${message}`, "error");
  }

  function setEditorEnabled(enabled) {
    for (const selector of modelerControls) {
      const element = $(selector);
      if (element) element.disabled = !enabled;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      document.head.append(script);
    });
  }

  function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Не удалось загрузить стили BPMN-редактора: ${href}`));
      document.head.append(link);
    });
  }

  async function ensureBpmnLibrary() {
    if (window.BpmnJS) return;

    const cdns = [
      "https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/",
      "https://unpkg.com/bpmn-js@17.11.1/dist/"
    ];
    let lastError;
    for (const cdn of cdns) {
      try {
        await Promise.all([
          loadStylesheet(`${cdn}assets/diagram-js.css`),
          loadStylesheet(`${cdn}assets/bpmn-js.css`),
          loadStylesheet(`${cdn}assets/bpmn-font/css/bpmn-embedded.css`),
          loadScript(`${cdn}bpmn-modeler.production.min.js`)
        ]);
        if (window.BpmnJS) return;
      } catch (error) {
        lastError = error;
      }
    }

    if (!window.BpmnJS) {
      throw new Error(`BPMN-редактор не загрузился с основного и резервного CDN. Проверьте подключение к интернету. ${lastError?.message || ""}`);
    }
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFileName(name, extension) {
    const base = (name || "bpmn-process")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .trim()
      .replace(/\s+/g, "-") || "bpmn-process";
    return `${base}.${extension}`;
  }

  function getProcessName() {
    const process = modeler?.get("elementRegistry").getAll()
      .find((element) => element.businessObject?.$type === "bpmn:Process");
    return process?.businessObject.name?.trim() || "Новый процесс";
  }

  async function saveXml() {
    const { xml } = await modeler.saveXML({ format: true });
    return xml;
  }

  function showTab(tabName) {
    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tabName}`);
    });
    document.body.dataset.activeTab = tabName;
    if (tabName === "bpmn" && modeler) {
      window.requestAnimationFrame(() => modeler.get("canvas").resized());
    }
  }

  function renderProperties(element) {
    propertiesContent.replaceChildren();
    if (!element || !element.businessObject || element.labelTarget) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Выберите элемент на схеме";
      propertiesContent.append(empty);
      return;
    }

    const bo = element.businessObject;
    const type = document.createElement("p");
    type.className = "muted";
    type.textContent = bo.$type.replace(/^bpmn:/, "");
    propertiesContent.append(type);

    appendPropertyInput("Идентификатор", bo.id, (value) => {
      if (value.trim() && value.trim() !== bo.id) {
        modeler.get("modeling").updateProperties(element, { id: value.trim() });
      }
    }, { readOnly: true });

    appendPropertyInput("Название", bo.name || "", (value) => {
      modeler.get("modeling").updateProperties(element, { name: value });
    });

    if (bo.$type.endsWith("Task") || bo.$type.endsWith("Event")) {
      const documentation = bo.documentation?.[0]?.text || "";
      appendPropertyInput("Описание", documentation, (value) => {
        const factory = modeler.get("bpmnFactory");
        const documentationItems = value.trim()
          ? [factory.create("bpmn:Documentation", { text: value })]
          : [];
        modeler.get("modeling").updateProperties(element, { documentation: documentationItems });
      }, { multiline: true });
    }
  }

  function appendPropertyInput(labelText, value, onChange, options = {}) {
    const group = document.createElement("div");
    group.className = "prop-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
    input.value = value;
    if (options.readOnly) input.readOnly = true;
    input.addEventListener("change", () => onChange(input.value));
    group.append(label, input);
    propertiesContent.append(group);
  }

  function renderValidation(result) {
    const list = $("#validation-list");
    const summary = $("#validation-summary");
    list.replaceChildren();
    summary.textContent = result.errors.length
      ? `Найдено: ${result.errors.length}`
      : "Ошибок нет";
    summary.dataset.kind = result.errors.length ? "error" : "success";

    if (!result.errors.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Схема прошла проверку. Критичных ошибок не найдено.";
      list.append(empty);
      return;
    }

    for (const error of result.errors) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "validation-item";
      const code = document.createElement("span");
      code.className = "validation-code";
      code.textContent = error.code;
      const message = document.createElement("span");
      message.className = "validation-message";
      message.textContent = error.message;
      item.append(code, message);
      item.addEventListener("click", () => {
        if (!error.elementId) return;
        const element = modeler.get("elementRegistry").get(error.elementId);
        if (element) {
          showTab("bpmn");
          modeler.get("selection").select(element);
          modeler.get("canvas").scrollToElement(element);
        }
      });
      list.append(item);
    }
  }

  async function validateDiagram() {
    const xml = await saveXml();
    const result = await requestBackend("validate", xml) || window.BpmnValidation.validate(modeler);
    renderValidation(result);
    const flowCount = result.counts.flows;
    setStatus(result.errors.length
      ? `Проверка завершена: ${result.errors.length} замечаний. Потоков: ${flowCount}.`
      : `Схема корректна. Элементов: ${result.counts.tasks + result.counts.gateways + result.counts.starts + result.counts.ends}.`, result.errors.length ? "error" : "success");
    showTab("validation");
  }

  function generateDocument() {
    const docType = $("#doc-type").value;
    $("#notepad").value = window.BpmnRequirements.generate(modeler, docType);
    showTab("notepad");
    setStatus("Текст сформирован по текущей BPMN-схеме.", "success");
  }

  async function generateBrd() {
    const result = await requestBackend("generate-brd", await saveXml());
    if (!result) {
      throw new Error("Экспорт BRD доступен только в настольном приложении.");
    }
    setStatus(`BRD сохранён: ${result.path}`, "success");
  }

  async function exportSvg() {
    const { svg } = await modeler.saveSVG();
    downloadFile(safeFileName(getProcessName(), "svg"), svg, "image/svg+xml;charset=utf-8");
    setStatus("Схема экспортирована в SVG.", "success");
  }

  async function exportPng() {
    const { svg } = await modeler.saveSVG();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      image.src = svgUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Не удалось подготовить изображение схемы."));
      });

      const viewBox = svg.match(/viewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/\s+/).map(Number);
      const width = Math.max(1, Math.ceil(viewBox?.[2] || image.naturalWidth));
      const height = Math.max(1, Math.ceil(viewBox?.[3] || image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Не удалось создать холст для PNG.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось сформировать PNG.")), "image/png");
      });
      const pngUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = safeFileName(getProcessName(), "png");
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      setStatus("Схема экспортирована в PNG.", "success");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function buildProcessPath() {
    const registry = modeler.get("elementRegistry");
    const start = registry.getAll().find((element) => element.businessObject?.$type === "bpmn:StartEvent");
    if (!start) return [];

    const path = [];
    const visited = new Set();
    let current = start;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push(current);
      if (current.businessObject.$type === "bpmn:EndEvent") break;
      const flow = (current.outgoing || []).find((connection) =>
        connection.businessObject?.$type === "bpmn:SequenceFlow");
      current = flow ? registry.get(flow.businessObject.targetRef.id) : null;
    }
    return path;
  }

  function stopAnimation() {
    if (animationTimer !== null) window.clearInterval(animationTimer);
    animationTimer = null;
    if (activeOverlay !== null) {
      modeler.get("overlays").remove(activeOverlay);
      activeOverlay = null;
    }
    $("#btn-animate").hidden = false;
    $("#btn-animate-stop").hidden = true;
  }

  function animateProcess() {
    const path = buildProcessPath();
    if (!path.length) {
      setStatus("Добавьте стартовое событие, чтобы запустить анимацию.", "error");
      return;
    }

    stopAnimation();
    const overlays = modeler.get("overlays");
    let index = 0;
    const showToken = () => {
      if (activeOverlay !== null) overlays.remove(activeOverlay);
      const element = path[index];
      const token = document.createElement("div");
      token.className = "process-token";
      activeOverlay = overlays.add(element.id, "process-token", {
        position: { top: Math.max(0, element.height / 2 - 7), left: Math.max(0, element.width / 2 - 7) },
        html: token
      });
      if (index >= path.length - 1) {
        window.clearInterval(animationTimer);
        animationTimer = null;
        $("#btn-animate").hidden = false;
        $("#btn-animate-stop").hidden = true;
        setStatus("Анимация процесса завершена.", "success");
      } else {
        index += 1;
      }
    };

    $("#btn-animate").hidden = true;
    $("#btn-animate-stop").hidden = false;
    showToken();
    if (path.length > 1) {
      animationTimer = window.setInterval(showToken, 800);
      setStatus(`Анимация: ${path.length} элементов по первой доступной ветви.`, "success");
    }
  }

  async function createNewDiagram() {
    stopAnimation();
    await modeler.createDiagram();
    currentProjectId = null;
    updateProjectLabel(null);
    setStatus("Создана новая BPMN-схема.", "success");
    showTab("bpmn");
  }

  async function importXml(xml, sourceName = "") {
    if (!xml.trim()) throw new Error("Выбранный файл пуст.");
    stopAnimation();
    await modeler.importXML(xml);
    modeler.get("canvas").zoom("fit-viewport");
    currentProjectId = null;
    updateProjectLabel(null);
    setStatus(sourceName ? `Схема загружена: ${sourceName}` : "Схема импортирована.", "success");
    showTab("bpmn");
  }

  async function loadXmlFile(file) {
    try {
      await importXml(await file.text(), file.name);
    } catch (error) {
      reportError("Не удалось открыть BPMN-файл", error);
    } finally {
      $("#file-input").value = "";
    }
  }

  function updateProjectLabel(project) {
    const label = $("#current-project-label");
    label.textContent = project?.name || (currentProjectId ? "проект не найден" : "не сохранён");
    label.title = project?.name || "Текущий проект";
  }

  async function saveProject() {
    const now = new Date().toISOString();
    const existing = currentProjectId ? await window.AnalystDb.get(currentProjectId) : null;
    const project = {
      id: currentProjectId || (globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}`),
      name: existing?.name || getProcessName(),
      xml: await saveXml(),
      documents: existing?.documents || [],
      updatedAt: now
    };
    await window.AnalystDb.put(project);
    currentProjectId = project.id;
    updateProjectLabel(project);
    await renderProjects();
    setStatus(`Проект «${project.name}» сохранён локально.`, "success");
  }

  function makeButton(text, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", handler);
    return button;
  }

  async function renderDocuments(project) {
    const container = $("#documents-list");
    container.replaceChildren();
    if (!project?.documents?.length) {
      const empty = document.createElement("p");
      empty.className = "empty muted";
      empty.textContent = "В проекте пока нет документов.";
      container.append(empty);
      return;
    }
    for (const documentItem of project.documents) {
      const card = document.createElement("div");
      card.className = "document-card";
      const title = document.createElement("span");
      title.textContent = documentItem.title;
      const open = makeButton("Открыть", "btn-sm", () => {
        $("#notepad").value = documentItem.content;
        showTab("notepad");
        setStatus(`Открыт документ «${documentItem.title}».`, "success");
      });
      card.append(title, open);
      container.append(card);
    }
  }

  async function renderProjects() {
    const list = $("#projects-list");
    list.replaceChildren();
    const projects = await window.AnalystDb.list();
    projects.sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Пока нет сохранённых проектов.";
      list.append(empty);
      await renderDocuments(null);
      return;
    }

    for (const project of projects) {
      const card = document.createElement("div");
      card.className = "project-card";
      const details = document.createElement("span");
      details.textContent = `${project.name} · ${new Date(project.updatedAt).toLocaleString("ru-RU")}`;
      const open = makeButton("Открыть", "btn-sm", async () => {
        try {
          stopAnimation();
          await modeler.importXML(project.xml);
          modeler.get("canvas").zoom("fit-viewport");
          currentProjectId = project.id;
          updateProjectLabel(project);
          await renderDocuments(project);
          showTab("bpmn");
          setStatus(`Открыт проект «${project.name}».`, "success");
        } catch (error) {
          reportError(`Не удалось открыть проект «${project.name}»`, error);
        }
      });
      card.append(details, open);
      list.append(card);
    }
    const activeProject = projects.find((project) => project.id === currentProjectId);
    await renderDocuments(activeProject || null);
  }

  async function saveDocumentToProject() {
    const content = $("#notepad").value;
    if (!content.trim()) {
      setStatus("Сначала сформируйте или введите текст документа.", "error");
      return;
    }
    const now = new Date().toISOString();
    const project = currentProjectId
      ? await window.AnalystDb.get(currentProjectId)
      : null;
    const savedProject = project || {
      id: globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}`,
      name: getProcessName(),
      xml: await saveXml(),
      documents: []
    };
    savedProject.documents = savedProject.documents || [];
    savedProject.documents.push({
      id: globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}`,
      title: `${$("#doc-type").selectedOptions[0].text} — ${new Date().toLocaleDateString("ru-RU")}`,
      content,
      updatedAt: now
    });
    savedProject.updatedAt = now;
    await window.AnalystDb.put(savedProject);
    currentProjectId = savedProject.id;
    updateProjectLabel(savedProject);
    await renderProjects();
    setStatus("Документ сохранён в проекте.", "success");
  }

  async function exportDatabase() {
    const projects = await window.AnalystDb.list();
    downloadFile("analystpad-backup.json", JSON.stringify(projects, null, 2), "application/json;charset=utf-8");
    setStatus(`Создана резервная копия: ${projects.length} проектов.`, "success");
  }

  async function importDatabaseFile(file) {
    try {
      const projects = JSON.parse(await file.text());
      if (!Array.isArray(projects) || projects.some((project) =>
        typeof project?.id !== "string" || typeof project?.name !== "string" || typeof project?.xml !== "string")) {
        throw new Error("Файл должен содержать массив проектов AnalystPad с полями id, name и xml.");
      }
      for (const project of projects) {
        await window.AnalystDb.put({
          ...project,
          documents: Array.isArray(project.documents) ? project.documents : [],
          updatedAt: project.updatedAt || new Date().toISOString()
        });
      }
      await renderProjects();
      setStatus(`Импортировано проектов: ${projects.length}.`, "success");
    } catch (error) {
      reportError("Не удалось импортировать резервную копию", error);
    } finally {
      $("#db-import-input").value = "";
    }
  }

  function connectHandlers() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        showTab(tab.dataset.tab);
        if (tab.dataset.tab === "projects") {
          renderProjects().catch((error) => reportError("Не удалось загрузить проекты", error));
        }
      });
    });

    $("#btn-new").addEventListener("click", () => createNewDiagram().catch((error) => reportError("Не удалось создать схему", error)));
    $("#btn-load").addEventListener("click", () => $("#file-input").click());
    $("#file-input").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) loadXmlFile(file);
    });
    $("#btn-save").addEventListener("click", async () => {
      try {
        downloadFile(safeFileName(getProcessName(), "bpmn"), await saveXml(), "application/xml;charset=utf-8");
        setStatus("BPMN XML сохранён.", "success");
      } catch (error) {
        reportError("Не удалось сохранить XML", error);
      }
    });
    $("#btn-export").addEventListener("click", () => $("#btn-save").click());
    $("#btn-zoom-out").addEventListener("click", () => modeler.get("canvas").zoom(modeler.get("canvas").zoom() / 1.2));
    $("#btn-zoom-in").addEventListener("click", () => modeler.get("canvas").zoom(modeler.get("canvas").zoom() * 1.2));
    $("#btn-zoom-fit").addEventListener("click", () => modeler.get("canvas").zoom("fit-viewport"));
    $("#btn-export-svg").addEventListener("click", () => exportSvg().catch((error) => reportError("Не удалось экспортировать SVG", error)));
    $("#btn-export-png").addEventListener("click", () => exportPng().catch((error) => reportError("Не удалось экспортировать PNG", error)));
    $("#btn-animate").addEventListener("click", animateProcess);
    $("#btn-animate-stop").addEventListener("click", stopAnimation);
    $("#btn-validate").addEventListener("click", () =>
      validateDiagram().catch((error) => reportError("Ошибка проверки схемы", error)));
    $("#btn-generate").addEventListener("click", () => {
      try { generateDocument(); } catch (error) { reportError("Не удалось сформировать документ", error); }
    });
    $("#btn-generate-brd").addEventListener("click", () =>
      generateBrd().catch((error) => reportError("Не удалось сформировать BRD", error)));
    $("#btn-copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("#notepad").value);
        setStatus("Текст скопирован в буфер обмена.", "success");
      } catch (error) {
        reportError("Не удалось скопировать текст", error);
      }
    });
    $("#btn-download-md").addEventListener("click", () => {
      downloadFile("analystpad-document.md", $("#notepad").value, "text/markdown;charset=utf-8");
      setStatus("Markdown-файл сохранён.", "success");
    });
    $("#btn-save-project").addEventListener("click", () => saveProject().catch((error) => reportError("Не удалось сохранить проект", error)));
    $("#btn-project-save").addEventListener("click", () => saveProject().catch((error) => reportError("Не удалось сохранить проект", error)));
    $("#btn-project-new").addEventListener("click", async () => {
      try {
        stopAnimation();
        await modeler.createDiagram();
        currentProjectId = null;
        updateProjectLabel(null);
        await saveProject();
        showTab("projects");
        setStatus("Новый проект создан и сохранён.", "success");
      } catch (error) {
        showTab("projects");
        reportError("Не удалось создать проект", error);
      }
    });
    $("#btn-db-export").addEventListener("click", () => exportDatabase().catch((error) => reportError("Не удалось создать резервную копию", error)));
    $("#btn-db-import").addEventListener("click", () => $("#db-import-input").click());
    $("#db-import-input").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) importDatabaseFile(file);
    });
    $("#btn-save-doc").addEventListener("click", () =>
      saveDocumentToProject().catch((error) => reportError("Не удалось сохранить документ", error)));
  }

  async function initializeModeler() {
    setEditorEnabled(false);

    try {
      await ensureBpmnLibrary();
      modeler = new window.BpmnJS({ container: canvasElement });
      modeler.on("selection.changed", (event) => renderProperties(event.newSelection?.[0]));
      modeler.on("import.done", (event) => {
        if (event.error) reportError("Не удалось загрузить BPMN-схему", event.error);
        else modeler.get("canvas").zoom("fit-viewport");
      });
      modeler.on("commandStack.changed", () => setStatus("Есть несохранённые изменения.", "info"));
      if (window.ResizeObserver) {
        new ResizeObserver(() => modeler.get("canvas").resized()).observe(canvasElement);
      } else {
        window.addEventListener("resize", () => modeler.get("canvas").resized());
      }
      setEditorEnabled(true);
      await modeler.createDiagram();
      renderProperties(null);
      setStatus("Редактор готов. Добавляйте элементы схемы через палитру.", "success");
    } catch (error) {
      setEditorEnabled(false);
      reportError("Редактор схем недоступен", error);
    }
  }

  connectHandlers();
  initializeModeler();
})();