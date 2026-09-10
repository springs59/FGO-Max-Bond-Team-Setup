import { calcParty } from './bond.js'
import { applyCraftEssences, ceMatchesServant, classLabel, pickCeSkill } from './atlas.js'
import { isPlayableServant } from './game-data.js'
import { filterServants, matchRosterForm, matchRosterServant, rosterFilterActive } from './filter.js'

const TEA_NO = 910

export function blankRecommendSlot(position, filled) {
  return {
    position,
    filled,
    isSupport: false,
    bond15: false,
    lunch: 0,
    teaSelf: 0,
    supportTea: 0,
    holmes: 0,
    condCe: 0,
    eventPassive: 0,
    customPercent: 0,
    portrait: false,
    label: '',
    svtId: 0,
    face: '',
    className: '',
    attribute: '',
    traitIds: [],
    ceId: 0,
    ceMlb: true,
    isGrand: false,
    ceBondId: 0,
    ceRewardId: 0,
    ceBondMlb: true,
    ceRewardMlb: true,
    ceLines: [],
    ceMiss: '',
    svtQuery: '',
    ceQuery: '',
    svtArts: [],
    svtArtKey: '',
    svtImgOk: true,
    ceImgOk: true,
    formLabel: '默认灵基',
    ceBondQuery: '',
    ceRewardQuery: '',
    ceBondImgOk: true,
    ceRewardImgOk: true,
  }
}

function mlbFunc(ce) {
  const skill = ce && pickCeSkill(ce, true)
  return (skill && skill.funcs && skill.funcs[0]) || null
}

function isPortrait(ce) {
  const fn = mlbFunc(ce)
  return Boolean(fn && fn.add >= 50)
}

export function svtCostOf(svt) {
  if (!svt) return 0
  if (arguments.length > 1 && arguments[1] && arguments[1].cost != null && arguments[1].cost !== '') {
    return Number(arguments[1].cost) || 0
  }
  if (svt.cost != null && svt.cost !== '') return Number(svt.cost) || 0
  if (svt.collectionNo === 1) return 0
  return [0, 3, 4, 7, 12, 16][svt.rarity] ?? 16
}

export function ceCostOf(ce) {
  if (!ce) return 0
  if (ce.cost != null && ce.cost !== '') return Number(ce.cost) || 0
  return [0, 1, 3, 5, 9, 12][ce.rarity] ?? 12
}

export function partyCostOf(slots, servants, ces) {
  const svtMap = new Map((servants || []).map((item) => [item.id, item]))
  const ceMap = new Map((ces || []).map((item) => [item.id, item]))
  let sum = 0
  for (const slot of slots || []) {
    if (!slot.filled || slot.isSupport) continue
    const rec = svtMap.get(slot.svtId)
    const form = rec && slot.svtArtKey ? (rec.forms || []).find((item) => item.key === slot.svtArtKey) : null
    sum += svtCostOf(rec, form)
    sum += ceCostOf(ceMap.get(Number(slot.ceId) || slot.ceId))
  }
  return sum
}

const EXTRA_I = new Set(['ruler', 'avenger', 'moonCancer', 'shielder'])
const EXTRA_II = new Set(['alterEgo', 'foreigner', 'pretender', 'beast', 'unBeast', 'beastEresh', 'unBeastOlgaMarie'])

function classOk(svt, questClass) {
  if (!questClass) return true
  if (!svt) return false
  if (questClass === 'extra1') return EXTRA_I.has(svt.className)
  if (questClass === 'extra2') return EXTRA_II.has(svt.className)
  return svt.className === questClass
}

function isBondCe(ce) {
  const fn = mlbFunc(ce)
  return Boolean(fn && fn.rate > 0)
}

function hasCondition(fn) {
  return Boolean((fn.tvals && fn.tvals.length) || (fn.andTvals && fn.andTvals.length))
}

function ownedIds(account, key) {
  return new Set(((account && account[key]) || []).map((item) => item.id))
}

function farmerPool(servants, account, mode) {
  if (mode !== 'account') return servants.slice()
  const owned = ownedIds(account, 'servants')
  const maxed = new Set((account.servants || []).filter((item) => item.bondLv >= 15).map((item) => item.id))
  return servants.filter((svt) => owned.has(svt.id) && !maxed.has(svt.id))
}

function cePool(ces, account, mode, supportSlot) {
  if (supportSlot || mode !== 'account') return ces.filter((ce) => isBondCe(ce) && !isPortrait(ce))
  const owned = ownedIds(account, 'ces')
  return ces.filter((ce) => owned.has(ce.id) && isBondCe(ce) && !isPortrait(ce))
}

