/**
 * AnalystPad DB — лёгкое хранилище на IndexedDB
 *
 * Хранит:
 *  - projects: схемы BPMN + метаданные
 *  - documents: сгенерированные ТЗ / заметки
 *
 * Без сервера, работает офлайн и на GitHub Pages.
 */

const APDatabase = (() => {
  const DB_NAME = 'analyst-pad-db';
  const DB_VERSION = 1;
  const STORE_PROJECTS = 'projects';
  const STORE_DOCUMENTS = 'documents';

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const ps = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          ps.createIndex('by_updated', 'updatedAt', { unique: false });
          ps.createIndex('by_name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
          const ds = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
          ds.createIndex('by_project', 'projectId', { unique: false });
          ds.createIndex('by_updated', 'updatedAt', { unique: false });
        }
      };
    });
    return dbPromise;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // ---------- Projects ----------

  /**
   * @typedef {Object} Project
   * @property {string} id
   * @property {string} name
   * @property {string} xml          BPMN XML
   * @property {number} createdAt
   * @property {number} updatedAt
   * @property {string} [description]
   */

  async function listProjects() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).index('by_updated').getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function getProject(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveProject({ id, name, xml, description }) {
    const db = await open();
    const now = Date.now();
    let project = id ? await getProject(id) : null;
    if (!project) {
      project = {
        id: id || uuid(),
        name: name || 'Без названия',
        xml: xml || '',
        description: description || '',
        createdAt: now,
        updatedAt: now
      };
    } else {
      if (name !== undefined) project.name = name;
      if (xml !== undefined) project.xml = xml;
      if (description !== undefined) project.description = description;
      project.updatedAt = now;
    }
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(project);
    await txDone(tx);
    return project;
  }

  async function deleteProject(id) {
    const db = await open();
    // cascade: delete documents of this project
    const docs = await listDocuments(id);
    const tx = db.transaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(id);
    docs.forEach(d => tx.objectStore(STORE_DOCUMENTS).delete(d.id));
    await txDone(tx);
  }

  // ---------- Documents (ТЗ, заметки) ----------

  /**
   * @typedef {Object} Document
   * @property {string} id
   * @property {string} projectId
   * @property {string} title
   * @property {string} type          'tz' | 'requirements' | 'notes'
   * @property {string} content
   * @property {number} createdAt
   * @property {number} updatedAt
   */

  async function listDocuments(projectId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
      const store = tx.objectStore(STORE_DOCUMENTS);
      if (!projectId) {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
        return;
      }
      const req = store.index('by_project').getAll(projectId);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDocument({ id, projectId, title, type, content }) {
    if (!projectId) throw new Error('projectId обязателен');
    const db = await open();
    const now = Date.now();
    let doc = null;
    if (id) {
      doc = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
        const req = tx.objectStore(STORE_DOCUMENTS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    if (!doc) {
      doc = {
        id: id || uuid(),
        projectId,
        title: title || 'Документ',
        type: type || 'tz',
        content: content || '',
        createdAt: now,
        updatedAt: now
      };
    } else {
      if (title !== undefined) doc.title = title;
      if (type !== undefined) doc.type = type;
      if (content !== undefined) doc.content = content;
      doc.updatedAt = now;
    }
    const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
    tx.objectStore(STORE_DOCUMENTS).put(doc);
    await txDone(tx);
    return doc;
  }

  async function deleteDocument(id) {
    const db = await open();
    const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
    tx.objectStore(STORE_DOCUMENTS).delete(id);
    await txDone(tx);
  }

  /** Полный экспорт БД (JSON) — бэкап */
  async function exportAll() {
    const projects = await listProjects();
    const documents = await listDocuments();
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
      documents
    };
  }

  /** Импорт из JSON-бэкапа */
  async function importAll(data, { merge = true } = {}) {
    if (!data || !Array.isArray(data.projects)) throw new Error('Некорректный файл бэкапа');
    const db = await open();
    if (!merge) {
      // очистка
      const clearTx = db.transaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite');
      clearTx.objectStore(STORE_PROJECTS).clear();
      clearTx.objectStore(STORE_DOCUMENTS).clear();
      await txDone(clearTx);
    }
    const tx = db.transaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite');
    const ps = tx.objectStore(STORE_PROJECTS);
    const ds = tx.objectStore(STORE_DOCUMENTS);
    (data.projects || []).forEach(p => ps.put(p));
    (data.documents || []).forEach(d => ds.put(d));
    await txDone(tx);
  }

  return {
    open,
    listProjects,
    getProject,
    saveProject,
    deleteProject,
    listDocuments,
    saveDocument,
    deleteDocument,
    exportAll,
    importAll
  };
})();
