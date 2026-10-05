import { pickCeSkill } from '../atlas.js'
import { ceHasBondGain } from '../game-data.js'
import { ceMilliLive } from './solver-index.js'
import { applyRate } from '../bond.js'

// Exact CE-first solver for positive-B, free, ordinary parties with rear support,
// no ceiling, pins or identity objective. All other queries use the general solver.
// For a fixed CE vector and selected party-passive subset, scores are additive.
// A two-capacity DP chooses distinct identities and their position-specific forms.
export function solveDefaultCurves({ servants, ces, formsOf, base, bonuses = {} }) {
  if (!Number.isSafeInteger(base) || base <= 0) return null
  const ownCes = ces.filter(ceHasBondGain)
  if (ownCes.some(ce => {
    const funcs = pickCeSkill(ce, true)?.funcs || []
    const fn = funcs[0]
    return funcs.length !== 1 || fn.eventId ||
      !((fn.target === 'ptFull' && fn.rate >= 0 && !fn.add) ||
        (fn.add === 50 && !fn.rate && !fn.tvals?.length && !fn.andTvals?.length))
  })) return null
  const identities = servants.map(svt => ({ svt, forms: formsOf(svt) })).filter(row => row.forms.length)
  const n = Math.min(5, identities.length)
  if (!n) return null
  const frontN = Math.min(3, n), backN = n - frontN
  const partyIds = identities.filter(row => bonuses[row.svt.id]?.party).map(row => row.svt.id)
  if (partyIds.length > 8) return null // explicit scope limit, never an approximate result
  const formRows = identities.flatMap(row => row.forms.map(form => ({ svt: row.svt, form })))
  const vectors = [], vectorMap = new Map()
  for (const row of formRows) {
    const rates = ownCes.map(ce => ceMilliLive(ce, row.form, false, true))
    const supportRates = ownCes.map(ce => ceMilliLive(ce, row.form, true, true))
    const signature = JSON.stringify([rates, supportRates, Math.round((bonuses[row.svt.id]?.totalSecondLayer || 0) * 1000)])
    if (!vectorMap.has(signature)) {
      vectorMap.set(signature, vectors.length)
      vectors.push({ rates, supportRates, self: Math.round((bonuses[row.svt.id]?.totalSecondLayer || 0) * 1000) })
    }
    row.vector = vectorMap.get(signature)
  }
  const groups = new Map()
  ownCes.forEach((ce, i) => {
    const fn = pickCeSkill(ce, true).funcs[0]
    const key = JSON.stringify([fn.add || 0, vectors.map(row => row.rates[i])])
    if (!groups.has(key)) groups.set(key, { rates: vectors.map(row => row.rates[i]), flat: fn.add || 0, items: [] })
    groups.get(key).items.push(ce)
  })
  const ceGroups = [...groups.values()]
  for (const group of ceGroups) group.items.sort((a, b) => a.cost - b.cost || a.id - b.id)
  // Only score/cost are objectives here. For k equivalent copies the cheapest
  // k distinct CEs suffice; every other identity remains in the factor index.
  const support = [{ ce: null, rates: vectors.map(() => 0) }]
  const supportSeen = new Set()
  ownCes.forEach((ce, i) => {
    const rates = vectors.map(row => row.supportRates[i])
    const key = JSON.stringify(rates)
    if (!rates.some(Boolean) || supportSeen.has(key)) return
    supportSeen.add(key); support.push({ ce, rates })
  })
  const byId = new Map()
  for (const row of formRows) {
    if (!byId.has(row.svt.id)) byId.set(row.svt.id, [])
    byId.get(row.svt.id).push(row)
  }
  let best = null, evaluated = 0
  const afterFront = applyRate(base, 200)
  const ownRates = vectors.map(() => 0)
  const chosen = []
  const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.cost < b.cost)
  function evaluate(flat, ceCost) {
    for (const sup of support) {
      for (let mask = 0; mask < 2 ** partyIds.length; mask++) {
        const required = new Set(partyIds.filter((_, i) => mask & (1 << i)))
        if (required.size > n) continue
        const banned = new Set(partyIds.filter(id => !required.has(id)))
        const aura = [...required].reduce((sum, id) => sum + Math.round(bonuses[id].party * 1000), 0)
        const scores = vectors.map((row, i) => {
          const second = ownRates[i] + sup.rates[i] + row.self + aura
          return [applyRate(afterFront, second), applyRate(base, second)]
        })
        const options = []
        for (const [id, rows] of byId) {
          if (banned.has(id)) continue
          let front = null, back = null
          for (const row of rows) {
            const cost = row.form.cost ?? row.svt.cost ?? 0
            const f = { score: scores[row.vector][0], cost, row }
            const b = { score: scores[row.vector][1], cost, row }
            if (better(f, front)) front = f
            if (better(b, back)) back = b
          }
          options.push({ id, front, back, required: required.has(id) })
        }
        // At most n-1 other identities can occupy a team. An omitted optional
        // identity has n alternatives ahead of it for the requested position.
        // One is unused and has at least its score, then no greater cost.
        const keep = new Set([...required,
          ...[...options].sort((a,b) => b.front.score-a.front.score || a.front.cost-b.front.cost).slice(0,n).map(row=>row.id),
          ...[...options].sort((a,b) => b.back.score-a.back.score || a.back.cost-b.back.cost).slice(0,n).map(row=>row.id)])
        let dp = Array((frontN + 1) * (backN + 1)).fill(null)
        const at = (f, b) => f * (backN + 1) + b
        dp[0] = { score: 0, cost: 0, front: [], back: [] }
        for (const opt of options.filter(row => keep.has(row.id))) {
          const next = opt.required ? Array(dp.length).fill(null) : dp.slice()
          for (let f = 0; f <= frontN; f++) for (let b = 0; b <= backN; b++) {
            const prev = dp[at(f, b)]
            if (!prev) continue
            for (const seat of ['front', 'back']) {
              if (seat === 'front' ? f === frontN : b === backN) continue
              const pick = opt[seat]
              const state = { score: prev.score + pick.score, cost: prev.cost + pick.cost,
                front: seat === 'front' ? [...prev.front, pick.row] : prev.front,
                back: seat === 'back' ? [...prev.back, pick.row] : prev.back }
              const index = at(f + (seat === 'front' ? 1 : 0), b + (seat === 'back' ? 1 : 0))
              if (better(state, next[index])) next[index] = state
            }
          }
          dp = next
        }
        const result = dp[at(frontN, backN)]
        evaluated++
        if (!result) continue
        const scored = { ...result, score: result.score + flat, cost: result.cost + ceCost }
        if (better(scored, best)) best = { ...scored, ownCes: chosen.slice(), supportCe: sup.ce }
      }
    }
  }
  function walk(i, remaining, flat, cost) {
    if (i === ceGroups.length || !remaining) { evaluate(flat, cost); return }
    const group = ceGroups[i]
    for (let k = 0; k <= Math.min(remaining, group.items.length); k++) {
      const picked = group.items.slice(0, k)
      chosen.push(...picked)
      for (let j = 0; j < ownRates.length; j++) ownRates[j] += group.rates[j] * k
      walk(i + 1, remaining - k, flat + group.flat * k,
        cost + picked.reduce((sum, ce) => sum + (Number(ce.cost) || 0), 0))
      for (let j = 0; j < ownRates.length; j++) ownRates[j] -= group.rates[j] * k
      chosen.splice(chosen.length - k, k)
    }
  }
  walk(0, n, 0, 0)
  if (!best) return null
  const team = [...best.front, ...best.back]
  const slots = Array.from({ length: 6 }, (_, i) => ({ p: i + 1, f: 0, s: 0, g: 0,
    svt: 0, art: '', ce: 0, bond: 0, reward: 0 }))
  team.forEach((row, i) => { slots[i] = { ...slots[i], f: 1, svt: row.svt.id,
    art: row.form.key === 'default' ? '' : row.form.key } })
  best.ownCes.forEach((ce, i) => { slots[i].ce = ce.id })
  slots[5] = { ...slots[5], f: 1, s: 1, ce: best.supportCe?.id || 0 }
  return { slots, cost: best.cost, score: best.score,
    certificate: { method: 'ce-vector-position-dp', complete: true, evaluated,
      identities: identities.length, forms: formRows.length, vectors: vectors.length,
      ceGroups: ceGroups.length, supportVectors: support.length, partySubsets: 2 ** partyIds.length,
      scope: 'free-positive-base-normal-rear-support-no-ceiling-or-pins' } }
}