function mlbOf(ce, account, mode, supportSlot) {
  if (supportSlot || mode !== 'account' || !account) return true
  const rec = (account.ces || []).find((item) => item.id === ce.id)
  return rec ? Boolean(rec.mlb) : true
}

function bondLvOf(svt, account) {
  if (!account) return 0
  const rec = (account.servants || []).find((item) => item.id === svt.id)
  return rec ? Number(rec.bondLv) || 0 : 0
}

function traitsOf(item) {
  if (!item) return []
  if (Array.isArray(item.traitIds)) return item.traitIds
  if (item.form && Array.isArray(item.form.traitIds)) return item.form.traitIds
  return []
}

function findSvts(list, ids) {
  const out = []
  const missing = []
  for (const raw of ids || []) {
    const id = Number(raw)
    const svt = (list || []).find((item) => item.id === id)
    if (svt) out.push(svt)
    else missing.push(id)
  }
  return { out, missing }
}

function missingOnlyFiltered(ids, catalog, filter) {
  if (!rosterFilterActive(filter) || !(ids || []).length) return false
  return ids.every((id) => {
    const svt = (catalog || []).find((item) => item.id === id)
    return svt && !matchRosterServant(svt, filter)
  })
}

function expandFormRows(svts, filter) {
  const out = []
  for (const svt of svts || []) {
    const seen = new Set()
    for (const form of servantBondForms(svt)) {
      if (!matchRosterForm(svt, form, filter)) continue
      const sig = [
        form.key || 'default',
        form.rarity,
        form.cost,
        form.attribute,
        (form.traitIds || []).slice().sort((a, b) => a - b).join(','),
      ].join('|')
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({ svt, form })
    }
  }
  return out
}

function formForAnchor(svt, ce, filter) {
  const forms = servantBondForms(svt)
  const usable = forms.filter((form) => matchRosterForm(svt, form, filter))
  if (!usable.length) return { key: 'default', name: '默认灵基', traitIds: svt.traitIds || [] }
  if (!ce) return usable[0]
  let best = usable[0]
  let bestScore = formScore(best, [ce])
  for (const form of usable.slice(1)) {
    const score = formScore(form, [ce])
    if (score.rate > bestScore.rate || (score.rate === bestScore.rate && score.hits > bestScore.hits)) {
      best = form
      bestScore = score
    }
  }
  return best
}

function orderFarmers(preferRows, lockRows, fillerRows) {
  const out = []
  const seen = new Set()
  for (const row of [...preferRows, ...lockRows, ...fillerRows]) {
    if (!row || !row.svt || seen.has(row.svt.id)) continue
    seen.add(row.svt.id)
    out.push(row)
  }
  return out
}

function layoutSlots(farmers, useSupport, grand) {
  const slots = [1, 2, 3, 4, 5, 6].map((position) => blankRecommendSlot(position, false))
  const ownCap = useSupport ? 5 : 6
  const seated = (farmers || []).slice(0, ownCap)
  seated.slice(0, 3).forEach((row, index) => applySvt(slots[index], row.svt, row.form))
  seated.slice(3).forEach((row, index) => applySvt(slots[3 + index], row.svt, row.form))
  if (useSupport) applySupportSlot(slots[5], grand)
  if (grand) {
    const grandSlot = slots.find((slot) => slot.filled && !slot.isSupport && slot.position <= 3)
    if (grandSlot) grandSlot.isGrand = true
  }
  return slots
}

export function comparePlans(left, right) {
  if (left.preferBond !== right.preferBond) return right.preferBond - left.preferBond
  if (left.total !== right.total) return right.total - left.total
  if (left.bond15Count !== right.bond15Count) return left.bond15Count - right.bond15Count
  const gapL = Math.abs((left.costLimit || 0) - (left.costUsed || 0))
  const gapR = Math.abs((right.costLimit || 0) - (right.costUsed || 0))
  return gapL - gapR
}

export function betterTarget(left, right) {
  if ((left.preferBond || 0) !== (right.preferBond || 0)) return (left.preferBond || 0) > (right.preferBond || 0)
  if ((left.total || 0) !== (right.total || 0)) return (left.total || 0) > (right.total || 0)
  if ((left.bond15Count || 0) !== (right.bond15Count || 0)) return (left.bond15Count || 0) < (right.bond15Count || 0)
  return false
}

