import assert from 'node:assert/strict'
import { calcParty } from './bond.js'

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

const sampleOwn = slot({
  lunch: 0.1,
  teaSelf: 0.05,
  condCe: 0.2,
})

{
  const out = calcParty(815, false, [sampleOwn])
  assert.equal(out.ok, true)
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].afterRate, 1320)
  assert.equal(out.results[0].beforeTeapot, 1320)
  assert.equal(out.results[0].final, 1320)
  assert.match(out.caseText, /只上场 1 人/)
}

{
  const out = calcParty(815, true, [sampleOwn])
  assert.equal(out.results[0].final, 2640)
}

{
  const out = calcParty(815, false, [slot({ isSupport: true })])
  assert.equal(out.results[0].final, 0)
  assert.equal(out.results[0].reason, 'support')
}

{
  const out = calcParty(815, false, [
    slot({ position: 1, bond15: true }),
    slot({ position: 2 }),
  ])
  assert.equal(out.results[0].final, 0)
  assert.equal(out.results[1].percentSum, 0.45)
  assert.equal(out.results[1].afterFront, 978)
  assert.equal(out.results[1].final, 1222)
}

{
  const out = calcParty(815, false, [
    slot({ position: 1, isSupport: true, bond15: true }),
    slot({ position: 2 }),
  ])
  assert.equal(out.results[1].percentSum, 0.04)
  assert.equal(out.supportInFront, true)
}

{
  const out = calcParty(815, false, [
    slot({ position: 1, isSupport: true }),
    slot({ position: 5, filled: true }),
  ])
  assert.equal(out.results[1].percentSum, 0.04)
  assert.equal(out.results[1].final, Math.floor(815 * 1.04))
}

{
  const out = calcParty(815, false, [slot({ portrait: true })])
  assert.equal(out.results[0].flat, 50)
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].final, 1028)
}

{
  const out = calcParty(815, false, [
    slot({ position: 6, isSupport: true, supportTea: 0.15 }),
    slot({ position: 4 }),
  ])
  assert.equal(out.results[1].percentSum, 0.15)
  assert.equal(out.results[0].final, 0)
}

{
  const out = calcParty(-1, false, [sampleOwn])
  assert.equal(out.ok, false)
}

{
  const out = calcParty(815.5, false, [sampleOwn])
  assert.equal(out.ok, false)
}

{
  const out = calcParty(815, false, [
    slot({ position: 1, eventPassive: 0.5 }),
    slot({ position: 2 }),
  ])
  assert.equal(out.results[0].percentSum, 0.7)
  assert.equal(out.results[1].percentSum, 0.2)
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
  const out = calcParty(815, false, party)
  assert.equal(out.results[0].final, 1419)
  assert.equal(out.results[1].final, 1419)
  assert.equal(out.results[2].final, 1419)
  assert.equal(out.results[3].final, 1191)
  assert.equal(out.results[4].final, 1191)
  assert.equal(
    out.results.reduce((sum, row) => sum + row.final, 0),
    6639,
  )
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
  const out = calcParty(855, false, party)
  assert.equal(out.results[0].final, 1486)
  assert.equal(out.results[3].final, 1247)
  assert.equal(
    out.results.reduce((sum, row) => sum + row.final, 0),
    6952,
  )
}

{
  const out = calcParty(815, false, [
    slot({
      ceLines: [
        { key: 'ce-tea-o1-normal', label: '迦勒底午茶时光（自己）', pct: 0.05 },
        { key: 'ce-tea-s6-normal', label: '迦勒底午茶时光（助战）', pct: 0.15 },
      ],
    }),
  ])
  const teaLines = out.results[0].lines.filter((line) => String(line.label).includes('午茶'))
  assert.equal(teaLines.length, 2)
  assert.equal(out.results[0].addRate, 0.2)
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].final, 1173)
}

{
  const out = calcParty(815, false, [
    slot({ position: 1, bondMaxed: true }),
    slot({ position: 2 }),
  ])
  assert.equal(out.results[0].final, 0)
  assert.equal(out.results[0].reason, 'bond-max')
  assert.equal(out.results[1].final, 978)
}

{
  const twoAura = calcParty(815, false, [
    slot({ position: 1, bond15: true }),
    slot({ position: 2, bond15: true }),
    slot({ position: 3 }),
    slot({ position: 4 }),
    slot({ position: 5 }),
  ])
  const oneAura = calcParty(815, false, [
    slot({ position: 1, bond15: true }),
    slot({ position: 2 }),
    slot({ position: 3 }),
    slot({ position: 4 }),
    slot({ position: 5 }),
  ])
  const sum = (out) => out.results.reduce((n, row) => n + row.final, 0)
  assert.ok(sum(oneAura) > sum(twoAura))
  assert.equal(oneAura.results[1].addRate, 0.25)
  assert.equal(twoAura.results[2].addRate, 0.5)
}

{
  const out = calcParty(
    815,
    false,
    [slot({ position: 1, bond15: true }), slot({ position: 2 })],
    { bond15Aura: false },
  )
  assert.equal(out.results[0].final, 0)
  assert.equal(out.results[1].addRate, 0)
  assert.equal(out.bond15Count, 0)
  assert.equal(out.results[1].final, 978)
}

console.log('bond tests passed')
