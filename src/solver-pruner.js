export function hitsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function hitsAtLeast(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] < b[i]) return false
  return true
}

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
      return `${form.svtId || 0}:${traits}:${maxed && maxed[i] ? 1 : 0}:${bond15Flags && bond15Flags[i] ? 1 : 0}`
    })
    .join('|')
}

export function formIdOf(form) {
  if (!form) return '0:'
  const traits = (form.traitIds || []).slice().sort((a, b) => a - b).join(',')
  return `${form.svtId || 0}:${traits}`
}

export function loadoutMemoKey({ formKey, useSupport, grand, bond15Aura, optimizeBy, pinCeIds, ownCap, costLimit }) {
  return [
    formKey || '',
    useSupport ? 1 : 0,
    grand ? 1 : 0,
    bond15Aura === false ? 0 : 1,
    optimizeBy || 'total',
    (pinCeIds || []).join(','),
    ownCap || 0,
    costLimit == null || costLimit === '' ? '' : String(costLimit),
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

export function ceRateOnForm(matrix, ceId, form, index, asSupport, fallbackHits) {
  const row = matrix && matrix[ceId]
  if (row && form) {
    const cell = row[formIdOf(form)]
    if (cell) {
      const rate = asSupport ? cell.supportRate : cell.ownRate
      if (rate != null && !Array.isArray(rate)) return rate
    }
  }
  if (row) {
    const arr = asSupport ? row.supportRate : row.ownRate
    if (Array.isArray(arr)) return arr[index] || 0
  }
  return (fallbackHits && fallbackHits[index]) || 0
}

export function remainingCostFeasible(spent, costLimit, minRemain = 0) {
  if (!Number.isInteger(costLimit) || costLimit < 0) return true
  return spent + minRemain <= costLimit
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
      rec(gi + 1, left - k, k ? pick.concat(items.slice(0, k)) : pick)
    }
  }
  rec(0, maxK, [])
}