export function paretoByCost(plans) {
  const bestAt = new Map()
  for (const plan of uniquePlans(plans)) {
    const cost = plan.costUsed || 0
    const prev = bestAt.get(cost)
    if (!prev || comparePlans(plan, prev) < 0) bestAt.set(cost, plan)
  }
  const ordered = [...bestAt.keys()].sort((a, b) => a - b).map((cost) => bestAt.get(cost))
  const out = []
  for (const plan of ordered) {
    if (!out.length || betterTarget(plan, out[out.length - 1])) out.push(plan)
  }
  out.reverse()
  return out
}

export function pickCostPlan(plans, focusCost) {
  if (!plans.length) return 0
  if (!Number.isInteger(focusCost) || focusCost < 0) return 0
  let best = -1
  for (let i = 0; i < plans.length; i++) {
    if ((plans[i].costUsed || 0) > focusCost) continue
    if (best < 0 || comparePlans(plans[i], plans[best]) < 0) {
      best = i
    }
  }
  if (best >= 0) return best
  let minI = 0
  for (let i = 1; i < plans.length; i++) {
    const cost = plans[i].costUsed || 0
    const minCost = plans[minI].costUsed || 0
    if (cost < minCost || (cost === minCost && comparePlans(plans[i], plans[minI]) < 0)) minI = i
  }
  return minI
}

function planFingerprint(plan) {
  return (plan.slots || [])
    .map((slot) =>
      slot.filled
        ? `${slot.position}:${slot.svtId}:${slot.svtArtKey || 'd'}:${slot.isSupport ? 1 : 0}:${slot.ceId}:${slot.ceBondId || 0}:${slot.ceRewardId || 0}`
        : `${slot.position}:0`,
    )
    .join('|')
}

function uniquePlans(plans) {
  const seen = new Set()
  const out = []
  for (const plan of plans || []) {
    const key = planFingerprint(plan)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(plan)
  }
  return out
}

function ceNameOf(ces, id) {
  const ce = (ces || []).find((item) => item.id === id)
  return ce ? ce.name : '礼装'
}

function grandCeLine(slots, ces) {
  const grands = (slots || []).filter((item) => item.isGrand && item.filled)
  if (!grands.length) return ''
  return `${grands
    .map((slot) => {
      const who = slot.isSupport ? '助战冠位' : `冠位 ${slot.label || '从者'}`
      const parts = [who]
      if (slot.ceId) parts.push(`普通礼装 ${ceNameOf(ces, slot.ceId)}`)
      if (!slot.isSupport) parts.push('羁绊礼装为该从者10绊礼装，通关羁绊不加')
      if (slot.ceRewardId) parts.push(`报酬礼装 ${ceNameOf(ces, slot.ceRewardId)}（免费）`)
      return parts.join(' · ')
    })
    .join('。')}。`
}

function condBondCes(available) {
  const seen = new Set()
  const out = []
  for (const ce of available || []) {
    if (!ce || ce.collectionNo === TEA_NO) continue
    const fn = mlbFunc(ce)
    if (!fn || !hasCondition(fn) || !(fn.rate > 0)) continue
    const key = condKey(fn)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ce)
  }
  return out
}

function condKey(fn) {
  const tvals = (fn.tvals || []).map((item) => item.id || item.value || item.name).join(',')
  const ands = (fn.andTvals || [])
    .map((group) => (group || []).map((item) => item.id || item.value || item.name).join('+'))
    .join('|')
  return `${fn.rate || 0}:${tvals}:${ands}`
}

function byCostThenNo(rows) {
  return (rows || []).slice().sort(
    (a, b) =>
      svtCostOf(a.svt, a.form) - svtCostOf(b.svt, b.form) ||
      a.svt.collectionNo - b.svt.collectionNo ||
      formRank(a) - formRank(b),
  )
}

function formRank(row) {
  const key = row && row.form && row.form.key
  return !key || key === 'default' ? 0 : 1
}

function splitByAnchor(rows, ce) {
  if (!ce) return { hit: (rows || []).slice(), miss: [] }
  const fn = mlbFunc(ce)
  const hit = []
  const miss = []
  for (const row of rows || []) {
    const ok = ceMatchesServant(fn, (row.form && row.form.traitIds) || [])
    if (ok) hit.push(row)
    else miss.push(row)
  }
  return { hit, miss }
}

