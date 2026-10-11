import { BOND_CURVE_VERSION, evaluateBondCurve } from './bond-curve.js'
import { RULE_VERSION } from '../rules/versions.js'
import { applyCraftEssences, pickCeSkill } from '../atlas.js'
import { compileBondCurve } from './bond-curve.js'

// Lossless, base-independent expansion for a fixed party. Party-wide effects
// commute, so each inventory multiset is visited once, rather than once per
// wearer permutation. Identity/state requirements stay attached to every curve.
// Constraints must be projected before expansion; no top-N or score pruning.
export function* equipmentCurves({ slots, ces, ownCopies, supportCes = [],
  costLimit = null, servantCost = 0, bond15Aura = true, supportLocked = false, supportEmptyOnly = false, mergeEquivalent = false }) {
  const ownSlots = slots.filter(s => s.filled && !s.isSupport)
  const support = slots.find(s => s.filled && s.isSupport)
  if (slots.some(s => s.isGrand)) throw new Error('Grand reward slots require the general solver')
  const valid = (ce, mlb, asSupport) => (pickCeSkill(ce, mlb)?.funcs || []).every(fn =>
    fn.eventId || (asSupport && fn.applySupport === 0) || fn.target === 'ptFull')
  for (const copy of ownCopies) {
    if (!valid(copy.ce, copy.mlb, false)) throw new Error('Wearer-only CE requires positional expansion')
  }
  for (const ce of supportCes) {
    if (!valid(ce, true, true)) throw new Error('Wearer-only support CE requires positional expansion')
  }
  const baseSlots = slots.map(s => ({ ...s, portrait: s.cePortrait ? false : s.portrait, ceId: 0, ceLines: [], ceFlat: 0 }))
  applyCraftEssences(baseSlots, ces)
  const baseline = compileBondCurve(baseSlots, { bond15Aura })
  const groups = new Map()
  for (const copy of ownCopies) {
    const key = `${copy.ce.id}:${copy.mlb ? 1 : 0}`
    if (!groups.has(key)) groups.set(key, { ce: copy.ce, mlb: copy.mlb,
      count: 0, increment: null })
    groups.get(key).count++
  }
  function increment(ce, mlb, wearer) {
    const party = baseSlots.map(s => ({ ...s, ceId: s.position === wearer.position ? ce.id : 0, ceMlb: mlb }))
    applyCraftEssences(party, ces)
    const curve = compileBondCurve(party, { bond15Aura })
    return curve.terms.map((term, i) => ({
      second: term.second - baseline.terms[i].second,
      flat: term.flat - baseline.terms[i].flat,
    }))
  }
  let groupsList = ownSlots.length ? [...groups.values()] : []
  if (ownSlots.length) for (const g of groupsList) g.increment = increment(g.ce, g.mlb, ownSlots[0])
  if (mergeEquivalent) {
    const equivalent = new Map()
    for (const group of groupsList) {
      const key = JSON.stringify(group.increment)
      if (!equivalent.has(key)) equivalent.set(key, { increment: group.increment, items: [], count: 0 })
      const entry = equivalent.get(key)
      for (let i=0;i<Math.min(ownSlots.length,group.count);i++) entry.items.push({ ce: group.ce, mlb: group.mlb })
      entry.count += group.count
    }
    groupsList = [...equivalent.values()]
    for (const group of groupsList) group.items.sort((a,b) => (a.ce.cost||0)-(b.ce.cost||0) || a.ce.id-b.ce.id)
  }
  let supportOptions = support ? [
    ...(!supportLocked || supportEmptyOnly ? [{ id: 0, increment: baseline.terms.map(() => ({ second: 0, flat: 0 })) }] : []),
    ...supportCes.map(ce => ({ id: ce.id, increment: increment(ce, true, support) })),
  ] : [{ id: 0, increment: baseline.terms.map(() => ({ second: 0, flat: 0 })) }]
  if (mergeEquivalent) supportOptions = [...new Map(supportOptions.map(s => [JSON.stringify(s.increment),s])).values()]
  const rates = baseline.terms.map(() => 0), flats = rates.slice(), requirements = []
  function* walk(i, remaining, cost) {
    if (costLimit != null && cost > costLimit) return
    if (i === groupsList.length || remaining === 0) {
      for (const sup of supportOptions) {
        const terms = baseline.terms.map((t, j) => ({ ...t,
          second: t.second + rates[j] + sup.increment[j].second,
          flat: t.flat + flats[j] + sup.increment[j].flat }))
        yield { curve: { version: BOND_CURVE_VERSION, ruleVersion: RULE_VERSION, terms },
          cost, equipment: requirements.map(r => ({ ...r })), supportCeId: sup.id,
          equippedCount: ownSlots.length - remaining,
          conditions: { ownMembers: ownSlots.map(s => [s.svtId, s.svtArtKey || '', s.position]),
            eligiblePositions: terms.filter(t => t.eligible).map(t => t.position),
            supportPosition: support?.position || 0, bond15Aura } }
      }
      return
    }
    const group = groupsList[i]
    const max = Math.min(remaining, group.count)
    for (let count = 0; count <= max; count++) {
      const additions = group.items ? group.items.slice(0,count).map(item => ({ ceId:item.ce.id,mlb:item.mlb,count:1 }))
        : count ? [{ ceId: group.ce.id, mlb: group.mlb, count }] : []
      requirements.push(...additions)
      for (let j = 0; j < rates.length; j++) {
        rates[j] += group.increment[j].second * count
        flats[j] += group.increment[j].flat * count
      }
      const equipmentCost = group.items ? group.items.slice(0,count).reduce((sum,item)=>sum+(Number(item.ce.cost)||0),0)
        : count * (Number(group.ce.cost) || 0)
      yield* walk(i + 1, remaining - count, cost + equipmentCost)
      for (let j = 0; j < rates.length; j++) {
        rates[j] -= group.increment[j].second * count
        flats[j] -= group.increment[j].flat * count
      }
      requirements.splice(requirements.length-additions.length,additions.length)
    }
  }
  yield* walk(0, ownSlots.length, servantCost)
}

