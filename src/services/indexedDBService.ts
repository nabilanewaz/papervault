const DB_NAME = 'research_db';
const DB_VERSION = 1;
const PDF_STORE = 'pdfs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const indexedDBService = {
  async savePDF(id: string, file: File): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE, 'readwrite');
      const store = tx.objectStore(PDF_STORE);
      const req = store.put({ id, blob: file, name: file.name, size: file.size, savedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getPDF(id: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE, 'readonly');
      const store = tx.objectStore(PDF_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async deletePDF(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE, 'readwrite');
      const store = tx.objectStore(PDF_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getTotalSize(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE, 'readonly');
      const store = tx.objectStore(PDF_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const total = (req.result || []).reduce((sum: number, r: any) => sum + (r.size ?? 0), 0);
        resolve(total);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
