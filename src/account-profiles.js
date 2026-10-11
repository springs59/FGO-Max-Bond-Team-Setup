import { normalizeRegion, regionLabel } from './region.js'
import { loadImportedAccount } from './user-data.js'

export const PROFILES_KEY = 'fgo_bond_account_profiles_v1'
function storage(store) { try { return store || globalThis.localStorage || null } catch { return null } }
export function loadAccountProfiles(store) {
  const s = storage(store)
  if (!s) return { version: 1, next: 1, active: {}, profiles: [] }
  const raw = s.getItem(PROFILES_KEY)
  if (raw) {
    try {
      const v = JSON.parse(raw)
      if (v.version !== 1 || !Array.isArray(v.profiles) || !Number.isInteger(v.next) || !v.active ||
        new Set(v.profiles.map(p => p.id)).size !== v.profiles.length || v.profiles.some(p => !p.id || !p.account?.ok || !['CN','JP'].includes(p.region))) throw Error()
      return v
    } catch { return { version: 1, next: 1, active: {}, profiles: [], error: '账号列表无法读取，原数据已保留。请恢复账号列表后再导入。' } }
  }
  const value = { version: 1, next: 1, active: {}, profiles: [] }
  for (const region of ['CN', 'JP']) {
    const old = loadImportedAccount(Date.now(), s, region)
    if (!old?.account?.ok) continue
    const id = `account-${value.next++}`
    value.profiles.push({ id, region, name: `${regionLabel(region)}账号 1`, ...old, planner: null })
    value.active[region] = id
  }
  if (value.profiles.length) s.setItem(PROFILES_KEY, JSON.stringify(value))
  return value
}
function save(value, store) {
  if (value.error) throw Error(value.error)
  const s = storage(store)
  if (!s) throw Error('本机账号存储不可用。')
  s.setItem(PROFILES_KEY, JSON.stringify(value))
  return value
}
export function currentAccountProfile(region, store) {
  const v = loadAccountProfiles(store), r = normalizeRegion(region)
  return v.profiles.find(p => p.id === v.active[r] && p.region === r) || null
}
export function importAccountProfile(account, { id = '', name = '', now = Date.now(), store } = {}) {
  if (!account?.ok) throw Error('账号数据无效。')
  const v = loadAccountProfiles(store), region = normalizeRegion(account.region)
  let p = id ? v.profiles.find(p => p.id === id) : null
  if (id && (!p || p.region !== region)) throw Error('更新账号的区服不一致。')
  if (!p) {
    p = { id: `account-${v.next++}`, region, name: name.trim().slice(0, 60) || `${regionLabel(region)}账号 ${v.profiles.filter(p => p.region === region).length + 1}`, planner: null }
    v.profiles.push(p)
  }
  p.account = { ...account, region }; p.savedAt = now
  v.active[region] = p.id
  save(v, store)
  return p
}
export function selectAccountProfile(id, store) {
  const v = loadAccountProfiles(store), p = v.profiles.find(p => p.id === id)
  if (!p) throw Error('账号不存在。')
  v.active[p.region] = id; save(v, store); return p
}
export function updateAccountProfile(id, changes, store) {
  const v = loadAccountProfiles(store), p = v.profiles.find(p => p.id === id)
  if (!p) return null
  if (changes.name != null) p.name = String(changes.name).trim().slice(0, 60) || p.name
  if ('planner' in changes) p.planner = changes.planner
  save(v, store); return p
}
export function removeAccountProfile(id, store) {
  const v = loadAccountProfiles(store), p = v.profiles.find(p => p.id === id)
  if (!p) return v
  v.profiles = v.profiles.filter(p => p.id !== id)
  if (v.active[p.region] === id) v.active[p.region] = v.profiles.find(row => row.region === p.region)?.id || ''
  // Remove the old single-account fallback for this region, preventing a
  // deleted imported account from reappearing after the next restart.
  const s = storage(store)
  s?.removeItem('fgo_bond_account_v1:' + p.region)
  const legacy = s?.getItem('fgo_bond_account_v1')
  try { if (legacy && normalizeRegion(JSON.parse(legacy).account?.region) === p.region) s.removeItem('fgo_bond_account_v1') } catch { s.removeItem('fgo_bond_account_v1') }
  return save(v, store)
}
