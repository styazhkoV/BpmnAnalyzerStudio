(() => {
  const databaseName = "analystpad";
  const storeName = "projects";
  const localStorageKey = "analystpad.projects";
  let databasePromise;

  function localProjects() {
    const stored = window.localStorage.getItem(localStorageKey);
    if (!stored) return [];

    const projects = JSON.parse(stored);
    if (!Array.isArray(projects)) {
      throw new Error("Локальное хранилище проектов содержит некорректные данные.");
    }
    return projects;
  }

  function transactLocalStorage(operation) {
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function openDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(new Error("Локальное хранилище проектов недоступно в этом WebView."));
    }

    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Не удалось открыть хранилище проектов."));
        request.onblocked = () => reject(new Error("Открытие хранилища проектов заблокировано другим окном."));
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    }

    return databasePromise;
  }

  async function transact(mode, operation) {
    let database;
    try {
      database = await openDatabase();
    } catch (error) {
      console.warn("IndexedDB недоступна, используется локальное хранилище.", error);
      return transactLocalStorage(() => {
        const projects = localProjects();
        const result = operation({
          getAll: () => ({ result: projects }),
          get: (id) => ({ result: projects.find((project) => project.id === id) }),
          put: (project) => {
            const index = projects.findIndex((item) => item.id === project.id);
            if (index >= 0) projects[index] = project;
            else projects.push(project);
            window.localStorage.setItem(localStorageKey, JSON.stringify(projects));
            return { result: project.id };
          },
          delete: (id) => {
            const remaining = projects.filter((project) => project.id !== id);
            window.localStorage.setItem(localStorageKey, JSON.stringify(remaining));
            return { result: undefined };
          }
        });
        return result.result;
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      let result;

      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error("Операция с проектом не выполнена."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Транзакция хранилища завершилась с ошибкой."));
      transaction.onabort = () => reject(transaction.error || new Error("Транзакция хранилища была отменена."));
    });
  }

  window.AnalystDb = Object.freeze({
    list: () => transact("readonly", (store) => store.getAll()),
    get: (id) => transact("readonly", (store) => store.get(id)),
    put: (project) => transact("readwrite", (store) => store.put(project)),
    delete: (id) => transact("readwrite", (store) => store.delete(id))
  });
})();