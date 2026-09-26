import { SOLUTION_INDEX_VERSION } from '../rules/versions.js'
import { matchRosterServant, rosterFilterActive } from '../filter.js'

export { SOLUTION_INDEX_VERSION }

export const TOP_N = 100

export function emptySolutionIndex() {
  return {
    version: SOLUTION_INDEX_VERSION,
    queries: [],
  }
}

export function planKeyOf(plan, extra = {}) {
  const slots = (plan && plan.slots) || []
  const body = slots
    .map((slot) =>
      slot && slot.filled
        ? `${slot.position}:${slot.svtId || 0}:${slot.svtArtKey || ''}:${slot.isSupport ? 1 : 0}:${slot.isGrand ? 1 : 0}:${slot.ceId || 0}:${slot.ceBondId || 0}:${slot.ceRewardId || 0}`
        : `${slot.position}:0`,
    )
    .join('|')
  return [
    extra.questId || 0,
    extra.questClass || '',
    extra.questType || 'normal',
    extra.teapot ? 1 : 0,
    extra.allowSupport === false ? 0 : 1,
    extra.activityState || '',
    body,
  ].join('#')
}

export function queryKeyOf({
  questClass = '',
  questType = 'normal',
  teapot = false,
  allowSupport = true,
  eventId = 0,
} = {}) {
  void teapot
  return [questClass || '', questType || 'normal', allowSupport === false ? 0 : 1, Number(eventId) || 0].join('#')
}

export function compactPlan(plan, extra = {}) {
  const slots = ((plan && plan.slots) || []).map((slot) => ({
    p: slot.position,
    f: slot.filled ? 1 : 0,
    s: slot.isSupport ? 1 : 0,
    g: slot.isGrand ? 1 : 0,
    svt: slot.svtId || 0,
    art: slot.svtArtKey || '',
    ce: slot.ceId || 0,
    bond: slot.ceBondId || 0,
    reward: slot.ceRewardId || 0,
  }))
  const own = slots.filter((slot) => slot.f && !slot.s)
  const support = slots.find((slot) => slot.s)
  return {
    questId: extra.questId || 0,
    front: own.filter((slot) => slot.p <= 3).map((slot) => [slot.svt, slot.art, slot.ce]),
    back: own.filter((slot) => slot.p > 3).map((slot) => [slot.svt, slot.art, slot.ce]),
    ces: slots.map((slot) => slot.ce).filter(Boolean),
    support: support ? { ceId: support.ce, reward: support.reward } : null,
    grand: Boolean(extra.grand || own.some((slot) => slot.g)),
    score: (plan && plan.total) || 0,
    cost: (plan && plan.costUsed) || 0,
    planKey: planKeyOf(plan, extra),
    slots,
  }
}

export function querySolutionIndex(index, query) {
  if (!index || !Array.isArray(index.queries)) return []
  const key = queryKeyOf(query)
  const hit = index.queries.find((row) => row.key === key)
  return hit && Array.isArray(hit.plans) ? hit.plans.slice(0, query.limit || TOP_N) : []
}

function ownCompactSlots(compact) {
  return (compact && compact.slots ? compact.slots : []).filter((slot) => slot.f && !slot.s)
}

function idCount(ids) {
  const map = new Map()
  for (const id of ids || []) {
    const n = Number(id) || 0
    if (!n) continue
    map.set(n, (map.get(n) || 0) + 1)
  }
  return map
}

function accountOwnedSvtIds(account) {
  if (!account) return new Set()
  const rows = account.servantsOwned || account.servants || []
  return new Set(rows.map((row) => Number(row && (row.id || row.svtId)) || 0).filter(Boolean))
}

function accountMaxedSvtIds(account) {
  const out = new Set()
  for (const rec of (account && account.servants) || []) {
    const id = Number(rec && (rec.id || rec.svtId)) || 0
    if (!id) continue
    const lv = Number(rec.bondLv || rec.friendshipRank || 0) || 0
    const cap = Number(rec.bondCap || rec.maxFriendshipRank || rec.bondLimit || 0) || 10
    if (lv < cap) continue
    if (id === 800100 || rec.collectionNo === 1) continue
    out.add(id)
  }
  return out
}

function accountOwnedCeCounts(account) {
  const map = new Map()
  const rows = (account && (account.craftEssencesOwned || account.ces)) || []
  for (const rec of rows) {
    const id = Number(rec && rec.id) || 0
    if (!id) continue
    const n = Math.max(1, Number(rec.count) || 1)
    map.set(id, (map.get(id) || 0) + n)
  }
  return map
}

function artMatches(slotArt, formKey) {
  if (!formKey) return true
  const art = slotArt || ''
  if (formKey === 'default' || formKey === 'd') return !art || art === 'default' || art === 'd'
  return art === formKey
}

