import { SOLUTION_INDEX_VERSION } from '../rules/versions.js'

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
  questId = 0,
  questClass = '',
  questType = 'normal',
  teapot = false,
  allowSupport = true,
  activityState = '',
} = {}) {
  return [questId || 0, questClass || '', questType || 'normal', teapot ? 1 : 0, allowSupport ? 1 : 0, activityState || ''].join('#')
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