export function servantBondForms(svt) {
  const base = svt.traitIds || []
  const forms = [
    {
      key: 'default',
      name: '默认灵基',
      traitIds: base.slice(),
      rarity: svt.rarity,
      cost: svtCostOf(svt),
      attribute: svt.attribute,
    },
  ]
  const seen = new Set(['default'])
  for (const form of svt.forms || []) {
    const key = form.key || ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    const traitIds = form.traitIds && form.traitIds.length ? form.traitIds : base
    forms.push({
      key,
      name: form.name || key,
      traitIds: traitIds.slice(),
      rarity: form.rarity != null ? form.rarity : svt.rarity,
      cost: form.cost != null ? form.cost : svtCostOf(svt),
      attribute: form.attribute || svt.attribute,
    })
  }
  return forms
}

export function bestBondForm(svt, ces) {
  const cond = (ces || []).filter((ce) => hasCondition(mlbFunc(ce)))
  let best = null
  for (const form of servantBondForms(svt)) {
    const score = formScore(form, cond)
    if (!best || score.rate > best.score.rate || (score.rate === best.score.rate && score.hits > best.score.hits)) {
      best = { form, score }
    }
  }
  return best.form
}

function formScore(form, ces) {
  let rate = 0
  let hits = 0
  for (const ce of ces || []) {
    const fn = mlbFunc(ce)
    if (!fn || !hasCondition(fn)) continue
    if (!ceMatchesServant(fn, form.traitIds)) continue
    rate += fn.rate || 0
    hits += 1
  }
  return { rate, hits }
}

function applySvt(slot, svt, form) {
  const picked = form || { key: 'default', name: '默认灵基', traitIds: svt.traitIds || [] }
  slot.svtId = svt.id
  slot.label = svt.name
  slot.face = svt.face
  slot.className = svt.className
  slot.attribute = picked.attribute || svt.attribute
  slot.rarity = picked.rarity != null ? picked.rarity : svt.rarity
  slot.traitIds = picked.traitIds || []
  slot.formLabel = picked.name || '默认灵基'
  slot.svtArtKey = picked.key && picked.key !== 'default' ? picked.key : ''
  slot.filled = true
}

function applySupportSlot(slot, grand) {
  slot.filled = true
  slot.isSupport = true
  slot.isGrand = Boolean(grand)
  slot.svtId = 0
  slot.label = '助战'
  slot.face = ''
  slot.className = ''
  slot.attribute = ''
  slot.traitIds = []
  slot.formLabel = ''
  slot.svtArtKey = ''
}

function applyCe(slot, ce, mlb) {
  slot.ceId = ce.id
  slot.ceMlb = mlb
}

function condNeed(fn) {
  const names = []
  for (const trait of fn.tvals || []) names.push(trait.name)
  for (const group of fn.andTvals || []) {
    for (const trait of group) names.push(trait.name)
  }
  return names.join(' + ')
}

export function explainFormBonuses(slot, partySlots, ces, result) {
  const catalog = new Map(ces.map((ce) => [ce.id, ce]))
  const hits = (result && result.lines) || []
  const misses = []
  if (slot.isSupport) {
    return { title: `${slot.label || '助战'} · ${classLabel(slot.className)} · ${slot.formLabel}`, hits, misses, final: 0 }
  }
  for (const wearer of partySlots) {
    if (!wearer.filled) continue
    for (const ceId of [wearer.ceId, wearer.ceBondId, wearer.ceRewardId]) {
      if (!ceId) continue
      const ce = catalog.get(ceId)
      const fn = mlbFunc(ce)
      if (!fn || !hasCondition(fn)) continue
      if (ceMatchesServant(fn, slot.traitIds)) continue
      misses.push(`${ce.name}${wearer.isSupport ? '（助战）' : ''} 未对上（需要 ${condNeed(fn)}，当前灵基没有）`)
    }
  }
  return {
    title: `${slot.label} · ${classLabel(slot.className)} · ${slot.formLabel}`,
    hits,
    misses,
    final: result && result.eligible ? result.final : 0,
  }
}

