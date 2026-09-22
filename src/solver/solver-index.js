import { pickCeSkill, ceMatchesServant } from '../atlas.js'
import { ceHasBondGain, isPlayableServant, isSvtBondCe } from '../game-data.js'

export const SOLVER_INDEX_VERSION = 1

const EXTRA_I = new Set(['ruler', 'avenger', 'moonCancer', 'shielder'])
const EXTRA_II = new Set(['alterEgo', 'foreigner', 'pretender', 'beast', 'unBeast', 'beastEresh', 'unBeastOlgaMarie'])
const ACCOUNT_KEYS = ['bondLevels', 'servantsOwned', 'craftEssencesOwned', 'mlbCount', 'friendship', 'account']

export function extraGroupOf(className) {
  if (EXTRA_I.has(className)) return 1
  if (EXTRA_II.has(className)) return 2
  return 0
}

export function traitSig(traitIds) {
  return (traitIds || [])
    .map((id) => Number(id))
    .filter((id) => id)
    .sort((a, b) => a - b)
    .join(',')
}

function traitCode(trait) {
  if (trait == null) return null
  return typeof trait === 'object' ? trait.id : trait
}

function hasCondition(fn) {
  return Boolean((fn && fn.tvals && fn.tvals.length) || (fn && fn.andTvals && fn.andTvals.length))
}

function condPayload(fn) {
  if (!fn || !hasCondition(fn)) return 0
  return {
    tvals: (fn.tvals || []).map(traitCode).filter((id) => id != null),
    andTvals: (fn.andTvals || []).map((group) => (group || []).map(traitCode).filter((id) => id != null)),
  }
}

function traitsOf(item) {
  if (!item) return []
  if (Array.isArray(item.traitIds)) return item.traitIds
  if (item.form && Array.isArray(item.form.traitIds)) return item.form.traitIds
  return []
}

function funcOf(ce, mlb) {
  const skill = pickCeSkill(ce, mlb)
  return (skill && skill.funcs && skill.funcs[0]) || null
}

export function ceMilliLive(ce, form, asSupport, mlb = true) {
  const fn = funcOf(ce, mlb)
  if (!fn) return 0
  if (asSupport && fn.applySupport === 0) return 0
  const milli = asSupport && fn.followerRate != null ? fn.followerRate : fn.rate || 0
  if (milli <= 0) return 0
  if (fn.target === 'self') return asSupport ? 0 : milli
  if (hasCondition(fn) && !ceMatchesServant(fn, traitsOf(form))) return 0
  return milli
}

function ratesOf(ce, mlb) {
  const fn = funcOf(ce, mlb)
  if (!fn) return { rate: 0, add: 0, followerRate: null }
  return {
    rate: Number(fn.rate) || 0,
    add: Number(fn.add) || 0,
    followerRate: fn.followerRate == null ? null : Number(fn.followerRate),
  }
}

function ceRecord(ce) {
  const mlbFn = funcOf(ce, true)
  return {
    id: ce.id,
    collectionNo: ce.collectionNo,
    name: ce.name,
    rarity: ce.rarity,
    cost: Number(ce.cost) || 0,
    portrait: mlbFn && Number(mlbFn.add) >= 50 ? 1 : 0,
    bond: ceHasBondGain(ce) ? 1 : 0,
    svtBond: isSvtBondCe(ce) ? 1 : 0,
    applySupport: mlbFn && mlbFn.applySupport === 0 ? 0 : null,
    target: (mlbFn && mlbFn.target) || 'ptFull',
    cond: condPayload(mlbFn),
    mlb: ratesOf(ce, true),
    unmlb: ratesOf(ce, false),
  }
}

function pickRate(pack, asSupport) {
  if (!pack) return 0
  const milli = asSupport && pack.followerRate != null ? pack.followerRate : pack.rate || 0
  return milli > 0 ? milli : 0
}

export function milliFromIndex(index, ce, form, asSupport, mlb = true) {
  if (!index || !ce) return null
  const rec = index.ceById ? index.ceById.get(ce.id) : null
  if (!rec) return null
  if (asSupport && rec.applySupport === 0) return 0
  const pack = mlb ? rec.mlb : rec.unmlb
  const milli = pickRate(pack, asSupport)
  if (!milli) return 0
  if (rec.target === 'self') return asSupport ? 0 : milli
  if (!rec.cond) return milli
  const sig = traitSig(traitsOf(form))
  const table = index.condHits[rec.id] || index.condHits[String(rec.id)]
  const row = table && table[sig]
  if (row) {
    const slot = (mlb ? 0 : 2) + (asSupport ? 1 : 0)
    return row[slot] || 0
  }
  if (index.sigSet && index.sigSet.has(sig)) return 0
  const svtId = form && form.svtId
  if (svtId && index.svtIdSet && index.svtIdSet.has(svtId)) return 0
  return null
}

export function hydrateSolverIndex(raw) {
  if (!raw || typeof raw !== 'object') return null
  const ceById = new Map()
  for (const ce of raw.ces || []) ceById.set(ce.id, ce)
  const svtIdSet = new Set((raw.servants || []).map((svt) => svt.id))
  const sigSet = new Set()
  for (const svt of raw.servants || []) {
    for (const form of svt.forms || []) sigSet.add(form.sig || traitSig(form.traitIds))
  }
  const condHits = {}
  for (const [ceId, table] of Object.entries(raw.condHits || {})) {
    condHits[ceId] = table
    const n = Number(ceId)
    if (Number.isFinite(n)) condHits[n] = table
  }
  return { ...raw, ceById, svtIdSet, sigSet, condHits }
}

