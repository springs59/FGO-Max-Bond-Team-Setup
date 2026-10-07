const NAME = 'fgo-native-data-v1'
let opened, pageSnapshot
export function isNative() {
  return typeof location !== 'undefined' && (location.protocol === 'app:' || location.hostname === 'appassets.androidplatform.net')
}
export function database() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, 1)
    r.onupgradeneeded = () => { for (const name of ['files', 'stage', 'meta', 'cache']) r.result.createObjectStore(name) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => { opened = null; reject(r.error) }
  })
  return opened
}
export async function get(store, key) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store), r = tx.objectStore(store).get(key)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
export async function put(store, key, value) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
}
export async function commitStage(manifest, status) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'stage', 'meta'], 'readwrite')
    const stage = tx.objectStore('stage'), files = tx.objectStore('files'), meta = tx.objectStore('meta')
    for (const entry of manifest.files) {
      const r = stage.get(entry.path)
      r.onsuccess = () => {
        if (!r.result || r.result.sha256 !== entry.sha256) { tx.abort(); return }
        files.put(r.result, entry.path)
      }
    }
    meta.put(manifest, 'active'); meta.put(status, 'status'); meta.delete('checkpoint')
    stage.clear()
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('候选数据不完整，保留上一版'))
  })
}
export function dataPath(url) {
  const p = new URL(url).pathname
  const start = p.search(/\/(?:src\/data|generated)\//)
  return start >= 0 ? p.slice(start + 1) : ''
}
export async function readActiveData(url) {
  if (!isNative()) return undefined
  const path = dataPath(url)
  if (!path) return undefined
  // One transaction captures all files, preventing mixed versions if the
  // background task commits while the application is still booting.
  if (!pageSnapshot) pageSnapshot = database().then(db => new Promise((resolve,reject) => {
    const tx=db.transaction('files'), store=tx.objectStore('files'), keys=store.getAllKeys(), rows=store.getAll()
    tx.oncomplete=()=>resolve(new Map(keys.result.map((key,i)=>[key,rows.result[i]])))
    tx.onabort=()=>reject(tx.error)
  }))
  return (await pageSnapshot).get(path)?.data
}
export async function status() { return (await get('meta', 'status')) || { state: 'idle', phase: '等待更新', done: 0, total: 0, logs: [] } }
