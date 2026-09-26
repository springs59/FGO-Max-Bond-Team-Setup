import { SOLVER_INDEX_VERSION } from './solver-index.js'

const mem = new Map()
const PREFIX = 'fgo-solver-cache:'
// Bump when the shape of produced plans changes (e.g. new slot annotations)
// so stale entries from older builds are ignored.
const CACHE_REV = 12

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
  region = '',
  eventId = 0,
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
    region,
    eventId: Number(eventId) || 0,
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
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PREFIX + djb2(key), JSON.stringify({ key, value: copy }))
  } catch {
    // quota / private mode
  }
}
