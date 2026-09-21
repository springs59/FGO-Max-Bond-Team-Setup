import assert from 'node:assert/strict'
import { calcParty } from './bond.js'
import { oracleParty } from './bond-oracle.js'

function slot(overrides) {
  return {
    position: 1,
    filled: true,
    isSupport: false,
    bond15: false,
    lunch: 0,
    teaSelf: 0,
    supportTea: 0,
    holmes: 0,
    condCe: 0,
    eventPassive: 0,
    customPercent: 0,
    portrait: false,
    ...overrides,
  }
}

function assertMatchesCalc(base, teapot, slots, opts = {}, label = '') {
  const prod = calcParty(base, teapot, slots, opts)
  const oracle = oracleParty(base, teapot, slots, opts)
  assert.equal(oracle.ok, prod.ok, `${label} ok`)
  if (!prod.ok) return
  assert.equal(oracle.supportInFront, prod.supportInFront, `${label} supportInFront`)
  assert.equal(oracle.bond15Count, prod.bond15Count, `${label} bond15Count`)
  assert.equal(oracle.results.length, prod.results.length, `${label} rows`)
  for (let i = 0; i < prod.results.length; i++) {
    const left = oracle.results[i]
    const right = prod.results[i]
    assert.equal(left.position, right.position, `${label} pos`)
    assert.equal(left.final, right.final, `${label} final p${right.position}`)
    assert.equal(left.afterFront, right.afterFront, `${label} afterFront p${right.position}`)
    assert.equal(left.afterRate, right.afterRate, `${label} afterRate p${right.position}`)
    assert.equal(left.flat, right.flat, `${label} flat p${right.position}`)
    assert.equal(left.eligible, right.eligible, `${label} eligible p${right.position}`)
  }
}

{
  const sample = slot({ lunch: 0.1, teaSelf: 0.05, condCe: 0.2 })
  const out = oracleParty(815, false, [sample])
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].afterRate, 1320)
  assert.equal(out.results[0].final, 1320)
  assertMatchesCalc(815, false, [sample], {}, 'sample')
  assertMatchesCalc(815, true, [sample], {}, 'teapot')
}

{
  const party = [1, 2, 3, 4, 5].map((position) =>
    slot({
      position,
      lunch: 0.1,
      teaSelf: 0.05,
      holmes: 0.05,
      condCe: 0.2,
      portrait: true,
    }),
  )
  const out = oracleParty(815, false, party)
  assert.equal(out.results[0].final, 1419)
  assert.equal(out.results[3].final, 1191)
  assert.equal(out.total, 6639)
  assertMatchesCalc(815, false, party, {}, 'community 6639')
}

{
  assertMatchesCalc(815, false, [slot({ isSupport: true })], {}, 'support self')
  assertMatchesCalc(
    815,
    false,
    [slot({ position: 1, isSupport: true }), slot({ position: 2 })],
    {},
    'support front',
  )
  const front = oracleParty(815, false, [slot({ position: 1, isSupport: true }), slot({ position: 2 })])
  assert.equal(front.supportInFront, true)
  assert.equal(front.results[1].frontMilli, 240)

  const back = oracleParty(815, false, [
    slot({ position: 6, isSupport: true, supportTea: 0.15 }),
    slot({ position: 4 }),
  ])
  assert.equal(back.supportInFront, false)
  assert.equal(back.results[1].frontMilli, 0)
  assertMatchesCalc(
    815,
    false,
    [slot({ position: 6, isSupport: true, supportTea: 0.15 }), slot({ position: 4 })],
    {},
    'support back',
  )
}

{
  assertMatchesCalc(815, false, [slot({ portrait: true })], {}, 'portrait')
  assertMatchesCalc(
    815,
    false,
    [slot({ position: 1, bond15: true, bondMaxed: true }), slot({ position: 2 })],
    {},
    'bond15 maxed aura',
  )
  assertMatchesCalc(
    815,
    false,
    [slot({ position: 1, bond15: true, bondMaxed: false }), slot({ position: 2 })],
    {},
    'bond15 live no self aura',
  )
  assertMatchesCalc(
    815,
    false,
    [slot({ position: 1, bond15: true, bondMaxed: true }), slot({ position: 2 })],
    { bond15Aura: false },
    'aura off',
  )
  assertMatchesCalc(
    815,
    false,
    [
      slot({
        ceLines: [
          { key: 'ce-tea-o1-normal', label: '午茶自己', pct: 0.05 },
          { key: 'ce-tea-s6-normal', label: '午茶助战', pct: 0.15 },
        ],
      }),
    ],
    {},
    'ceLines tea stack',
  )
}

{
  assert.equal(oracleParty(-1, false, [slot()]).ok, false)
  assert.equal(oracleParty(815.5, false, [slot()]).ok, false)
}

console.log('bond oracle tests passed')
