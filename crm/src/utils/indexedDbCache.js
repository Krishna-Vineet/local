export const dbName = 'happypix_ai_cache';
export const dbVersion = 1;

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'assetId' });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'templateId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheAsset(assetId, url, mimeType) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const db = await openDb();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const req = store.put({
        assetId,
        blob,
        mimeType,
        cachedAt: Date.now()
      });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to cache asset:', err);
    return false;
  }
}

export async function getCachedAssetUrl(assetId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readonly');
    const store = tx.objectStore('assets');
    const req = store.get(assetId);
    
    req.onsuccess = () => {
      if (req.result && req.result.blob) {
        const url = URL.createObjectURL(req.result.blob);
        resolve(url);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
