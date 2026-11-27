/**
 * JobsitePro employé — file d’attente dépenses hors ligne (IndexedDB)
 */
(function (global) {
  'use strict';

  const DB_NAME = 'jobsitepro_expense_queue';
  const STORE = 'pending';
  const DB_VER = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async function enqueue(payload) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ payload, createdAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * @param {function(FormData): Promise<void>} uploadFn
   */
  async function flush(uploadFn) {
    if (!navigator.onLine) return 0;
    const rows = await listAll();
    let ok = 0;
    for (const row of rows) {
      try {
        const fd = payloadToFormData(row.payload);
        await uploadFn(fd);
        await remove(row.id);
        ok++;
      } catch { /* garde en file */ }
    }
    return ok;
  }

  function payloadToFormData(payload) {
    const form = new FormData();
    Object.keys(payload.fields || {}).forEach(k => {
      const v = payload.fields[k];
      if (v != null && v !== '') form.append(k, v);
    });
    if (payload.receiptBlob) {
      form.append('receipt', payload.receiptBlob, payload.receiptName || 'receipt.jpg');
    }
    return form;
  }

  global.ChantierTrackExpenseQueue = {
    enqueue,
    flush,
    listAll,
    payloadToFormData,
  };
})(typeof window !== 'undefined' ? window : global);
