import { applyRate as applyRateMilli } from './bond.js'

export function ceDominates(a, b) {
  if (!a || !b) return false
  const bHits = b.hits || []
  if (!bHits.some((value) => value > 0)) return true
  return false
}

export function pruneDominatedCands(cands) {
  return (cands || []).filter((cand) => (cand.hits || []).some((value) => value > 0))
}

export function formStateKey(forms, maxed, bond15Flags) {
  return (forms || [])
    .map((form, i) => {
      const traits = (form.traitIds || []).slice().sort((a, b) => a - b).join(',')
      return `${form.svtId || 0}:${traits}:${Number(form.cost) || 0}:${maxed && maxed[i] ? 1 : 0}:${bond15Flags && bond15Flags[i] ? 1 : 0}`
    })
    .join('|')
}

export function formIdOf(form) {
  if (!form) return '0:'
  const traits = (form.traitIds || []).slice().sort((a, b) => a - b).join(',')
  return `${form.svtId || 0}:${traits}`
}

export function loadoutMemoKey({ formKey, useSupport, grand, bond15Aura, optimizeBy, pinCeIds, ownCap, costLimit, frontIds, slotPins, grandPosition = 0 }) {
  return [
    formKey || '',
    useSupport ? 1 : 0,
    grand ? 1 : 0,
    bond15Aura === false ? 0 : 1,
    optimizeBy || 'total',
    (pinCeIds || []).join(','),
    ownCap || 0,
    costLimit == null || costLimit === '' ? '' : String(costLimit),
    (frontIds || []).map((id) => Number(id) || 0).join(','),
    (slotPins || []).map((pin) => `${pin.position}:${pin.svtId || 0}:${pin.ceId || 0}:${pin.ceBondId || 0}:${pin.ceRewardId || 0}`).join(','),
    Number(grandPosition) || 0,
  ].join('/')
}

export function ceHitMatrixFromCands(cands, asSupport, forms) {
  const matrix = {}
  for (const cand of cands || []) {
    const id = cand.ce && cand.ce.id
    if (id == null) continue
    if (forms && forms.length) {
      matrix[id] = matrix[id] || {}
      for (let i = 0; i < forms.length; i++) {
        const fid = formIdOf(forms[i])
        const rate = (cand.hits && cand.hits[i]) || 0
        const prev = matrix[id][fid] || {}
        matrix[id][fid] = {
          ownRate: asSupport ? prev.ownRate : rate,
          supportRate: asSupport ? rate : prev.supportRate,
          target: 'ptFull',
          fixedAdd: 0,
          matchedEffects: rate > 0 ? [{ kind: asSupport ? 'support' : 'own', rate }] : [],
          conditionState: rate > 0 ? 'hit' : 'miss',
          cost: cand.cost || 0,
        }
      }
      continue
    }
    matrix[id] = {
      ownRate: asSupport ? undefined : cand.hits,
      supportRate: asSupport ? cand.hits : undefined,
      cost: cand.cost || 0,
      target: 'ptFull',
      fixedAdd: 0,
      matchedEffects: [],
      conditionState: (cand.hits || []).some((value) => value > 0) ? 'hit' : 'miss',
      ce: cand.ce,
    }
  }
  return matrix
}

export function remainingCostFeasible(spent, costLimit, minRemain = 0) {
  if (!Number.isInteger(costLimit) || costLimit < 0) return true
  return spent + minRemain <= costLimit
}

function applyRateMilliUb(value, milli) {
  if (!milli) return value
  return (value * (1000 + milli)) / 1000
}

let partyScoreMemo = new Map()

export function clearSolverPrunerMemo() {
  partyScoreMemo = new Map()
}

