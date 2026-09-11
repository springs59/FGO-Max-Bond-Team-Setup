import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ceMlbRate,
  emptyRosterFilter,
  filterServants,
  filterCes,
  matchRosterServant,
  matchRosterForm,
  rankCesByBonus,
  rosterFilterActive,
  servantBonusRate,
  toggleFilterValue,
} from './filter.js'

const ces = JSON.parse(readFileSync(new URL('./data/bond-ces.json', import.meta.url), 'utf8'))

function svt(partial) {
  return {
    id: partial.id,
    collectionNo: partial.collectionNo,
    name: partial.name,
    className: partial.className,
    attribute: partial.attribute || 'earth',
    rarity: partial.rarity ?? 5,
    traitIds: partial.traitIds || [],
    forms: partial.forms || [],
  }
}

const saber = svt({
  id: 1,
  collectionNo: 2,
  name: '剑阶',
  className: 'saber',
  rarity: 5,
  traitIds: [2, 100, 300, 303],
})
const caster = svt({
  id: 2,
  collectionNo: 284,
  name: '术阶',
  className: 'caster',
  rarity: 4,
  attribute: 'star',
  traitIds: [2, 104, 203, 304],
})
const ruler = svt({
  id: 3,
  collectionNo: 59,
  name: '裁定',
  className: 'ruler',
  rarity: 5,
  traitIds: [1, 107, 300, 303],
})

{
  const filter = emptyRosterFilter()
  assert.equal(rosterFilterActive(filter), false)
  assert.equal(matchRosterServant(saber, filter), true)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.svtClass, 'saber')
  assert.equal(rosterFilterActive(filter), true)
  assert.equal(matchRosterServant(saber, filter), true)
  assert.equal(matchRosterServant(caster, filter), false)
  filter.svtClass.invert = true
  assert.equal(matchRosterServant(saber, filter), false)
  assert.equal(matchRosterServant(caster, filter), true)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.svtClass, 'extra')
  assert.equal(matchRosterServant(ruler, filter), true)
  assert.equal(matchRosterServant(saber, filter), false)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.rarity, 5)
  assert.equal(matchRosterServant(saber, filter), true)
  assert.equal(matchRosterServant(caster, filter), false)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.attribute, 'star')
  assert.equal(matchRosterServant(caster, filter), true)
  assert.equal(matchRosterServant(saber, filter), false)
}

{
  const human = svt({
    id: 4,
    collectionNo: 3,
    name: '人属性',
    className: 'saber',
    attribute: 'human',
    rarity: 4,
  })
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.attribute, 'man')
  assert.equal(matchRosterServant(human, filter), true)
  assert.equal(matchRosterServant(saber, filter), false)
  filter.attribute.invert = true
  assert.equal(matchRosterServant(human, filter), false)
  assert.equal(matchRosterServant(saber, filter), true)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.trait, 104)
  assert.equal(matchRosterServant(caster, filter), true)
  assert.equal(matchRosterServant(saber, filter), false)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.trait, 300)
  toggleFilterValue(filter.trait, 303)
  assert.equal(matchRosterServant(saber, filter), true)
  assert.equal(matchRosterServant(caster, filter), false)
  filter.trait.matchAll = true
  assert.equal(matchRosterServant(saber, filter), true)
  assert.equal(matchRosterServant(ruler, filter), true)
  const chaos = svt({ id: 9, collectionNo: 9, name: '只秩序', className: 'saber', traitIds: [300] })
  assert.equal(matchRosterServant(chaos, filter), false)
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.svtClass, 'saber')
  toggleFilterValue(filter.rarity, 4)
  assert.equal(filterServants([saber, caster, ruler], filter).length, 0)
}

{
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const nff = ces.find((ce) => ce.collectionNo === 1949)
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  assert.equal(ceMlbRate(lunch), 100)
  assert.equal(ceMlbRate(nff), 200)
  const ranked = rankCesByBonus([lunch, nff, wing])
  assert.equal(ranked[0].collectionNo, nff.collectionNo)
  assert.ok(ceMlbRate(ranked[0]) >= ceMlbRate(ranked[1]))
}

{
  const nff = ces.find((ce) => ce.collectionNo === 1949)
  const animal = svt({ id: 8, collectionNo: 8, name: '兽', className: 'berserker', traitIds: [2821] })
  assert.ok(servantBonusRate(animal, [nff]) >= 200)
  assert.equal(servantBonusRate(saber, [nff]), 0)
}

{
  const low = svt({ id: 10, collectionNo: 10, name: '低星', className: 'saber', rarity: 3 })
  const zero = svt({ id: 11, collectionNo: 11, name: '零星', className: 'avenger', rarity: 0 })
  const high = svt({ id: 12, collectionNo: 12, name: '五星', className: 'saber', rarity: 5 })
  const filter = emptyRosterFilter()
  filter.rarity.options = ['0', '1', '2', '3']
  filter.rarity.invert = true
  assert.equal(matchRosterServant(low, filter), false)
  assert.equal(matchRosterServant(zero, filter), false)
  assert.equal(matchRosterServant(high, filter), true)
}

{
  const roster = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const mash = roster.find((item) => item.collectionNo === 1)
  const paladin = (mash.forms || []).find((item) => item.key === 'c800190')
  assert.equal(mash.rarity, 4)
  assert.equal(paladin.rarity, 5)
  assert.equal(paladin.attribute, 'human')
  const onlyFive = emptyRosterFilter()
  toggleFilterValue(onlyFive.rarity, 5)
  assert.equal(matchRosterServant(mash, onlyFive), true)
  assert.equal(matchRosterForm(mash, paladin, onlyFive), true)
  assert.equal(matchRosterForm(mash, { key: 'default', rarity: 4, attribute: 'earth' }, onlyFive), false)
  const onlyMan = emptyRosterFilter()
  toggleFilterValue(onlyMan.attribute, 'man')
  assert.equal(matchRosterServant(mash, onlyMan), true)
  assert.equal(matchRosterForm(mash, paladin, onlyMan), true)
  const hideLow = emptyRosterFilter()
  for (const star of [0, 1, 2, 3]) toggleFilterValue(hideLow.rarity, star)
  hideLow.rarity.invert = true
  assert.equal(matchRosterServant(mash, hideLow), true)
}

{
  const filter = emptyRosterFilter()
  filter.banSvtIds = [saber.id]
  assert.equal(rosterFilterActive(filter), true)
  assert.equal(matchRosterServant(saber, filter), false)
  assert.equal(matchRosterServant(caster, filter), true)
  assert.equal(filterServants([saber, caster], filter).map((item) => item.id).join(','), String(caster.id))
}

{
  const filter = emptyRosterFilter()
  filter.banCeIds = [ces[0].id]
  assert.equal(filterCes(ces, filter).some((ce) => ce.id === ces[0].id), false)
  assert.ok(filterCes(ces, filter).length < ces.length)
}
