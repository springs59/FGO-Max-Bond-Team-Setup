import assert from 'node:assert/strict'
import { gzipSync, deflateRawSync } from 'node:zlib'
import { isBond15, isBondMaxed, parseAccount, parseAccountFile } from './account.js'
import { costLimitFromMasterLv } from './master-cost.js'

{
  const out = parseAccount('{')
  assert.equal(out.ok, false)
  assert.match(out.error, /无法解析/)
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
  assert.equal(out.masterLv, 0)
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

{
  const php = `<?php
return array(
  'cache' => array(
    'replaced' => array(
      'userSvtCollection' => array(
        0 => array('svtId' => 100100, 'status' => 2, 'friendshipRank' => 15),
        1 => array('svtId' => 200100, 'status' => 1, 'friendshipRank' => 10),
        2 => array('svtId' => 300100, 'status' => 2, 'friendshipRank' => 8),
      ),
      'userSvt' => array(
        0 => array('svtId' => 100100, 'limitCount' => 4, 'lv' => 90),
        1 => array('svtId' => 9401970, 'limitCount' => 4, 'lv' => 100),
        2 => array('svtId' => 9403520, 'limitCount' => 2, 'lv' => 60),
      ),
    ),
  ),
);
`
  const out = parseAccount(php)
  assert.equal(out.ok, true)
  assert.equal(out.source, 'dump')
  assert.deepEqual(
    out.servants.map((s) => s.id),
    [100100, 300100],
  )
  assert.equal(out.servants[0].bondLv, 15)
  assert.equal(out.ces.find((c) => c.id === 9401970).mlb, true)
}

{
  const phpJson = `HTTP/1.1 200 OK\nContent-Type: text/html\n\n{"cache":{"replaced":{"userSvtCollection":[{"svtId":100100,"status":2,"friendshipRank":12}]}}}`
  const out = parseAccount(phpJson.replace(/\\n/g, '\n'))
  assert.equal(out.ok, true)
  assert.equal(out.servants[0].bondLv, 12)
}

const fateJson = {
  response: [{ nid: 'login', resCode: '00' }],
  cache: {
    replaced: {
      userSvtCollection: [
        { svtId: 100100, status: 2, friendshipRank: 15 },
        { svtId: 200100, status: 1, friendshipRank: 10 },
      ],
      userSvt: [{ svtId: 9401970, limitCount: 4, lv: 100 }],
      userSvtStorage: [{ svtId: 9403520, limitCount: 2, lv: 60 }],
    },
  },
  sign: 'x',
}

{
  const b64 = Buffer.from(JSON.stringify(fateJson), 'utf8').toString('base64')
  assert.ok(b64.startsWith('ey'))
  const out = parseAccount(b64)
  assert.equal(out.ok, true)
  assert.equal(out.source, 'dump')
  assert.equal(out.servants.length, 1)
  assert.equal(out.servants[0].bondLv, 15)
  assert.equal(out.ces.find((c) => c.id === 9401970).mlb, true)
  assert.equal(out.ces.find((c) => c.id === 9403520).limitCount, 2)
}

{
  const b64 = Buffer.from(JSON.stringify(fateJson), 'utf8').toString('base64')
  const wrapped = `HTTP/1.1 200 OK\nContent-Type: text/plain\n\n${encodeURIComponent(b64)}`
  const out = parseAccount(wrapped)
  assert.equal(out.ok, true)
  assert.equal(out.servants[0].id, 100100)
}

{
  const gz = gzipSync(Buffer.from(JSON.stringify(fateJson)))
  const out = await parseAccountFile(gz)
  assert.equal(out.ok, true)
  assert.equal(out.servants[0].bondLv, 15)
  assert.equal(out.ces.find((c) => c.id === 9401970).mlb, true)
}

{
  const raw = deflateRawSync(Buffer.from(JSON.stringify(fateJson)))
  const out = await parseAccountFile(raw)
  assert.equal(out.ok, true)
  assert.equal(out.servants[0].id, 100100)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userGame: [{ lv: 150, exp: 1, qp: 0 }],
        userSvtCollection: [{ svtId: 100100, status: 2, friendshipRank: 5 }],
      },
    },
  })
  assert.equal(out.ok, true)
  assert.equal(out.masterLv, 150)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userGame: { userLv: 90, qp: 12 },
        userSvtCollection: [{ svtId: 100100, status: 2, friendshipRank: 5 }],
      },
    },
  })
  assert.equal(out.ok, true)
  assert.equal(out.masterLv, 90)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userSvt: [{ svtId: 100100, lv: 90, qp: 999, limitCount: 4 }],
        userSvtCollection: [{ svtId: 100100, status: 2, friendshipRank: 5 }],
      },
    },
  })
  assert.equal(out.ok, true)
  assert.equal(out.masterLv, 0)
}