export function partyBranchUpperBound({
  selected = [],
  leftover = [],
  need = 0,
  base = 0,
  teapot = false,
  ownCes = [],
  supportCes = [],
  useSupport = true,
  grand = false,
  bond15Aura = true,
  milliOn,
  isMaxed = () => false,
  isBond15 = () => false,
} = {}) {
  if (typeof milliOn !== 'function') return 0
  const selectedIds = new Set()
  for (const row of selected) {
    const id = row && row.svt && row.svt.id
    if (id != null) selectedIds.add(id)
  }
  const leftoverById = new Map()
  const extraWant = Math.max(0, need)
  if (extraWant > 0) {
    for (const row of leftover) {
      const id = row && row.svt && row.svt.id
      if (id == null || selectedIds.has(id)) continue
      if (!leftoverById.has(id)) leftoverById.set(id, [])
      leftoverById.get(id).push(row)
    }
  }
  const extraN = Math.min(extraWant, leftoverById.size)
  const n = selected.length + extraN
  if (!n) return 0
  const ownSlots = n + (grand ? 1 : 0)
  const supCount = useSupport ? (grand ? 2 : 1) : 0
  const teapotMul = teapot ? 2 : 1
  const auraPool = [...selected]
  for (const rows of leftoverById.values()) auraPool.push(rows[0])
  const maxAura =
    bond15Aura === false ? 0 : 250 * Math.min(n, auraPool.filter((row) => !isMaxed(row) && isBond15(row)).length)

  function scoreOf(row) {
    if (isMaxed(row)) return 0
    const form = row.form || { traitIds: (row.svt && row.svt.traitIds) || [] }
    const memoKey = `${(row.svt && row.svt.id) || 0}:${(form && form.key) || ''}:${ownSlots}:${supCount}:${maxAura}:${useSupport ? 1 : 0}`
    const memoHit = partyScoreMemo.get(memoKey)
    if (memoHit) return memoHit
    const ownBest = (ownCes || [])
      .map((ce) => milliOn(ce, form, false) || 0)
      .sort((a, b) => b - a)
      .slice(0, ownSlots)
    const ownSum = ownBest.reduce((sum, milli) => sum + milli, 0)
    const supBest = useSupport
      ? (supportCes || []).map((ce) => milliOn(ce, form, true) || 0).sort((a, b) => b - a).slice(0, supCount)
      : []
    const supSum = supBest.reduce((sum, milli) => sum + milli, 0)
    const selfAura = bond15Aura === false ? 0 : isBond15(row) ? 250 : 0
    const second = ownSum + supSum + maxAura - selfAura
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilli(applyRateMilli(base, frontMilli), second) + 50
    const back = applyRateMilli(applyRateMilli(base, backMilli), second) + 50
    const scored = { front, back, gain: front - back }
    partyScoreMemo.set(memoKey, scored)
    return scored
  }

  const selectedScores = selected.map((row) => scoreOf(row) || { front: 0, back: 0, gain: 0 })
  const extraPicked =
    extraN === 0
      ? []
      : [...leftoverById.values()]
    .map((rows) => {
      const liveRows = rows.filter((row) => !isMaxed(row))
      if (!liveRows.length) return null
      const scoredRows = liveRows.map((row) => ({ row, ...(scoreOf(row) || { front: 0, back: 0, gain: 0 }) }))
      scoredRows.sort((a, b) => b.front - a.front)
      return scoredRows[0]
    })
    .filter(Boolean)
    .sort((a, b) => b.front - a.front)
    .slice(0, extraN)
  const scored = selectedScores.concat(extraPicked).filter((row) => row && (row.front || row.back))
  scored.sort((a, b) => b.gain - a.gain)
  let total = 0
  for (let i = 0; i < scored.length; i++) total += i < 3 ? scored[i].front : scored[i].back
  const independentUb = total * teapotMul
  const team = selected.filter((row) => !isMaxed(row)).concat(extraPicked.map((item) => item.row))
  if (!team.length) return independentUb
  const teamForms = team.map((row) => row.form || { traitIds: (row.svt && row.svt.traitIds) || [] })
  const teamAura =
    bond15Aura === false ? 0 : 250 * team.filter((row) => isBond15(row)).length
  function sharedSeconds(ces, asSupport, k) {
    const seconds = team.map(() => 0)
    if (!k || !ces || !ces.length) return seconds
    const scoredCes = (ces || []).map((ce) => {
      const hits = teamForms.map((form) => milliOn(ce, form, asSupport) || 0)
      return { hits, sum: hits.reduce((s, v) => s + v, 0) }
    })
    scoredCes.sort((a, b) => b.sum - a.sum)
    for (const item of scoredCes.slice(0, k)) {
      for (let i = 0; i < seconds.length; i++) seconds[i] += item.hits[i] || 0
    }
    return seconds
  }
  const ownSec = sharedSeconds(ownCes, false, ownSlots)
  const supSec = sharedSeconds(supportCes, true, supCount)
  const scoredShared = []
  for (let i = 0; i < team.length; i++) {
    const selfAura = bond15Aura === false ? 0 : isBond15(team[i]) ? 250 : 0
    const second = ownSec[i] + supSec[i] + teamAura - selfAura
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilliUb(applyRateMilliUb(base, frontMilli), second) + 50
    const back = applyRateMilliUb(applyRateMilliUb(base, backMilli), second) + 50
    scoredShared.push({ front, back, gain: front - back })
  }
  scoredShared.sort((a, b) => b.gain - a.gain)
  let sharedTotal = 0
  for (let i = 0; i < scoredShared.length; i++) {
    sharedTotal += i < 3 ? scoredShared[i].front : scoredShared[i].back
  }
  const sharedUb = Math.ceil(sharedTotal) * teapotMul
  return Math.min(independentUb, sharedUb)
}

