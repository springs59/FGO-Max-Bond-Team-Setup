import { SOLVER_INDEX_VERSION } from './solver-index.js'

const mem = new Map()
const PREFIX = 'fgo-solver-cache:'
// Bump when the shape of produced plans changes (e.g. new slot annotations)
// so stale entries from older builds are ignored.
const CACHE_REV = 25
let persistentDb, restored, pendingWrite = Promise.resolve()
function database() {
  if (!persistentDb) persistentDb = new Promise((resolve, reject) => {
    const r = indexedDB.open('fgo-solver-results-v1', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('results', { keyPath: 'key' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return persistentDb
}
export async function restoreSolverCache() {
  if (typeof indexedDB === 'undefined') return
  if (!restored) restored = (async () => {
    const db = await database()
    const entries = await new Promise((resolve, reject) => {
      const r = db.transaction('results').objectStore('results').getAll()
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    for (const entry of entries) {
      try { if (JSON.parse(entry.key).rev === CACHE_REV && entry.value?.ok) mem.set(entry.key, entry.value) } catch {}
    }
  })().catch(() => {})
  await restored
}
export async function flushSolverCache() { await pendingWrite }

function djb2(text) {
  let hash = 5381
  const s = String(text || '')
  for (let i = 0; i < s.length; i++) hash = (hash * 33) ^ s.charCodeAt(i)
  return (hash >>> 0).toString(16)
}

function stripNestedPlans(item) {
  if (!item || typeof item !== 'object') return item
  const { plans, allPlans, ...rest } = item
  return rest
}

export function cloneSolverResult(plan) {
  if (!plan || typeof plan !== 'object') return plan
  const { plans, allPlans, ...rest } = plan
  const copy = JSON.parse(JSON.stringify(rest))
  if (Array.isArray(plans)) {
    copy.plans = plans.map((item) => JSON.parse(JSON.stringify(stripNestedPlans(item))))
  }
  if (Array.isArray(allPlans)) {
    copy.allPlans = allPlans.map((item) => JSON.parse(JSON.stringify(stripNestedPlans(item))))
  }
  return copy
}

export function solverCacheKey({
  solverVersion = SOLVER_INDEX_VERSION,
  gameDataVersion = '',
  mode = 'free',
  base = 0,
  teapot = false,
  costLimit = null,
  optimizeBy = 'total',
  priorities = [],
  spriteMode = 'bond_first',
  preferSvtIds = [],
  lockSvtIds = [],
  allowSupport = true,
  questType = 'normal',
  questClass = '',
  bond15Aura = true,
  frontIds = [],
  pinCes = [],
  pinSprites = [],
  slotPins = [],
  grandPosition = 0,
  filter = null,
  servantSig = '',
  ceSig = '',
  accountSig = '',
  accountProfileId = '',
  region = '',
  eventId = 0,
  questId = 0,
  activitySig = '',
  exactDomain = '',
  aiPolicy = '',
  lockSupportCeId = 0,
} = {}) {
  return JSON.stringify({
    rev: CACHE_REV,
    solverVersion,
    gameDataVersion,
    mode,
    base,
    teapot: Boolean(teapot),
    costLimit: costLimit == null ? '' : costLimit,
    optimizeBy,
    priorities,
    spriteMode,
    preferSvtIds,
    lockSvtIds,
    allowSupport: Boolean(allowSupport),
    questType,
    questClass,
    bond15Aura: bond15Aura !== false,
    frontIds,
    pinCes,
    pinSprites,
    slotPins,
    grandPosition: Number(grandPosition) || 0,
    filter,
    servantSig,
    ceSig,
    accountSig,
    accountProfileId,
    region,
    eventId: Number(eventId) || 0,
    questId, activitySig, exactDomain, aiPolicy, lockSupportCeId,
  })
}

export function readSolverCache(key) {
  if (mem.has(key)) return cloneSolverResult(mem.get(key))
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(PREFIX + djb2(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.key !== key) return null
    const value = cloneSolverResult(parsed.value)
    mem.set(key, value)
    return cloneSolverResult(value)
  } catch {
    return null
  }
}

export function writeSolverCache(key, value) {
  const copy = cloneSolverResult(value)
  mem.set(key, copy)
  // Workers have no localStorage. Persist completed queries across restarts,
  // bounded to 20 entries; account and condition signatures remain in the key.
  if (typeof indexedDB !== 'undefined' && JSON.stringify(copy).length <= 2 * 1024 * 1024) {
    pendingWrite = pendingWrite.then(async () => {
      const db = await database()
      await new Promise((resolve, reject) => {
        const tx = db.transaction('results', 'readwrite'), store = tx.objectStore('results')
        store.put({ key, value: copy, touched: Date.now() })
        const r = store.getAll()
        r.onsuccess = () => {
          for (const entry of r.result.sort((a,b)=>b.touched-a.touched).slice(20)) store.delete(entry.key)
        }
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
      })
    }).catch(() => {})
  }
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PREFIX + djb2(key), JSON.stringify({ key, value: copy }))
  } catch {
    // quota / private mode
  }
}
