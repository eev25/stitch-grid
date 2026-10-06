/* ============================================================
   imageStore.ts — IndexedDB storage for uploaded image blobs.
   Images are too large for localStorage (they'd blow the quota
   and make pattern saves fail silently), so the pattern only
   persists a blob id. Every call degrades quietly when IndexedDB
   is unavailable (private browsing, tests).
   ============================================================ */

const DB_NAME = "stitch-grid";
const STORE = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const newImageId = (): string =>
  "img-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

/** Store a blob; resolves false if it couldn't be saved. */
export async function putImageBlob(id: string, blob: Blob): Promise<boolean> {
  try { await run("readwrite", (s) => s.put(blob, id)); return true; } catch { return false; }
}

/** The stored blob, or null if it's missing or storage is unavailable. */
export async function getImageBlob(id: string): Promise<Blob | null> {
  try { return (await run<Blob | undefined>("readonly", (s) => s.get(id))) ?? null; } catch { return null; }
}

export async function deleteImageBlob(id: string): Promise<void> {
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* nothing to clean up */ }
}

/** Delete every stored blob whose id isn't in `keep` (orphans from interrupted saves). */
export async function pruneImageBlobs(keep: Array<string | undefined>): Promise<void> {
  try {
    const ids = await run("readonly", (s) => s.getAllKeys());
    await Promise.all(ids.map(String).filter((id) => !keep.includes(id)).map(deleteImageBlob));
  } catch { /* nothing to clean up */ }
}
