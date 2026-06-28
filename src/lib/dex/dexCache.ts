// Tiny IndexedDB key→value store so SoulDex detail (fetched once from PokéAPI) is
// available OFFLINE on every later view. No dependency, best-effort (never throws).
const DB = 'souldex', STORE = 'kv'
let _db: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  return _db
}
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const d = await db()
    return await new Promise((res) => { const q = d.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res((q.result as T) ?? null); q.onerror = () => res(null) })
  } catch { return null }
}
export async function cacheSet(key: string, val: unknown): Promise<void> {
  try { const d = await db(); d.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key) } catch { /* ignore */ }
}