export function recommendTeam({
  base,
  teapot = false,
  servants = [],
  ces = [],
  account = null,
  mode = 'free',
  allowSupport = true,
  preferSvtIds = [],
  lockSvtIds = [],
  questType = 'normal',
  questClass = '',
  costLimit = null,
  filter = null,
} = {}) {
  if (!Number.isInteger(base) || base < 0) {
    return { ok: false, error: '请输入非负整数作为关卡基础羁绊' }
  }
  const catalog = (servants || []).filter(isPlayableServant)
  servants = rosterFilterActive(filter) ? filterServants(catalog, filter) : catalog
  const focusCost = Number.isInteger(costLimit) && costLimit >= 0 ? costLimit : null
  if (questType === 'grand' && !questClass) {
    return { ok: false, error: '冠位战请选择职阶' }
  }
  if (mode === 'account' && !account) {
    return { ok: false, error: '账号配队请先导入 Chaldea JSON 或登录回包 PHP，或改用自由配队' }
  }
  const preferIds = (preferSvtIds || []).map(Number).filter((id) => id)
  const lockIds = (lockSvtIds || []).map(Number).filter((id) => id)
  if (preferIds.length > 5) return { ok: false, error: '练度从者最多 5 名' }
  if (lockIds.length > 5) return { ok: false, error: '锁定超出编队上限' }
  for (const id of [...preferIds, ...lockIds]) {
    const svt = servants.find((item) => item.id === id)
    if (svt && !classOk(svt, questClass || '')) {
      return { ok: false, error: '该从者无法在此副本上场' }
    }
  }

  const className = questClass || ''
  const pool = farmerPool(servants, account, mode).filter((svt) => classOk(svt, className))
  const owned = (mode === 'account' ? servants.filter((svt) => ownedIds(account, 'servants').has(svt.id)) : servants).filter(
    (svt) => classOk(svt, className),
  )

  for (const id of preferIds) {
    const svt = servants.find((item) => item.id === id)
    if (svt && bondLvOf(svt, account) >= 15 && mode === 'account') {
      return { ok: false, error: '该从者本人拿不到羁绊' }
    }
  }

  const preferHit = findSvts(pool, preferIds)
  if (preferHit.missing.length && !missingOnlyFiltered(preferHit.missing, catalog, filter)) {
    return { ok: false, error: '该练度从者无法上场' }
  }
  const lockHit = findSvts(owned, lockIds)
  if (lockHit.missing.length && !missingOnlyFiltered(lockHit.missing, catalog, filter)) {
    return { ok: false, error: '该锁定无法满足' }
  }
  const lockFarmers = lockHit.out.filter((svt) => bondLvOf(svt, account) < 15 || mode !== 'account')
  if (lockFarmers.length !== lockHit.out.length) return { ok: false, error: '该锁定无法满足' }
  if (!pool.length) {
    return { ok: false, error: rosterFilterActive(filter) ? '筛选后没有可拿羁绊的从者' : '没有可拿羁绊的从者' }
  }

  const ownCes = cePool(ces, account, mode, false)
  const supportCes = cePool(ces, account, mode, true)
  const plans = []
  let lastError = '锁定超出编队上限'
  const trySupport = allowSupport ? [true] : [false]
  for (const useSupport of trySupport) {
    const cap = useSupport ? 5 : 6
    const mustIds = new Set([...preferHit.out, ...lockFarmers].map((svt) => svt.id))
    if (mustIds.size > cap) continue
    const plan = buildPlan({
      base,
      teapot,
      servants,
      ces,
      account,
      mode,
      useSupport,
      pool,
      ownCes,
      supportCes,
      preferSvts: preferHit.out,
      lockSvts: lockFarmers,
      questType,
      questClass: className,
      costLimit,
      filter,
    })
    if (plan && plan.ok) plans.push(...(plan.plans || [plan]))
    else if (plan && plan.error) lastError = plan.error
  }
  if (!plans.length) return { ok: false, error: lastError }
  const uniq = paretoByCost(plans)
  const chosen = pickCostPlan(uniq, focusCost)
  const best = uniq[chosen]
  best.rows = best.slots
    .filter((slot) => slot.filled && !slot.isSupport)
    .map((slot) => {
      const svt = servants.find((item) => item.id === slot.svtId)
      if (svt) slot.label = svt.name
      const result = best.output.results.find((item) => item.position === slot.position)
      return explainFormBonuses(slot, best.slots, ces, result)
    })
  best.plans = uniq
  best.chosen = chosen
  best.focusCost = focusCost
  if (rosterFilterActive(filter) && best.summary) best.summary += '已按筛选屏蔽从者。'
  return best
}

function takeWithinCost(mustRows, fillerRows, cap, costLimit) {
  const out = []
  let spent = 0
  for (const row of [...mustRows, ...fillerRows]) {
    if (out.length >= cap) break
    if (out.some((item) => item.svt.id === row.svt.id)) continue
    const c = svtCostOf(row.svt, row.form)
    if (spent + c > costLimit) {
      if (mustRows.some((item) => item.svt.id === row.svt.id)) return { ok: false, spent, farmers: out }
      continue
    }
    out.push(row)
    spent += c
  }
  return { ok: true, farmers: out, spent }
}

