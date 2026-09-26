import assert from 'node:assert/strict'
import { boundedTopN, compactPlan, queryKeyOf, querySolutionIndex, TOP_N } from './solution-index.js'

assert.equal(TOP_N, 100)

{
  const plans = Array.from({ length: 120 }, (_, i) => ({ total: 1000 - i, slots: [] }))
  const kept = boundedTopN(plans, (a, b) => (b.total || 0) - (a.total || 0), 100)
  assert.equal(kept.length, 100)
  assert.equal(kept[0].total, 1000)
}

{
  const plan = {
    total: 2000,
    costUsed: 80,
    slots: [
      { position: 1, filled: true, svtId: 102700, svtArtKey: 'd', ceId: 11 },
      { position: 2, filled: true, svtId: 800100, ceId: 12 },
      { position: 6, filled: true, isSupport: true, ceId: 13 },
    ],
  }
  const compact = compactPlan(plan, { questId: 1, questClass: 'saber', teapot: true })
  assert.equal(compact.front.length, 2)
  assert.equal(compact.support.ceId, 13)
  assert.ok(compact.planKey.includes('102700'))
}

{
  const key = queryKeyOf({ questClass: 'saber', teapot: false, allowSupport: true })
  const index = { version: 1, queries: [{ key, plans: [{ score: 1 }, { score: 2 }] }] }
  assert.equal(querySolutionIndex(index, { questClass: 'saber' }).length, 2)
  assert.equal(querySolutionIndex(index, { questClass: 'archer' }).length, 0)
}

console.log('solution-index.test.js ok')