export function compactMatchesQuery(compact, constraints = {}, catalogs = {}) {
  if (!compact) return false
  const own = ownCompactSlots(compact)
  const ownSvtIds = own.map((slot) => Number(slot.svt) || 0).filter(Boolean)
  const ownCeIds = own.map((slot) => Number(slot.ce) || 0).filter(Boolean)
  const slots = compact.slots || []
  const support = slots.find((slot) => slot.s)

  if (constraints.allowSupport === false && support) return false

  for (const id of (constraints.preferSvtIds || []).map(Number).filter(Boolean)) {
    if (!ownSvtIds.includes(id)) return false
  }
  for (const id of (constraints.lockSvtIds || []).map(Number).filter(Boolean)) {
    if (!ownSvtIds.includes(id)) return false
  }

  const frontIds = constraints.frontIds || []
  for (let i = 0; i < 3; i += 1) {
    const want = Number(frontIds[i]) || 0
    if (!want) continue
    const slot = slots.find((row) => Number(row.p) === i + 1)
    if (!slot || Number(slot.svt) !== want) return false
  }

  for (const pin of constraints.pinCes || []) {
    const ceId = Number(pin && pin.ceId != null ? pin.ceId : pin) || 0
    const svtId = Number(pin && pin.svtId) || 0
    if (!ceId) continue
    const hit = slots.some(
      (slot) => slot.f && !slot.s && Number(slot.ce) === ceId && (!svtId || Number(slot.svt) === svtId),
    )
    if (!hit) return false
  }

  for (const pin of constraints.pinSprites || []) {
    const svtId = Number(pin && pin.svtId) || 0
    if (!svtId) continue
    const formKey = (pin && pin.formKey) || ''
    if (!own.some((slot) => Number(slot.svt) === svtId && artMatches(slot.art, formKey))) return false
  }

  for (const pin of constraints.slotPins || []) {
    const pos = Number(pin && (pin.position || pin.p)) || 0
    const slot = slots.find((row) => Number(row.p) === pos)
    if (!slot || !slot.f) return false
    if (pin.svtId && Number(slot.svt) !== Number(pin.svtId)) return false
    if (pin.ceId && Number(slot.ce) !== Number(pin.ceId)) return false
    if (pin.formKey && !artMatches(slot.art, pin.formKey)) return false
    if (pin.support && !slot.s) return false
  }

  const servants = catalogs.servants || []
  const filter = constraints.filter
  if (rosterFilterActive(filter)) {
    for (const row of own) {
      const svt = servants.find((item) => item.id === row.svt)
      if (!matchRosterServant(svt, filter)) return false
    }
    const bans = new Set(((filter && filter.banCeIds) || []).map(Number).filter(Boolean))
    if (ownCeIds.some((id) => bans.has(id))) return false
    if (support && bans.has(Number(support.ce) || 0)) return false
    const banSvts = new Set(((filter && filter.banSvtIds) || []).map(Number).filter(Boolean))
    if (ownSvtIds.some((id) => banSvts.has(id))) return false
  }

  if (constraints.mode === 'account' && constraints.account && !constraints.account.virtual) {
    const ownedSvt = accountOwnedSvtIds(constraints.account)
    const maxed = accountMaxedSvtIds(constraints.account)
    if (ownSvtIds.some((id) => !ownedSvt.has(id) || maxed.has(id))) return false
    const ownedCe = accountOwnedCeCounts(constraints.account)
    const needCe = idCount(ownCeIds)
    for (const [id, n] of needCe) {
      if ((ownedCe.get(id) || 0) < n) return false
    }
  }

  return true
}

export function filterSolutionHits(hits, constraints = {}, catalogs = {}) {
  return (hits || []).filter((row) => compactMatchesQuery(row, constraints, catalogs))
}

export function boundedTopN(plans, compare, limit = TOP_N) {
  const heap = []
  for (const plan of plans || []) {
    heap.push(plan)
  }
  heap.sort(compare)
  if (heap.length <= limit) return heap
  const cutoff = heap[limit - 1]
  const out = heap.slice(0, limit)
  for (let i = limit; i < heap.length; i++) {
    const plan = heap[i]
    if ((plan.total || 0) === (cutoff.total || 0)) out.push(plan)
    else break
  }
  return out
}

export function emptyQueryStats() {
  return {
    timing: { totalMs: 0, indexMs: 0, searchMs: 0 },
    candidates: { raw: 0, legal: 0 },
    search: { nodes: 0, pruned: 0, memoHits: 0, memoMisses: 0 },
    results: { assembled: 0, unique: 0, returned: 0 },
  }
}