function applyRateMilli(value, milli) {
  if (!milli) return value
  return Math.floor((value * (1000 + milli)) / 1000)
}

function ceMilliOn(ce, form, asSupport) {
  const fn = mlbFunc(ce)
  if (!fn) return 0
  if (asSupport && fn.applySupport === 0) return 0
  const milli = asSupport && fn.followerRate != null ? fn.followerRate : fn.rate || 0
  if (milli <= 0) return 0
  if (fn.target === 'self') return asSupport ? 0 : milli
  if (hasCondition(fn) && !ceMatchesServant(fn, traitsOf(form))) return 0
  return milli
}

function eachSubset(arr, maxK, visit) {
  const pick = []
  function rec(start) {
    visit(pick)
    if (pick.length >= maxK) return
    for (let i = start; i < arr.length; i++) {
      pick.push(arr[i])
      rec(i + 1)
      pick.pop()
    }
  }
  rec(0)
}

function dedupeHitCands(cands) {
  const best = new Map()
  for (const cand of cands) {
    const key = cand.hits.join(',')
    const prev = best.get(key)
    if (
      !prev ||
      cand.cost < prev.cost ||
      (cand.cost === prev.cost && cand.ce.collectionNo < prev.ce.collectionNo)
    ) {
      best.set(key, cand)
    }
  }
  return [...best.values()]
}

function makeCeCands(ces, forms, asSupport) {
  const out = []
  for (const ce of ces || []) {
    const hits = forms.map((form) => ceMilliOn(ce, form, asSupport))
    if (!hits.some((milli) => milli > 0)) continue
    out.push({ ce, hits, cost: asSupport ? 0 : ceCostOf(ce) })
  }
  return dedupeHitCands(out)
}

function splitGrandOwn(ownPick, ownSlotCount, grand) {
  if (!grand || !ownPick.length) return { normal: ownPick, reward: null }
  const sorted = ownPick.slice().sort((a, b) => b.cost - a.cost || a.ce.collectionNo - b.ce.collectionNo)
  const reward = sorted[0]
  const rest = sorted.slice(1)
  if (rest.length > ownSlotCount) return null
  return { normal: rest, reward }
}

function searchCeLoadouts({
  base,
  teapot,
  farmers,
  useSupport,
  ownCes,
  supportCes,
  grand,
  preferSvts,
  servants,
  ces,
}) {
  const formed = farmers.map((row) => ({
    svt: row.svt,
    form: row.form || formForAnchor(row.svt, null),
  }))
  const slots0 = layoutSlots(formed, useSupport, grand)
  const ownSlots = slots0.filter((slot) => slot.filled && !slot.isSupport)
  const forms = ownSlots.map((slot) => ({ traitIds: slot.traitIds, position: slot.position, svtId: slot.svtId }))
  const afterFront = forms.map((form) => applyRateMilli(base, form.position <= 3 ? 200 : 0))
  const preferSet = new Set((preferSvts || []).map((svt) => svt.id))
  const teapotMul = teapot ? 2 : 1
  const svtCost = partyCostOf(slots0, servants, ces)
  const ownCands = makeCeCands(ownCes, forms, false)
  const supCands = useSupport ? makeCeCands(supportCes, forms, true) : []
  const ownCap = ownSlots.length + (grand && ownSlots.some((slot) => slot.isGrand) ? 1 : 0)
  const best = new Map()

  function consider(ownPick, sup, sup2) {
    if (sup && sup2) {
      const sumA = sup.hits.reduce((sum, milli) => sum + milli, 0)
      const sumB = sup2.hits.reduce((sum, milli) => sum + milli, 0)
      if (sumB > sumA) {
        const swap = sup
        sup = sup2
        sup2 = swap
      }
    }
    const split = splitGrandOwn(ownPick, ownSlots.length, grand)
    if (!split) return
    const add = afterFront.map(() => 0)
    for (const cand of ownPick) {
      for (let i = 0; i < add.length; i++) add[i] += cand.hits[i]
    }
    if (sup) {
      for (let i = 0; i < add.length; i++) add[i] += sup.hits[i]
    }
    if (sup2) {
      for (let i = 0; i < add.length; i++) add[i] += sup2.hits[i]
    }
    let total = 0
    let preferBond = 0
    for (let i = 0; i < forms.length; i++) {
      const bond = applyRateMilli(afterFront[i], add[i]) * teapotMul
      total += bond
      if (preferSet.has(forms[i].svtId)) preferBond += bond
    }
    const ceCost = split.normal.reduce((sum, cand) => sum + cand.cost, 0)
    const costUsed = svtCost + ceCost
    const next = {
      total,
      preferBond,
      bond15Count: 0,
      costUsed,
      ownNormal: split.normal.map((cand) => cand.ce),
      ownReward: split.reward ? split.reward.ce : null,
      support: sup ? sup.ce : null,
      supportReward: sup2 ? sup2.ce : null,
    }
    const prev = best.get(costUsed)
    if (!prev || betterTarget(next, prev)) best.set(costUsed, next)
  }

  eachSubset(ownCands, ownCap, (pick) => {
    const ownPick = pick.slice()
    if (!useSupport) {
      consider(ownPick, null, null)
      return
    }
    if (!supCands.length) {
      consider(ownPick, null, null)
      return
    }
    if (!grand) {
      for (const sup of supCands) consider(ownPick, sup, null)
      return
    }
    for (let i = 0; i < supCands.length; i++) {
      consider(ownPick, supCands[i], null)
      for (let j = i + 1; j < supCands.length; j++) consider(ownPick, supCands[i], supCands[j])
    }
  })

  return [...best.values()]
}

