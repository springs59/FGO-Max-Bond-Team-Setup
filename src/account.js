export const BOND15_LV = 15
export const CE_ID_MIN = 9300000

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function walk(node, visit, seen = new Set()) {
  if (!node || typeof node !== 'object') return
  if (seen.has(node)) return
  seen.add(node)
  visit(node)
  const values = Array.isArray(node) ? node : Object.values(node)
  for (const value of values) walk(value, visit, seen)
}

function bondLvOf(node) {
  if (node.bondLv != null) return num(node.bondLv)
  if (node.friendshipRank != null) return num(node.friendshipRank)
  return 0
}

function isCollection(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const id = num(node.svtId)
  if (!id) return false
  return node.friendshipRank != null || node.bondLv != null || node.maxFriendshipRank != null
}

function isInstance(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const id = num(node.svtId || node.ceId || node.id)
  if (!id) return false
  if (isCollection(node)) return false
  return node.limitCount != null || node.lv != null || node.curLv != null
}

function ownedStatus(node) {
  if (node.status == null) return true
  return num(node.status) >= 2
}

function upsertServant(map, id, bondLv) {
  if (!id || id >= CE_ID_MIN) return
  const prev = map.get(id) || { id, bondLv: 0 }
  prev.bondLv = Math.max(prev.bondLv, num(bondLv))
  map.set(id, prev)
}

function upsertCe(map, id, limitCount) {
  if (!id || id < CE_ID_MIN) return
  const prev = map.get(id) || { id, limitCount: 0, mlb: false }
  prev.limitCount = Math.max(prev.limitCount, num(limitCount))
  prev.mlb = prev.limitCount >= 4
  map.set(id, prev)
}

function ingestChaldeaMaps(node, servants, ces) {
  const svtMap = node.svtStatus || node.servantStatus || node.servants
  if (svtMap && typeof svtMap === 'object' && !Array.isArray(svtMap)) {
    for (const [key, value] of Object.entries(svtMap)) {
      const rec = value && typeof value === 'object' ? value : {}
      const id = num(rec.svtId || rec.id || key)
      upsertServant(servants, id, bondLvOf(rec))
    }
  }
  const ceMap = node.craftEssenceStatus || node.ceStatus || node.craftEssences
  if (ceMap && typeof ceMap === 'object' && !Array.isArray(ceMap)) {
    for (const [key, value] of Object.entries(ceMap)) {
      const rec = value && typeof value === 'object' ? value : {}
      const id = num(rec.svtId || rec.ceId || rec.id || key)
      upsertCe(ces, id, rec.limitCount)
    }
  }
  if (Array.isArray(node.servants)) {
    for (const rec of node.servants) {
      const id = num(rec.svtId || rec.id)
      upsertServant(servants, id, bondLvOf(rec))
    }
  }
  if (Array.isArray(node.craftEssences)) {
    for (const rec of node.craftEssences) {
      const id = num(rec.svtId || rec.ceId || rec.id)
      upsertCe(ces, id, rec.limitCount)
    }
  }
}

export function parseAccount(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'JSON 无法解析', source: '', servants: [], ces: [] }
    }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '文件格式无法识别', source: '', servants: [], ces: [] }
  }

  const servants = new Map()
  const ces = new Map()
  let sawDump = false
  let sawChaldea = false

  walk(data, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    if (node.svtStatus || node.craftEssenceStatus || node.ceStatus) sawChaldea = true
    if (Array.isArray(node.users) || node.region != null) sawChaldea = true
    ingestChaldeaMaps(node, servants, ces)

    if (isCollection(node)) {
      sawDump = true
      if (!ownedStatus(node)) return
      upsertServant(servants, num(node.svtId), bondLvOf(node))
    }
    if (isInstance(node)) {
      const id = num(node.svtId || node.ceId || node.id)
      sawDump = true
      if (id >= CE_ID_MIN) upsertCe(ces, id, node.limitCount)
      else upsertServant(servants, id, bondLvOf(node))
    }
  })

  const servantList = [...servants.values()].sort((a, b) => a.id - b.id)
  const ceList = [...ces.values()].sort((a, b) => a.id - b.id)
  if (!servantList.length && !ceList.length) {
    return { ok: false, error: '文件格式无法识别', source: '', servants: [], ces: [] }
  }

  const source = sawChaldea ? 'chaldea' : 'dump'
  return { ok: true, error: '', source, servants: servantList, ces: ceList }
}

export function accountServantOf(account, svtId) {
  if (!account) return null
  return account.servants.find((item) => item.id === Number(svtId)) || null
}

export function accountCeOf(account, ceId) {
  if (!account) return null
  return account.ces.find((item) => item.id === Number(ceId)) || null
}