export function ceFillUpperBound({
  add = [],
  leftoverCands = [],
  left = 0,
  base = 0,
  teapot = false,
  useSupport = true,
  supportCands = [],
  grand = false,
  maxed = [],
  auraMilli = [],
} = {}) {
  const n = add.length
  if (!n) return 0
  const supCount = useSupport ? (grand ? 2 : 1) : 0
  const scored = []
  for (let i = 0; i < n; i++) {
    if (maxed && maxed[i]) continue
    const ownExtra = leftoverCands
      .map((cand) => (cand.hits && cand.hits[i]) || 0)
      .sort((a, b) => b - a)
      .slice(0, Math.max(0, left))
      .reduce((sum, milli) => sum + milli, 0)
    const supExtra = useSupport
      ? supportCands
          .map((cand) => (cand.hits && cand.hits[i]) || 0)
          .sort((a, b) => b - a)
          .slice(0, supCount)
          .reduce((sum, milli) => sum + milli, 0)
      : 0
    const second = (add[i] || 0) + ownExtra + supExtra + ((auraMilli && auraMilli[i]) || 0)
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilli(applyRateMilli(base, frontMilli), second) + 50
    const back = applyRateMilli(applyRateMilli(base, backMilli), second) + 50
    scored.push({ front, back, gain: front - back })
  }
  scored.sort((a, b) => b.gain - a.gain)
  let total = 0
  for (let i = 0; i < scored.length; i++) total += i < 3 ? scored[i].front : scored[i].back
  const independentUb = total * (teapot ? 2 : 1)
  const leftoverShared = (leftoverCands || [])
    .map((cand) => ({
      hits: cand.hits || [],
      sum: (cand.hits || []).reduce((sum, milli) => sum + (milli || 0), 0),
    }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, Math.max(0, left))
  const supShared = useSupport
    ? (supportCands || [])
        .map((cand) => ({
          hits: cand.hits || [],
          sum: (cand.hits || []).reduce((sum, milli) => sum + (milli || 0), 0),
        }))
        .sort((a, b) => b.sum - a.sum)
        .slice(0, supCount)
    : []
  const scoredShared = []
  for (let i = 0; i < n; i++) {
    if (maxed && maxed[i]) continue
    let ownExtra = 0
    for (const item of leftoverShared) ownExtra += (item.hits[i] || 0)
    let supExtra = 0
    for (const item of supShared) supExtra += (item.hits[i] || 0)
    const second = (add[i] || 0) + ownExtra + supExtra + ((auraMilli && auraMilli[i]) || 0)
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilliUb(applyRateMilliUb(base, frontMilli), second) + 50
    const back = applyRateMilliUb(applyRateMilliUb(base, backMilli), second) + 50
    scoredShared.push({ front, back, gain: front - back })
  }
  scoredShared.sort((a, b) => b.gain - a.gain)
  let sharedTotal = 0
  for (let i = 0; i < scoredShared.length; i++) {
    sharedTotal += i < 3 ? scoredShared[i].front : scoredShared[i].back
  }
  const sharedUb = Math.ceil(sharedTotal) * (teapot ? 2 : 1)
  return Math.min(independentUb, sharedUb)
}

export function effectSignature(cand) {
  return (cand.hits || []).join(',')
}

export function groupCandsByEffect(cands) {
  const map = new Map()
  for (const cand of cands || []) {
    const sig = effectSignature(cand)
    if (!map.has(sig)) map.set(sig, [])
    map.get(sig).push(cand)
  }
  const groups = [...map.values()]
  for (const group of groups) {
    group.sort((a, b) => a.cost - b.cost || ((a.ce && a.ce.collectionNo) || 0) - ((b.ce && b.ce.collectionNo) || 0))
  }
  groups.sort((a, b) => {
    const sumA = (a[0].hits || []).reduce((sum, milli) => sum + milli, 0)
    const sumB = (b[0].hits || []).reduce((sum, milli) => sum + milli, 0)
    return sumB - sumA
  })
  return groups
}

export function comboCount(n, k) {
  if (k < 0 || k > n) return 0
  const k0 = Math.min(k, n - k)
  let out = 1
  for (let i = 1; i <= k0; i++) out = Math.round((out * (n - k0 + i)) / i)
  return out
}

export function eachCombination(items, k, visit) {
  const list = items || []
  const n = list.length
  if (k < 0 || k > n) return
  const pick = []
  function rec(start) {
    if (pick.length === k) {
      visit(pick)
      return
    }
    const need = k - pick.length
    const last = n - need
    for (let i = start; i <= last; i++) {
      pick.push(list[i])
      rec(i + 1)
      pick.pop()
    }
  }
  rec(0)
}

export function eachPrefixCombos(groups, maxK, visit) {
  function rec(gi, left, pick) {
    if (gi >= (groups || []).length) {
      visit(pick)
      return
    }
    const items = groups[gi] || []
    const hi = Math.min(Math.max(0, left), items.length)
    for (let k = 0; k <= hi; k++) {
      if (k === 0) {
        rec(gi + 1, left, pick)
        continue
      }
      eachCombination(items, k, (combo) => rec(gi + 1, left - k, pick.concat(combo)))
    }
  }
  rec(0, maxK, [])
}

export function eachPrefixCombosCost(groups, maxK, visit, spent0 = 0, costLimit = null) {
  function rec(gi, left, pick, spent) {
    if (gi >= (groups || []).length) {
      visit(pick)
      return
    }
    const items = groups[gi] || []
    const hi = Math.min(Math.max(0, left), items.length)
    for (let k = 0; k <= hi; k++) {
      if (k === 0) {
        rec(gi + 1, left, pick, spent)
        continue
      }
      eachCombination(items, k, (combo) => {
        const add = combo.reduce((sum, cand) => sum + (Number(cand.cost) || 0), 0)
        if (!remainingCostFeasible(spent, costLimit, add)) return
        rec(gi + 1, left - k, pick.concat(combo), spent + add)
      })
    }
  }
  rec(0, maxK, [], spent0)
}