function buildPlan({
  base,
  teapot,
  servants,
  ces,
  account,
  mode,
  useSupport,
  pool,
  ownCes,
  supportCes,
  preferSvts,
  lockSvts,
  questType = 'normal',
  questClass = '',
  costLimit = 113,
  filter = null,
}) {
  const cap = useSupport ? 5 : 6
  const grand = questType === 'grand'
  const mustSvts = [
    ...preferSvts,
    ...lockSvts.filter((svt) => !preferSvts.some((item) => item.id === svt.id)),
  ]
  const exclude = new Set(mustSvts.map((svt) => svt.id))
  if (exclude.size > cap) return { ok: false, error: '锁定超出编队上限' }
  const minN = mustSvts.length
  const startN = minN === 0 ? 1 : minN
  const found = []
  let lastError = '没有可拿羁绊的从者'
  const seenMix = new Set()
  const freeRows = expandFormRows(
    pool.filter((svt) => !exclude.has(svt.id)),
    filter,
  )
  const anchors = preferSvts.length ? [null] : [null, ...condBondCes(ownCes)]
  for (const anchor of anchors) {
    const mustRows = mustSvts.map((svt) => ({ svt, form: formForAnchor(svt, anchor, filter) }))
    const { hit, miss } = splitByAnchor(freeRows, anchor)
    const cheapHit = byCostThenNo(hit)
    const cheapMiss = byCostThenNo(miss)
    const cheapAll = byCostThenNo(freeRows)
    if (anchor && !cheapHit.length) continue
    for (let n = startN; n <= cap; n++) {
      const mixes = []
      if (!anchor) mixes.push(cheapAll)
      else {
        const mHi = Math.min(n, cheapHit.length)
        for (let m = 1; m <= mHi; m++) mixes.push([...cheapHit.slice(0, m), ...cheapMiss])
      }
      for (const fillers of mixes) {
        const taken = takeWithinCost(mustRows, fillers, n, Infinity)
        if (!taken.ok) continue
        if (taken.farmers.length < minN || !taken.farmers.length) continue
        const farmers = orderFarmers(mustRows, [], taken.farmers)
        const mixKey = farmers.map((row) => `${row.svt.id}:${(row.form && row.form.key) || 'd'}`).join(',')
        if (seenMix.has(mixKey)) continue
        seenMix.add(mixKey)
        const loadouts = searchCeLoadouts({
          base,
          teapot,
          farmers,
          useSupport,
          ownCes,
          supportCes,
          grand,
          preferSvts,
          servants,
          ces,
        })
        for (const loadout of loadouts) {
          found.push(
            assemblePlan({
              base,
              teapot,
              servants,
              ces,
              account,
              mode,
              useSupport,
              farmers,
              loadout,
              preferSvts,
              questType,
              questClass,
              costLimit,
              grand,
            }),
          )
        }
      }
    }
  }
  const plans = uniquePlans(found)
  if (!plans.length) return { ok: false, error: lastError }
  plans.sort(comparePlans)
  return { ok: true, error: '', plans }
}