{
  assert.equal(costLimitFromMasterLv(1), 56)
  assert.equal(costLimitFromMasterLv(150), 113)
  assert.equal(costLimitFromMasterLv(190), 117)
}

{
  const out = parseAccount({
    servants: [
      { svtId: 100100, bondLv: 10 },
      { svtId: 200100, bondLv: 10, friendshipExceedCount: 5 },
      { svtId: 300100, bondLv: 12 },
      { svtId: 400100, bondLv: 15 },
    ],
  })
  const a = out.servants.find((s) => s.id === 100100)
  const b = out.servants.find((s) => s.id === 200100)
  const c = out.servants.find((s) => s.id === 300100)
  const d = out.servants.find((s) => s.id === 400100)
  assert.equal(a.bondCap, 10)
  assert.equal(isBondMaxed(a), true)
  assert.equal(b.bondCap, 15)
  assert.equal(isBondMaxed(b), false)
  assert.equal(c.bondCap, 15)
  assert.equal(isBondMaxed(c), false)
  assert.equal(d.bondCap, 15)
  assert.equal(isBondMaxed(d), true)
}

{
  const out = parseAccount({
    servants: [
      { svtId: 500100, bondLv: 16, bondCap: 16 },
      { svtId: 600100, bondLv: 10, friendshipExceedCount: 6 },
    ],
  })
  const e = out.servants.find((s) => s.id === 500100)
  const f = out.servants.find((s) => s.id === 600100)
  assert.equal(e.bondCap, 16)
  assert.equal(isBondMaxed(e), true)
  assert.equal(isBond15(e), true)
  assert.equal(f.bondCap, 16)
  assert.equal(isBondMaxed(f), false)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userSvtCollection: [{ svtId: 501900, status: 2, friendshipRank: 10 }],
        userSvt: [{ svtId: 501900, limitCount: 4, lv: 90, exceedCount: 5 }],
      },
    },
  })
  const dvc = out.servants.find((s) => s.id === 501900)
  assert.equal(dvc.bondLv, 10)
  assert.equal(dvc.bondCap, 10)
  assert.equal(isBondMaxed(dvc), true)
  assert.equal(dvc.maxAscension, 4)
}

{
  const out = parseAccount({
    users: [
      {
        region: 'cn',
        svtStatus: {
          501900: {
            svtId: 501900,
            bondLv: 10,
            cur: { svtId: 501900, limitCount: 4, lv: 90, exceedCount: 5 },
          },
        },
      },
    ],
  })
  const dvc = out.servants.find((s) => s.id === 501900)
  assert.equal(dvc.bondLv, 10)
  assert.equal(dvc.bondCap, 10)
  assert.equal(isBondMaxed(dvc), true)
}

{
  const out = parseAccount({
    servants: [{ svtId: 501900, bondLv: 10, maxFriendshipRank: 15, exceedCount: 5 }],
  })
  const dvc = out.servants.find((s) => s.id === 501900)
  assert.equal(dvc.bondLv, 10)
  assert.equal(dvc.bondCap, 10)
  assert.equal(isBondMaxed(dvc), true)
}

{
  const out = parseAccount({
    users: [
      {
        region: 'cn',
        servants: {
          501900: {
            svtId: 501900,
            bond: 10,
            cur: { bondLimit: 15, ascension: 4 },
          },
        },
      },
    ],
  })
  const dvc = out.servants.find((s) => s.id === 501900)
  assert.equal(dvc.bondLv, 10)
  assert.equal(dvc.bondCap, 15)
  assert.equal(isBondMaxed(dvc), false)
}

{
  const out = parseAccount({
    users: [
      {
        region: 'cn',
        svtStatus: {
          800100: {
            svtId: 800100,
            bondLv: 15,
            cur: { svtId: 800100, limitCount: 4, lv: 80 },
            costumeIds: { 800140: 1, 800190: 1 },
          },
        },
      },
    ],
  })
  const mash = out.servants.find((s) => s.id === 800100)
  assert.equal(mash.maxAscension, 4)
  assert.equal(mash.unlockedCostumes.includes(800140), true)
  assert.equal(mash.unlockedCostumes.includes(800190), true)
}

{
  const out = parseAccount({
    cache: {
      replaced: {
        userSvtCollection: [
          { svtId: 100100, status: 2, friendshipRank: 8, costumeIds: [100130] },
        ],
        userSvt: [{ svtId: 100100, limitCount: 2, lv: 50 }],
      },
    },
  })
  const saber = out.servants.find((s) => s.id === 100100)
  assert.equal(saber.maxAscension, 2)
  assert.equal(saber.unlockedCostumes.includes(100130), true)
}

console.log('account tests passed')
