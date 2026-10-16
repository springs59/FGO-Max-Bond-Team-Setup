import assert from 'node:assert/strict'
import { equipmentCurves, compareEquipmentCurves } from './equipment-curves.js'
import { evaluateBondCurve } from './bond-curve.js'
import { buildCombinationFactors } from './combination-factors.js'
import { applyCraftEssences } from '../atlas.js'
import { calcParty } from '../bond.js'

const ce = (id, rate, add = 0, traits = []) => ({ id, cost: add ? 5 : 12,
  skills: [0, 4].map(condLimitCount => ({ condLimitCount,
    funcs: [{ target: 'ptFull', rate: condLimitCount ? rate : rate / 2,
      add, tvals: traits.map(id => ({ id })) }] })) })
const ces = [ce(1, 200, 0, [10]), ce(2, 100), ce(3, 0, 50)]
const slots = [1, 2, 3].map(position => ({ position, filled: true,
  svtId: position, traitIds: position === 2 ? [11] : [10], bondMaxed: position === 3 }))
slots.push({ position: 6, filled: true, isSupport: true, traitIds: [] })
const party = slots.map(s => ({ ...s, ceId: s.position === 1 || s.isSupport ? 3 : 0, ceMlb: true }))
applyCraftEssences(party, ces)
assert.deepEqual(party.map(s => s.ceFlat), [100, 100, 0, 0], 'two portraits affect all recipients')
party[0].portrait = true
assert.equal(calcParty(0, false, party).results.reduce((sum, r) => sum + r.final, 0), 200,
  'legacy auto-set portrait flag must not count an equipped portrait twice')
party[0].portrait = false
assert.equal(calcParty(0, false, party).results.reduce((sum, r) => sum + r.final, 0), 200)
applyCraftEssences(party, ces)
assert.deepEqual(party.map(s => s.ceFlat), [100, 100, 0, 0], 'reapplying does not accumulate stale effects')
party[0].ceId = 0
applyCraftEssences(party, ces)
assert.deepEqual(party.map(s => s.ceFlat), [50, 50, 0, 0], 'unequipping removes its party effect')

const copies = [{ ce: ces[0], mlb: true }, { ce: ces[1], mlb: false },
  { ce: ces[2], mlb: true }, { ce: ces[2], mlb: true }]
// Literal position/copy enumeration independently checks expansion, including
// empty equipment, duplicates, unMLB, COST, misses and capped wearers.
for (const costLimit of [0, 5, 10, 17, 29, null]) {
  const expanded = [...equipmentCurves({ slots, ces, ownCopies: copies, supportCes: ces, costLimit })]
  for (const base of [0, 1, 49, 165, 250, 315, 815]) {
    let max = 0
    const used = new Set(), ids = []
    function walk(i, cost) {
      if (costLimit != null && cost > costLimit) return
      if (i < 3) {
        ids[i] = null; walk(i + 1, cost)
        for (let k = 0; k < copies.length; k++) {
          if (used.has(k)) continue
          used.add(k); ids[i] = copies[k]; walk(i + 1, cost + copies[k].ce.cost); used.delete(k)
        }
        return
      }
      for (const support of [null, ...ces]) {
        const live = slots.map((s, j) => ({ ...s, ceId: s.isSupport ? support?.id || 0 : ids[j]?.ce.id || 0,
          ceMlb: s.isSupport || ids[j]?.mlb }))
        // This expectation deliberately does not call the production CE/bond settlement.
        let total = 0
        for (const s of live.filter(s => !s.isSupport && !s.bondMaxed)) {
          let rate = 0, flat = 0
          for (const wearer of live) {
            const c = ces.find(c => c.id === wearer.ceId)
            if (!c) continue
            const fn = c.skills[wearer.ceMlb ? 1 : 0].funcs[0]
            if (fn.tvals.length && !fn.tvals.some(t => s.traitIds.includes(t.id))) continue
            rate += fn.rate; flat += fn.add
          }
          total += Math.floor(Math.floor(base * 1.2) * (1000 + rate) / 1000) + flat
        }
        max = Math.max(max, total)
      }
    }
    walk(0, 0)
    assert.equal(Math.max(...expanded.map(p => evaluateBondCurve(p.curve, base).total)), max,
      `independent complete equipment comparison B=${base}, COST=${costLimit}`)
  }
  const merged = [...equipmentCurves({slots,ces,ownCopies:copies,supportCes:ces,costLimit,mergeEquivalent:true})]
  for (const base of [0,1,49,165,250,315,815]) assert.equal(
    Math.max(...merged.map(p=>evaluateBondCurve(p.curve,base).total)),
    Math.max(...expanded.map(p=>evaluateBondCurve(p.curve,base).total)), 'post-constraint equivalent compression must be lossless')
  const compared = compareEquipmentCurves(expanded, { max: 330 })
  assert.equal(compared.scanned, expanded.length)
  for (const interval of compared.intervals) for (let b = interval.min; b <= interval.max; b++)
    assert.equal(evaluateBondCurve(interval.candidate.curve, b).total, compared.winners[b].total)
}
const factors = buildCombinationFactors({ servants: slots.filter(s => !s.isSupport).map(s => ({ id: s.svtId })),
  ces, formsOf: s => [{ key: 'default', traitIds: slots[s.id - 1].traitIds }] })
assert.equal(factors.ceEffects.length, ces.length)
assert.ok(factors.flatVectors.every(v => v[2].every(value => value === 50)))
assert.equal(factors.grammar.pruningBeforeConstraints, false)
assert.equal(factors.grammar.baseIndependent, true)
console.log('equipment curves: independent exhaustive copies/MLB/COST/masks/portrait/support checks passed')