function assemblePlan({
  base,
  teapot,
  servants,
  ces,
  account,
  mode,
  useSupport,
  farmers,
  loadout,
  preferSvts,
  questType,
  questClass,
  costLimit,
  grand,
}) {
  const formed = farmers.map((row) => ({
    svt: row.svt,
    form: row.form || formForAnchor(row.svt, null),
  }))
  const slots = layoutSlots(formed, useSupport, grand)
  const own = slots.filter((slot) => slot.filled && !slot.isSupport)
  const picked = (loadout && loadout.ownNormal) || []
  picked.forEach((ce, index) => {
    if (own[index]) applyCe(own[index], ce, mlbOf(ce, account, mode, false))
  })
  if (loadout && loadout.ownReward) {
    const grandOwn = slots.find((slot) => slot.isGrand && slot.filled && !slot.isSupport)
    if (grandOwn) grandOwn.ceRewardId = loadout.ownReward.id
  }
  const supportSlot = slots.find((slot) => slot.isSupport)
  if (supportSlot && loadout && loadout.support) applyCe(supportSlot, loadout.support, true)
  if (supportSlot && loadout && loadout.supportReward) supportSlot.ceRewardId = loadout.supportReward.id
  applyCraftEssences(slots, ces)
  const output = calcParty(base, teapot, slots)
  const preferSet = new Set(preferSvts.map((svt) => svt.id))
  let total = 0
  let preferBond = 0
  let bond15Count = 0
  for (const slot of slots) {
    if (slot.bond15 && slot.filled && !slot.isSupport) bond15Count += 1
    const result = output.results.find((item) => item.position === slot.position)
    if (result && result.eligible) {
      total += result.final
      if (preferSet.has(slot.svtId)) preferBond += result.final
    }
  }
  const support = slots.find((slot) => slot.isSupport && slot.filled)
  const preferFront = slots.filter((slot) => preferSet.has(slot.svtId) && slot.position <= 3).map((slot) => slot.label)
  const preferBack = slots
    .filter((slot) => preferSet.has(slot.svtId) && slot.position > 3 && !slot.isSupport)
    .map((slot) => slot.label)
  const costUsed = partyCostOf(slots, servants, ces)
  const empty = slots.filter((slot) => !slot.filled).length
  const ownCount = slots.filter((slot) => slot.filled && !slot.isSupport).length
  const summary = [
    preferSvts.length ? '一键推荐：练度羁绊优先，再总羁绊。' : '一键推荐：按总羁绊从高到低列出帕累托方案。',
    grand
      ? `冠位战 · ${classLabel(questClass) || questClass}。${questClass === 'extra1' || questClass === 'extra2' ? 'Extra 冠位栏己方只上 1 骑。' : ''}冠位 3 礼装位可叠 8 张。羁绊礼装为该从者10绊礼装，通关羁绊不加。${grandCeLine(slots, ces)}`
      : questClass
        ? `职阶限制 ${classLabel(questClass)}。`
        : '普通编队。',
    `上场 ${ownCount} 人。COST ${costUsed}。`,
    empty ? `空槽 ${empty}。` : '',
    useSupport
      ? grand
        ? `助战冠位后排不上从者，普通+报酬礼装光环给己方，只算己方羁绊，前排己方 +20%。`
        : `助战固定后排不上从者，只给${support && support.ceId ? ceNameOf(ces, support.ceId) : '助战礼装'}（按助战倍率给己方），只算己方最多 5 人羁绊，前排己方 +20%。`
      : '不开助战，先填前排再填后排。',
    preferFront.length ? `练度从者前排：${preferFront.join('、')}。` : '',
    preferBack.length ? `练度超出前排，后排：${preferBack.join('、')}。` : '',
    '条件礼装按上场队伍结算：20% 命中过半时优先于午餐 10%。',
    '己方与助战的同名礼装各记一笔，分开展示和加算。',
    '礼装组合按实际通关羁绊穷举，取总羁绊最高。',
    '礼装可不上；填写 COST 时只在范围内取羁绊最高。',
    '每个灵基/灵衣是一套独立特性；编队按特性进组，礼装按已上场形态的特质结算。同一从者不同形态会作为不同方案竞争。',
    preferSvts.length ? `练度羁绊 ${preferBond}，总羁绊 ${total}。` : `总羁绊 ${total}。`,
  ]
    .filter(Boolean)
    .join('')
  return { ok: true, error: '', slots, summary, total, preferBond, bond15Count, output, useSupport, costUsed, costLimit, questType, questClass }
}
