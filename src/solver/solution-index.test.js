import assert from 'node:assert/strict'
import { boundedTopN, compactMatchesQuery, compactPlan, filterSolutionHits, queryKeyOf, querySolutionIndex, TOP_N } from './solution-index.js'
import { emptyRosterFilter } from '../filter.js'

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

{
  assert.equal(
    queryKeyOf({ questId: 94006803, questClass: 'saber', teapot: false }),
    queryKeyOf({ questId: 94066107, questClass: 'saber', teapot: true }),
  )
  assert.notEqual(queryKeyOf({ questClass: 'saber', eventId: 0 }), queryKeyOf({ questClass: 'saber', eventId: 80576 }))
}

{
  const compact = compactPlan(
    {
      total: 100,
      costUsed: 40,
      slots: [
        { position: 1, filled: true, svtId: 100100, svtArtKey: 'd', ceId: 11 },
        { position: 6, filled: true, isSupport: true, ceId: 13 },
      ],
    },
    { questClass: 'saber' },
  )
  assert.equal(compactMatchesQuery(compact, { preferSvtIds: [100100] }), true)
  assert.equal(compactMatchesQuery(compact, { preferSvtIds: [200100] }), false)
  assert.equal(compactMatchesQuery(compact, { lockSvtIds: [100100] }), true)
  assert.equal(
    compactMatchesQuery(compact, {
      mode: 'account',
      account: { servants: [{ id: 100100, bondLv: 5, bondCap: 10 }], ces: [{ id: 11, count: 1 }] },
    }),
    true,
  )
  assert.equal(
    compactMatchesQuery(compact, {
      mode: 'account',
      account: { servants: [{ id: 100100, bondLv: 10, bondCap: 10 }], ces: [{ id: 11, count: 1 }] },
    }),
    false,
  )
  const saber = { id: 100100, className: 'saber', rarity: 5, attribute: 'earth', traitIds: [] }
  const classFilter = emptyRosterFilter()
  classFilter.svtClass.options = ['caster']
  assert.equal(
    filterSolutionHits([compact], { filter: classFilter }, { servants: [saber] }).length,
    0,
  )
}

console.log('solution-index.test.js ok')
