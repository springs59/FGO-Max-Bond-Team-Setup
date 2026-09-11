export const ACCOUNT_KEY = 'fgo_bond_account_v1'
export const ACCOUNT_TTL_MS = 10 * 60 * 1000
export const REC_SWITCH_KEY = 'fgo_bond_rec_switch_v1'
export const REC_SWITCH_MODES = ['pager', 'cards', 'sheet']
export const DEFAULT_REC_SWITCH = 'pager'

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
