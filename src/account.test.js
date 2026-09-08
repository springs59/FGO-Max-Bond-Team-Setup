import assert from 'node:assert/strict'
import { parseAccount } from './account.js'

{
  const out = parseAccount('{')
  assert.equal(out.ok, false)
  assert.match(out.error, /JSON 无法解析/)
}

{
  const out = parseAccount({ foo: 1 })
  assert.equal(out.ok, false)
  assert.match(out.error, /无法识别/)
}

{
  const out = parseAccount({
    users: [
      {
        region: 'cn',
        svtStatus: {
          100100: { svtId: 100100, bondLv: 15, curLv: 90 },
          200100: { svtId: 200100, bondLv: 5 },
        },
        craftEssenceStatus: {
          9401970: { limitCount: 4, lv: 100 },
          9403520: { limitCount: 0 },
        },
      },
    ],
  })
  assert.equal(out.ok, true)
  assert.equal(out.source, 'chaldea')
  assert.equal(out.servants.length, 2)
  assert.equal(out.servants.find((s) => s.id === 100100).bondLv, 15)
  assert.equal(out.ces.find((c) => c.id === 9401970).mlb, true)
  assert.equal(out.ces.find((c) => c.id === 9403520).mlb, false)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userSvtCollection: [
          { svtId: 100100, status: 2, friendshipRank: 15 },
          { svtId: 200100, status: 1, friendshipRank: 10 },
          { svtId: 300100, status: 2, friendshipRank: 8 },
        ],
        userSvt: [
          { svtId: 100100, limitCount: 4, lv: 90 },
          { svtId: 9401970, limitCount: 4, lv: 100 },
          { svtId: 9403520, limitCount: 2, lv: 60 },
        ],
      },
    },
  })
  assert.equal(out.ok, true)
  assert.equal(out.source, 'dump')
  assert.deepEqual(
    out.servants.map((s) => s.id),
    [100100, 300100],
  )
  assert.equal(out.servants[0].bondLv, 15)
  assert.equal(out.ces.find((c) => c.id === 9401970).mlb, true)
  assert.equal(out.ces.find((c) => c.id === 9403520).limitCount, 2)
}

{
  const out = parseAccount({
    servants: [{ svtId: 100100, bondLv: 12 }],
    craftEssences: [{ id: 9401970, limitCount: 4 }],
  })
  assert.equal(out.ok, true)
  assert.equal(out.servants[0].bondLv, 12)
  assert.equal(out.ces[0].mlb, true)
}

console.log('account tests passed')
