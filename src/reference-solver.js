import { ceMatchesServant, pickCeSkill } from './atlas.js'
import { assemblePlan, comparePlans, frontLayouts, servantBondForms, svtCostOf } from './recommend.js'
import { eachCombination } from './solver-pruner.js'

function eachPermutation(items, visit) {
  const list = items || []
  const used = Array(list.length).fill(false)
  const pick = []
  function rec() {
    if (pick.length === list.length) {
      visit(pick.slice())
      return
    }
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue
      used[i] = true
      pick.push(list[i])
      rec()
      pick.pop()
      used[i] = false
    }
  }
  rec()
}

function ceTargetsSelf(ce) {
  for (const skill of ce.skills || []) {
    for (const fn of skill.funcs || []) {
      if (fn && fn.target === 'self') return true
    }
  }
  return false
}

function eachOwnOrder(ownCes, visit) {
  if (!ownCes.length) {
    visit([])
    return
  }
  if (ownCes.some(ceTargetsSelf)) eachPermutation(ownCes, visit)
  else visit(ownCes)
}

function ceOwnUseful(ce, farmers) {
  const skill = pickCeSkill(ce, true)
  const fn = (skill && skill.funcs && skill.funcs[0]) || null
  if (!fn) return false
  if ((fn.add || 0) > 0) return true
  if (!(fn.rate > 0)) return false
  return (farmers || []).some((row) => {
    const traits = (row.form && row.form.traitIds) || (row.svt && row.svt.traitIds) || []
    return ceMatchesServant(fn, traits)
  })
}

function bondFormsOf(svt) {
  const seen = new Set()
  const out = []
  for (const form of servantBondForms(svt)) {
    const sig = [
      form.rarity,
      form.cost != null ? form.cost : svtCostOf(svt, form),
      form.attribute,
      (form.traitIds || []).slice().sort((a, b) => a - b).join(','),
    ].join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(form)
  }
  return out.length ? out : [{ key: 'default', traitIds: svt.traitIds || [] }]
}

function eachFormMix(svts, visit) {
  const groups = (svts || []).map((svt) => bondFormsOf(svt).map((form) => ({ svt, form })))
  function rec(i, acc) {
    if (i >= groups.length) {
      visit(acc)
      return
    }
    for (const row of groups[i]) rec(i + 1, acc.concat([row]))
  }
  rec(0, [])
}

export function planObjective(plan) {
  return {
    total: (plan && plan.total) || 0,
    preferBond: (plan && plan.preferBond) || 0,
    bond15Count: (plan && plan.bond15Count) || 0,
    costUsed: (plan && plan.costUsed) || 0,
    priorityScore: (plan && plan.priorityScore) || 0,
  }
}

export function objectivesEqual(a, b) {
  const left = planObjective(a)
  const right = planObjective(b)
  return (
    left.total === right.total &&
    left.preferBond === right.preferBond &&
    left.bond15Count === right.bond15Count &&
    left.costUsed === right.costUsed &&
    left.priorityScore === right.priorityScore
  )
}

