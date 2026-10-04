import { ceMatchesServant, pickCeSkill } from '../atlas.js'
import { hydrateSolutionHits, paretoByCost, servantBondForms, svtCostOf } from '../recommend.js'
import { compactPlan, TOP_N } from './solution-index.js'

const own = plan => (plan.slots || []).filter(slot => slot.f && !slot.s)
const bodyKey = plan => (plan.slots || []).map(slot =>
  `${slot.p}:${slot.f}:${slot.s}:${slot.svt}:${slot.art}:${slot.ce}:${slot.bond}:${slot.reward}`).join('|')

function conditionalCeFunctions(plans, ces) {
  const used = new Set(plans.flatMap(plan => (plan.slots || []).flatMap(slot =>
    [slot.ce, slot.reward].filter(Boolean))))
  return ces.filter(ce => used.has(Number(ce.id))).flatMap(ce =>
    (pickCeSkill(ce, true)?.funcs || []).filter(fn => !fn.eventId && fn.target === 'ptFull' &&
      (fn.tvals?.length || fn.andTvals?.length) && (fn.rate || fn.followerRate)))
}

// Keep ordinary teams, including their conditional CE hits, and try event
// actors in those teams. Settle every candidate as a six-slot party so a
// party aura and a CE hit can affect the other members.
export function activityTeamCandidates({ baselinePlans = [], eventPlans = [], bonuses = {},
  servants = [], ces = [], base, quest, bondBonuses, extra, costLimit = 113, expand = true } = {}) {
  const seeds = [...baselinePlans, ...eventPlans]
  const functions = conditionalCeFunctions(seeds, ces)
  const variants = new Map(seeds.map(plan => [bodyKey(plan), plan]))
  const affected = (expand ? servants : []).flatMap(svt => {
    const eventHit = Boolean(bonuses[svt.id])
    // CE-hit teams are already present in the migrated bank and are settled
    // below. Only event actors need new placements in those teams.
    if (!eventHit) return []
    const distinct = new Set()
    return servantBondForms(svt).filter(form => {
      const ceHits = functions.map(fn => ceMatchesServant(fn, form.traitIds) ? 1 : 0)
      const signature = `${svtCostOf(svt, form)}:${form.attribute}:${form.traitIds.join(',')}:${ceHits.join('')}`
      if (distinct.has(signature)) return false
      distinct.add(signature)
      return true
    }).map(form => ({ svt, form }))
  })
  const svtMap = new Map(servants.map(svt => [Number(svt.id), svt]))
  for (const seed of expand ? seeds : []) {
    const existing = new Set(own(seed).map(slot => Number(slot.svt)))
    for (const slot of own(seed)) {
      const oldSvt = svtMap.get(Number(slot.svt))
      const oldForm = oldSvt && servantBondForms(oldSvt).find(form => form.key === slot.art)
      for (const { svt, form } of affected) {
        if (existing.has(Number(svt.id))) continue
        const cost = Number(seed.cost) - svtCostOf(oldSvt, oldForm) + svtCostOf(svt, form)
        if (cost > costLimit || cost < 0) continue
        const candidate = { ...seed, cost, slots: seed.slots.map(row => row === slot
          ? { ...row, svt: svt.id, art: form.key } : row) }
        variants.set(bodyKey(candidate), candidate)
      }
    }
  }
  const rescored = hydrateSolutionHits([...variants.values()], {
    servants, ces, servantsById: svtMap, cesById: new Map(ces.map(ce => [Number(ce.id), ce])),
    base, teapot: false, quest,
    bondBonuses: Object.keys(bonuses).length && Object.values(bonuses).every(bonus => Array.isArray(bonus.sources))
      ? { ...bondBonuses, _scoreLookup: bonuses } : bondBonuses,
    bond15Aura: true,
    questType: extra.questType, questClass: extra.questClass, allowSupport: true,
  })
  const frontier = paretoByCost(rescored).slice(0, TOP_N)
  return { plans: frontier.map(plan => compactPlan(plan, extra)),
    migrated: baselinePlans.length, affected: affected.length, evaluated: variants.size }
}