// Integer bases are evaluated exactly, including both floors. The resulting
// intervals need not have a single crossing (rounding can alternate winners).
export function compareEquipmentCurves(candidates, { min = 0, max = 2000, teapot = false, onProgress = null, returnCandidates = false } = {}) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min)
    throw new Error('Invalid integer bond range')
  const winners = [], intervals = [], unique = new Map()
  let scanned = 0, lastReport = 0
  for (const candidate of candidates) {
    const id = scanned++
    // Equal total functions remain equivalent at every integer base. This is
    // safe only after inventory, COST and fixed-party constraints were applied.
    const key = JSON.stringify(candidate.curve.terms.filter(t => t.eligible)
      .map(t => [t.front, t.second, t.flat]).sort((a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2]))
    const old = unique.get(key)
    if (!old || candidate.cost < old.candidate.cost) unique.set(key, { id, candidate })
    if (onProgress && Date.now() - lastReport > 250) {
      lastReport = Date.now(); onProgress({ phase: 'expand', scanned, unique: unique.size })
    }
  }
  let compared = 0
  for (const { id, candidate } of unique.values()) {
    const terms = candidate.curve.terms.filter(t => t.eligible)
    const safeNumber = terms.every(t => Number.isSafeInteger(max*t.front) && max*t.front < 2**42 &&
      Number.isSafeInteger(Math.floor(max*t.front/1000)*t.second) && Math.floor(max*t.front/1000)*t.second < 2**42) &&
      terms.reduce((sum,t) => sum + (Math.floor(max*t.front/1000)*(t.second/1000)+t.flat)*(teapot?2:1),0) < Number.MAX_SAFE_INTEGER
    for (let base = min; base <= max; base++) {
      const score = safeNumber ? terms.reduce((sum,t) => sum +
        Math.floor(Math.floor(base*t.front/1000)*t.second/1000)+t.flat,0)*(teapot?2:1)
        : evaluateBondCurve(candidate.curve, base, { teapot }).total
      const index = base - min, old = winners[index]
      if (!old || score > old.total || (score === old.total && candidate.cost < old.candidate.cost))
        winners[index] = { id, total: score, candidate }
    }
    compared++
    if (onProgress && Date.now() - lastReport > 250) {
      lastReport = Date.now(); onProgress({ phase: 'compare', scanned, unique: unique.size, compared })
    }
  }
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i]
    if (!winner) continue
    const last = intervals.at(-1)
    if (last?.id === winner.id) last.max = min + i
    else intervals.push({ id: winner.id, min: min + i, max: min + i, candidate: winner.candidate })
  }
  return { scanned, unique: unique.size, min, max, winners, intervals,
    ...(returnCandidates ? { allCurves: [...unique.values()].map(row => ({ id: row.id, ...row.candidate })) } : {}),
    coverage: 'fixed-party-equipment-domain-complete', tieBreak: 'lower-cost-then-enumeration-order' }
}
