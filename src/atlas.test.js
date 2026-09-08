import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyCraftEssences, ceMatchesServant, pickCeSkill } from './atlas.js'

const ces = JSON.parse(readFileSync(new URL('./data/bond-ces.json', import.meta.url), 'utf8'))
const lunch = ces.find((ce) => ce.collectionNo === 330)
const tea = ces.find((ce) => ce.collectionNo === 910)
const holmes = ces.find((ce) => ce.collectionNo === 1080)
const nff = ces.find((ce) => ce.collectionNo === 1949)

assert.equal(pickCeSkill(lunch, true).funcs[0].rate, 100)
assert.equal(pickCeSkill(lunch, false).funcs[0].rate, 20)

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: lunch.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines[0].pct, 0.1)
  assert.equal(slots[1].ceLines[0].pct, 0.1)
}

{
  const slots = [
    { position: 1, filled: true, isSupport: true, ceId: tea.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines.length, 0)
  assert.equal(slots[1].ceLines[0].pct, 0.15)
  assert.equal(slots[1].ceLines[0].label, '迦勒底午茶时光')
}

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: holmes.id, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines[0].pct, 0.05)
}

{
  const animal = 2821
  assert.equal(ceMatchesServant(pickCeSkill(nff, true).funcs[0], [animal]), true)
  assert.equal(ceMatchesServant(pickCeSkill(nff, true).funcs[0], [100]), false)
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: nff.id, ceMlb: true, traitIds: [100], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [animal], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines.length, 0)
  assert.equal(slots[1].ceLines[0].pct, 0.2)
}

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: nff.id, ceMlb: true, traitIds: [100], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.match(slots[0].ceMiss, /条件未对上/)
}

console.log('atlas tests passed')