export function buildSolverIndex({ servants = [], ces = [], version = null, formsOf } = {}) {
  if (typeof formsOf !== 'function') throw new Error('buildSolverIndex 需要 formsOf')
  const playable = (servants || []).filter(isPlayableServant)
  const bondCes = (ces || []).filter(ceHasBondGain)
  const servantRows = []
  const formEntries = []
  for (const svt of playable) {
    const forms = (formsOf(svt) || []).map((form) => ({
      key: form.key || 'default',
      name: form.name || form.key || '默认灵基',
      rarity: form.rarity != null ? form.rarity : svt.rarity,
      cost: Number(form.cost) || 0,
      attribute: form.attribute || svt.attribute,
      traitIds: (form.traitIds || []).slice(),
      sig: traitSig(form.traitIds || []),
    }))
    servantRows.push({
      id: svt.id,
      collectionNo: svt.collectionNo,
      className: svt.className,
      attribute: svt.attribute,
      rarity: svt.rarity,
      cost: Number(svt.cost) || 0,
      extra: extraGroupOf(svt.className),
      forms,
    })
    for (const form of forms) {
      formEntries.push({ svtId: svt.id, ...form })
    }
  }

  const ceRows = bondCes.map(ceRecord)
  const condHits = {}
  for (const rec of ceRows) {
    if (!rec.cond) continue
    const ce = bondCes.find((item) => item.id === rec.id)
    const table = {}
    for (const form of formEntries) {
      const o = ceMilliLive(ce, form, false, true)
      const s = ceMilliLive(ce, form, true, true)
      const o0 = ceMilliLive(ce, form, false, false)
      const s0 = ceMilliLive(ce, form, true, false)
      if (!o && !s && !o0 && !s0) continue
      const prev = table[form.sig]
      if (!prev) table[form.sig] = [o, s, o0, s0]
    }
    if (Object.keys(table).length) condHits[String(rec.id)] = table
  }

  return {
    schemaVersion: 1,
    solverIndexVersion: SOLVER_INDEX_VERSION,
    gameDataVersion: (version && (version.dataVersion || version.updatedAt)) || '',
    sourceVersion: (version && version.sourceVersion) || '',
    region: (version && version.region) || '',
    builtAt: new Date().toISOString(),
    servantCount: servantRows.length,
    ceCount: ceRows.length,
    formCount: formEntries.length,
    servants: servantRows,
    ces: ceRows,
    condHits,
  }
}

export function validateSolverIndex(index, { servants = [], ces = [], version = null, formsOf = null } = {}) {
  const errors = []
  if (!index || typeof index !== 'object') return { ok: false, errors: ['solver index 缺失'] }
  if (index.solverIndexVersion !== SOLVER_INDEX_VERSION) errors.push('solverIndexVersion 不匹配')
  if (!Array.isArray(index.servants)) errors.push('servants 必须是数组')
  if (!Array.isArray(index.ces)) errors.push('ces 必须是数组')
  if (index.condHits == null || typeof index.condHits !== 'object' || Array.isArray(index.condHits)) {
    errors.push('condHits 必须是对象')
  }
  for (const key of ACCOUNT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(index, key)) errors.push(`Index 含账号字段 ${key}`)
  }
  if (version && index.gameDataVersion && version.dataVersion && index.gameDataVersion !== version.dataVersion) {
    errors.push('gameDataVersion 与 version.json 不一致')
  }
  const ceIds = new Set((index.ces || []).map((ce) => ce.id))
  const bondCes = (ces || []).filter(ceHasBondGain)
  for (const ce of bondCes) {
    if (!ceIds.has(ce.id)) errors.push(`缺少礼装 ${ce.id}`)
  }
  const svtIds = new Set((index.servants || []).map((svt) => svt.id))
  const playable = (servants || []).filter(isPlayableServant)
  for (const svt of playable) {
    if (!svtIds.has(svt.id)) errors.push(`缺少从者 ${svt.id}`)
  }
  if (errors.length > 12) {
    const extra = errors.length - 8
    errors.splice(8, errors.length, `另有 ${extra} 条缺失`)
  }

  let mismatch = 0
  if (typeof formsOf === 'function' && !errors.length) {
    const hydrated = hydrateSolverIndex(index)
    outer: for (const svt of playable) {
      for (const form of formsOf(svt) || []) {
        const row = { ...form, svtId: svt.id }
        for (const ce of bondCes) {
          for (const asSupport of [false, true]) {
            for (const mlb of [true, false]) {
              const live = ceMilliLive(ce, row, asSupport, mlb)
              const indexed = milliFromIndex(hydrated, ce, row, asSupport, mlb)
              if (indexed !== live) {
                mismatch += 1
                if (mismatch <= 5) {
                  errors.push(`命中不一致 ce=${ce.id} svt=${svt.id} form=${form.key} support=${asSupport} mlb=${mlb} live=${live} index=${indexed}`)
                }
                if (mismatch >= 20) break outer
              }
            }
          }
        }
      }
    }
    if (mismatch > 5) errors.push(`命中不一致共计 ${mismatch}`)
  }

  return {
    ok: !errors.length,
    errors,
    servantCount: (index.servants || []).length,
    ceCount: (index.ces || []).length,
    formCount: index.formCount || 0,
    mismatch,
  }
}
