import assert from 'node:assert/strict'
import { applyIndexQuery, querySolverIndex } from './query.js'

const index = {
  servants: [
    { id: 11, className: 'saber' },
    { id: 12, className: 'archer' },
    { id: 13, className: 'saber' },
  ],
  ces: [{ id: 1 }, { id: 2 }],
  candidates: {
    byClass: { saber: [11, 13], archer: [12] },
    byCeKind: { bond20: [1], bond15: [2] },
  },
}

{
  const q = querySolverIndex(index, { questClass: 'saber' })
  assert.deepEqual(q.servantIds, [11, 13])
  assert.deepEqual(q.ceIds, [1, 2])
}

{
  const q = querySolverIndex(index, {
    questClass: 'saber',
    servantIds: [11, 12],
    lockSvtIds: [12],
  })
  assert.ok(q.servantIds.includes(11))
  assert.ok(q.servantIds.includes(12))
  assert.equal(q.servantIds.includes(13), false)
}

{
  const q = querySolverIndex(index, {
    mode: 'account',
    account: { servantsOwned: [{ id: 11 }, { id: 12 }] },
    questClass: 'saber',
  })
  assert.deepEqual(q.servantIds, [11])
}

{
  const q = querySolverIndex(index, {
    mode: 'account',
    account: { servantsOwned: [{ id: 11 }], craftEssencesOwned: [{ id: 2 }] },
    questClass: 'saber',
  })
  assert.deepEqual(q.servantIds, [11])
  assert.deepEqual(q.ceIds, [2])
}

{
  const q = querySolverIndex(index, {
    questClass: 'saber',
    excludeSvtIds: [13],
    excludeCeIds: [1],
  })
  assert.deepEqual(q.servantIds, [11])
  assert.deepEqual(q.ceIds, [2])
}

{
  const servants = [{ id: 11 }, { id: 12 }, { id: 13 }]
  const ces = [{ id: 1 }, { id: 99 }]
  const out = applyIndexQuery(index, { servants, ces, questClass: 'saber' })
  assert.deepEqual(out.servants.map((svt) => svt.id), [11, 13])
  assert.deepEqual(out.ces.map((ce) => ce.id), [1])
}

{
  assert.equal(querySolverIndex({ servants: [] }, { questClass: 'saber' }), null)
}

console.log('solver query tests passed')
