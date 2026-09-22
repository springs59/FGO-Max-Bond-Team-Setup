export function createSearchState({ cap = 5, minN = 1, costLimit = null } = {}) {
  return {
    cap,
    minN,
    costLimit,
    selected: [],
    spent: 0,
    bestPlan: null,
    nodes: 0,
    pruned: 0,
    memoHits: 0,
    memoMisses: 0,
    startedAt: Date.now(),
    lastPing: 0,
  }
}

export function noteBestPlan(state, plan, compare) {
  if (!state || !plan || !plan.ok) return
  if (!state.bestPlan || compare(plan, state.bestPlan) < 0) state.bestPlan = plan
}

export function searchProgress(state) {
  return {
    nodes: state.nodes || 0,
    pruned: state.pruned || 0,
    bestScore: state.bestPlan ? state.bestPlan.total || 0 : 0,
    elapsed: Date.now() - (state.startedAt || Date.now()),
    memoHits: state.memoHits || 0,
    memoMisses: state.memoMisses || 0,
  }
}
