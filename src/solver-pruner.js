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

export function loadoutMemoKey({ formKey, useSupport, grand, bond15Aura, optimizeBy, pinCeIds, ownCap, costLimit, frontIds, slotPins }) {
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

function applyRateMilli(value, milli) {
  if (!milli) return value
  return Math.floor((value * (1000 + milli)) / 1000)
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
  const extraN = Math.min(Math.max(0, need), leftover.length)
  const n = selected.length + extraN
  if (!n || typeof milliOn !== 'function') return 0
  const ownSlots = n + (grand ? 1 : 0)
  const supCount = useSupport ? (grand ? 2 : 1) : 0
  const teapotMul = teapot ? 2 : 1
  const pool = selected.concat(leftover)
  const maxAura =
    bond15Aura === false ? 0 : 250 * Math.min(n, pool.filter((row) => !isMaxed(row) && isBond15(row)).length)

  function frontOf(row) {
    if (isMaxed(row)) return 0
    const form = row.form || { traitIds: (row.svt && row.svt.traitIds) || [] }
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
    return applyRateMilli(applyRateMilli(base, frontMilli), second) + 50
  }

  const selectedSum = selected.reduce((sum, row) => sum + frontOf(row), 0)
  const extra = leftover.map(frontOf).sort((a, b) => b - a).slice(0, extraN)
  return (selectedSum + extra.reduce((sum, value) => sum + value, 0)) * teapotMul
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
