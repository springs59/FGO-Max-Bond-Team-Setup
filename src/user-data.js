export const ACCOUNT_KEY = 'fgo_bond_account_v1'
export const ACCOUNT_TTL_MS = 10 * 60 * 1000
export const REC_SWITCH_KEY = 'fgo_bond_rec_switch_v1'
export const REC_SWITCH_MODES = ['pager', 'cards', 'sheet']
export const DEFAULT_REC_SWITCH = 'pager'
export const PLANNER_KEY = 'fgo_bond_planner_user_data'
export const PLANNER_VERSION = 1

function getStore(store) {
  if (store) return store
  try {
    if (globalThis.localStorage) return globalThis.localStorage
  } catch {
    return null
  }
  return null
}

export function saveImportedAccount(account, now = Date.now(), store) {
  const s = getStore(store)
  if (!s || !account || !account.ok) return false
  s.setItem(ACCOUNT_KEY, JSON.stringify({ savedAt: now, account }))
  return true
}

export function loadImportedAccount(now = Date.now(), store) {
  const s = getStore(store)
  if (!s) return null
  const raw = s.getItem(ACCOUNT_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data || !data.savedAt || !data.account || now - data.savedAt > ACCOUNT_TTL_MS) {
      s.removeItem(ACCOUNT_KEY)
      return null
    }
    return data
  } catch {
    s.removeItem(ACCOUNT_KEY)
    return null
  }
}

export function clearImportedAccount(store) {
  const s = getStore(store)
  if (s) s.removeItem(ACCOUNT_KEY)
}

export function accountRemainingMs(savedAt, now = Date.now()) {
  const t = Number(savedAt) || 0
  if (!t) return 0
  return Math.max(0, t + ACCOUNT_TTL_MS - now)
}

export function loadRecSwitchMode(store) {
  const s = getStore(store)
  if (!s) return DEFAULT_REC_SWITCH
  const raw = s.getItem(REC_SWITCH_KEY)
  return REC_SWITCH_MODES.includes(raw) ? raw : DEFAULT_REC_SWITCH
}

export function saveRecSwitchMode(mode, store) {
  const s = getStore(store)
  if (!s) return false
  const next = REC_SWITCH_MODES.includes(mode) ? mode : DEFAULT_REC_SWITCH
  s.setItem(REC_SWITCH_KEY, next)
  return true
}

function idsOf(list) {
  return (Array.isArray(list) ? list : []).map(Number).filter((id) => Number.isInteger(id) && id > 0)
}

function sanitizePriorities(list) {
  if (!Array.isArray(list)) return []
  return list
    .slice(0, 24)
    .map((rule, index) => {
      if (!rule || typeof rule !== 'object') return null
      return {
        id: String(rule.id || `rule_${index + 1}`),
        type: String(rule.type || ''),
        operator: rule.operator == null || rule.operator === '' ? undefined : String(rule.operator),
        value: Array.isArray(rule.value) ? rule.value.map(Number).filter((id) => id) : rule.value,
        weight: Number(rule.weight) || 0,
        enabled: rule.enabled !== false,
        label: String(rule.label || ''),
      }
    })
    .filter((rule) => rule && rule.type)
}

function sanitizeSlotPins(list) {
  const seen = new Set()
  const pins = []
  for (const pin of list || []) {
    const position = Number(pin && pin.position) || 0
    if (position < 1 || position > 6 || seen.has(position)) continue
    seen.add(position)
    pins.push({
      position,
      svtId: Number(pin && pin.svtId) || 0,
      ceId: Number(pin && pin.ceId) || 0,
      formKey: String((pin && pin.formKey) || ''),
      ceBondId: Number(pin && pin.ceBondId) || 0,
      ceRewardId: Number(pin && pin.ceRewardId) || 0,
    })
  }
  return pins.filter((pin) => pin.svtId || pin.ceId || pin.ceBondId || pin.ceRewardId)
}