export function referenceRecommendTeam(opts = {}) {
  const servants = opts.servants || []
  const catalogCes = opts.ces || []
  const useSupport = opts.allowSupport !== false
  const cap = useSupport ? 5 : 6
  const mode = opts.mode || 'free'
  const account = opts.account || null
  const ownedCeIds =
    mode === 'account' && account && !account.virtual
      ? new Set((account.ces || []).map((item) => item.id))
      : null
  const ces = (() => {
    if (!ownedCeIds) return catalogCes
    const byId = new Map(catalogCes.map((ce) => [ce.id, ce]))
    const recs = account.ces || []
    if (recs.length) {
      const out = []
      for (const rec of recs) {
        const ce = byId.get(rec.id)
        if (!ce) continue
        const n = Math.max(1, Number(rec.count) || 1)
        const mlbN =
          rec.mlbCount != null ? Math.max(0, Number(rec.mlbCount) || 0) : rec.mlb ? n : 0
        for (let i = 0; i < n; i++) out.push({ ...ce, accountMlb: i < mlbN, copyIndex: i })
      }
      return out
    }
    return catalogCes.filter((ce) => ownedCeIds.has(ce.id))
  })()
  const supportPool = useSupport ? catalogCes : []
  const lockIds = [...new Set((opts.lockSvtIds || []).map(Number).filter((id) => id))]
  const preferIds = [...new Set((opts.preferSvtIds || []).map(Number).filter((id) => id))]
  const preferSvts = servants.filter((svt) => preferIds.includes(svt.id))
  const lockSvts = servants.filter((svt) => lockIds.includes(svt.id))
  const mustIds = [...new Set([...preferIds, ...lockIds])]
  if (mustIds.length > cap) return { ok: false, error: '锁定超出编队上限' }
  const owned =
    mode === 'account' && account ? new Set((account.servants || []).map((item) => item.id)) : null
  const pool = servants.filter((svt) => (owned ? owned.has(svt.id) : true))
  const must = pool.filter((svt) => mustIds.includes(svt.id))
  if (must.length !== mustIds.length) return { ok: false, error: '该锁定无法满足' }
  const free = pool.filter((svt) => !mustIds.includes(svt.id))
  const slotPins = opts.slotPins || []
  const frontIds = opts.frontIds || []
  let best = null

  function considerFarmers(svts) {
    if (!svts.length) return
    const grand = opts.questType === 'grand'
    eachFormMix(svts, (farmers) => {
      const fronts = frontLayouts(farmers, frontIds, slotPins)
      if (!fronts.length) return
      const ownN = farmers.length
      const maxOwn = ownN + (grand ? 1 : 0)
      const supportChoices = useSupport ? [null, ...supportPool] : [null]
      const emit = (ownNormal, ownReward, sup, supReward) => {
        for (const frontIdx of fronts) {
          const plan = assemblePlan({
            base: opts.base,
            teapot: Boolean(opts.teapot),
            servants,
            ces: catalogCes,
            account,
            mode,
            useSupport,
            farmers,
            loadout: {
              ownNormal,
              ownReward,
              support: sup,
              supportReward: supReward,
              frontIdx,
            },
            preferSvts,
            questType: opts.questType || 'normal',
            questClass: opts.questClass || '',
            costLimit: opts.costLimit,
            grand,
            bond15Aura: opts.bond15Aura !== false,
            lockSvts,
            optimizeBy: opts.optimizeBy || 'total',
            priorities: opts.priorities || [],
            pinCes: opts.pinCes || [],
            spriteMode: 'bond_first',
            pinSprites: opts.pinSprites || [],
            slotPins,
            grandPosition: opts.grandPosition || 0,
          })
          if (Number.isInteger(opts.costLimit) && opts.costLimit >= 0 && plan.costUsed > opts.costLimit) continue
          if (!best || comparePlans(plan, best) < 0) best = plan
        }
      }
      const runOwn = (ownNormal, ownReward) => {
        for (const sup of supportChoices) {
          if (!grand || !sup) {
            emit(ownNormal, ownReward, sup, null)
            continue
          }
          emit(ownNormal, ownReward, sup, null)
          for (const sup2 of supportPool) {
            if (!sup2 || sup2.id === sup.id) continue
            emit(ownNormal, ownReward, sup, sup2)
          }
        }
      }
      const visitOwn = (ownCes) => {
        if (ownCes.some((ce) => !ceOwnUseful(ce, farmers))) return
        if (!ownCes.length) {
          runOwn([], null)
          return
        }
        if (grand) {
          if (ownCes.length <= 1) {
            eachOwnOrder(ownCes, (ordered) => runOwn(ordered, null))
          } else {
            for (let r = 0; r < ownCes.length; r++) {
              const reward = ownCes[r]
              const rest = ownCes.filter((_, index) => index !== r)
              if (rest.length > ownN) continue
              eachOwnOrder(rest, (ordered) => runOwn(ordered, reward))
            }
          }
        } else {
          eachOwnOrder(ownCes, (ordered) => runOwn(ordered, null))
        }
      }
      for (let k = 0; k <= Math.min(maxOwn, ces.length); k++) {
        eachCombination(ces, k, (pick) => visitOwn(pick.slice()))
      }
    })
  }

  const extraCap = Math.min(free.length, cap - must.length)
  for (let extra = 0; extra <= extraCap; extra++) {
    if (must.length + extra < 1) continue
    if (extra === 0) {
      considerFarmers(must)
      continue
    }
    eachCombination(free, extra, (pick) => considerFarmers(must.concat(pick)))
  }

  if (!best) return { ok: false, error: '没有可拿羁绊的从者' }
  return best
}