export function plannerFromState(state) {
  return {
    version: PLANNER_VERSION,
    lockIds: idsOf(state && state.lockIds),
    preferIds: idsOf(state && state.preferIds),
    spriteMode: state && state.spriteMode === 'strict_order' ? 'strict_order' : 'bond_first',
    priorities: sanitizePriorities(state && state.priorities),
    frontIds: [0, 1, 2].map((i) => {
      const pin = (state && state.slotPins ? state.slotPins : []).find((item) => item.position === i + 1 && item.svtId)
      return (pin && pin.svtId) || Number(state && state.frontIds && state.frontIds[i]) || 0
    }),
    slotPins: sanitizeSlotPins(state && state.slotPins),
    pinCes: (state && state.pinCes ? state.pinCes : [])
      .slice(0, 3)
      .map((pin) => ({ svtId: Number(pin && pin.svtId) || 0, ceId: Number(pin && pin.ceId) || 0 }))
      .filter((pin) => pin.svtId && pin.ceId),
    pinSprites: (state && state.pinSprites ? state.pinSprites : [])
      .slice(0, 5)
      .map((pin) => ({ svtId: Number(pin && pin.svtId) || 0, formKey: String((pin && pin.formKey) || '') }))
      .filter((pin) => pin.svtId && pin.formKey),
    optimizeBy: state && state.optimizeBy === 'prefer' ? 'prefer' : 'total',
    allowSupport: !state || state.allowSupport !== false,
    bond15Aura: !state || state.bond15Aura !== false,
    grandPosition: Number(state && state.grandPosition) || 0,
  }
}

export function applyPlanner(state, planner) {
  if (!state || !planner) return state
  state.lockIds = idsOf(planner.lockIds)
  state.preferIds = idsOf(planner.preferIds)
  state.spriteMode = planner.spriteMode === 'strict_order' ? 'strict_order' : 'bond_first'
  state.priorities = sanitizePriorities(planner.priorities)
  const front = Array.isArray(planner.frontIds) ? planner.frontIds : [0, 0, 0]
  state.frontIds = [0, 1, 2].map((i) => Number(front[i]) || 0)
  state.slotPins = sanitizeSlotPins(planner.slotPins)
  if (!state.slotPins.length) {
    state.slotPins = state.frontIds
      .map((svtId, index) => (svtId ? { position: index + 1, svtId, ceId: 0, formKey: '', ceBondId: 0, ceRewardId: 0 } : null))
      .filter(Boolean)
  }
  state.pinCes = (planner.pinCes || [])
    .slice(0, 3)
    .map((pin) => ({ svtId: Number(pin && pin.svtId) || 0, ceId: Number(pin && pin.ceId) || 0 }))
    .filter((pin) => pin.svtId && pin.ceId)
  state.pinSprites = (planner.pinSprites || [])
    .slice(0, 5)
    .map((pin) => ({ svtId: Number(pin && pin.svtId) || 0, formKey: String((pin && pin.formKey) || '') }))
    .filter((pin) => pin.svtId && pin.formKey)
  state.optimizeBy = planner.optimizeBy === 'prefer' ? 'prefer' : 'total'
  if (planner.allowSupport != null) state.allowSupport = planner.allowSupport !== false
  if (planner.bond15Aura != null) state.bond15Aura = planner.bond15Aura !== false
  const grandPos = Number(planner.grandPosition) || 0
  state.grandPosition = grandPos >= 1 && grandPos <= 6 ? grandPos : 0
  return state
}

export function loadPlanner(store) {
  const s = getStore(store)
  if (!s) return null
  const raw = s.getItem(PLANNER_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

export function savePlanner(planner, store) {
  const s = getStore(store)
  if (!s || !planner) return false
  s.setItem(PLANNER_KEY, JSON.stringify({ ...planner, version: PLANNER_VERSION }))
  return true
}
