import assert from 'node:assert/strict'
import { servantBondForms } from './recommend.js'
import {
  SOLVER_INDEX_VERSION,
  buildSolverIndex,
  ceMilliLive,
  hydrateSolverIndex,
  milliFromIndex,
  validateSolverIndex,
} from './solver/solver-index.js'

function svt(partial) {
  return {
    id: partial.id,
    collectionNo: partial.collectionNo || partial.id,
    name: partial.name || `svt${partial.id}`,
    className: partial.className || 'saber',
    attribute: 'earth',
    face: '',
    traitIds: partial.traitIds || [],
    forms: partial.forms || [],
    cost: partial.cost != null ? partial.cost : 3,
    rarity: partial.rarity || 3,
  }
}

function ce({ id, rate, cost = 5, traitId, followerRate, add = 0, applySupport = null }) {
  const fn = {
    target: 'ptFull',
    rate,
    add,
    eventId: 0,
    indiv: 0,
    applySupport,
    followerRate: followerRate == null ? null : followerRate,
    tvals: traitId ? [{ id: traitId, name: `t${traitId}` }] : [],
    andTvals: [],
  }
  return {
    id,
    collectionNo: id,
    name: `ce${id}`,
    rarity: 4,
    cost,
    face: '',
    skills: [
      { name: `ce${id}`, condLimitCount: 0, funcs: [{ ...fn, rate: Math.max(10, Math.floor(rate / 5)) }] },
      { name: `ce${id}`, condLimitCount: 4, funcs: [fn] },
    ],
  }
}

const servants = [
  svt({ id: 11, traitIds: [9001] }),
   svt({ id: 12, traitIds: [9002], forms: [{ key: 'a3', name: '第3阶段', traitIds: [9001, 9002], cost: 3 }] }),
]
const ces = [
  ce({ id: 1, rate: 100 }),
  ce({ id: 2, rate: 200, traitId: 9001, followerRate: 300 }),
  ce({ id: 3, rate: 50, add: 50 }),
]

{
  const index = buildSolverIndex({
    servants,
    ces,
    version: { dataVersion: 'test', sourceVersion: 'atlas-cn', region: 'CN' },
    formsOf: servantBondForms,
  })
  assert.equal(index.solverIndexVersion, SOLVER_INDEX_VERSION)
  assert.equal(index.servantCount, 2)
  assert.ok(index.ces.some((item) => item.id === 2 && item.cond))
  assert.equal(index.ces.find((item) => item.id === 1).cond, 0)
  const check = validateSolverIndex(index, { servants, ces, version: { dataVersion: 'test' }, formsOf: servantBondForms })
  assert.equal(check.ok, true, check.errors.join('\n'))
}

{
  const raw = buildSolverIndex({ servants, ces, formsOf: servantBondForms })
  const index = hydrateSolverIndex(raw)
  for (const rec of servants) {
    for (const form of servantBondForms(rec)) {
      const row = { ...form, svtId: rec.id }
      for (const item of ces) {
        for (const asSupport of [false, true]) {
          for (const mlb of [true, false]) {
            const live = ceMilliLive(item, row, asSupport, mlb)
            const indexed = milliFromIndex(index, item, row, asSupport, mlb)
            assert.equal(indexed, live, `ce=${item.id} svt=${rec.id} ${form.key} s=${asSupport} mlb=${mlb}`)
          }
        }
      }
    }
  }
}

{
  const index = buildSolverIndex({ servants, ces, formsOf: servantBondForms })
  index.bondLevels = { 11: 15 }
  const check = validateSolverIndex(index, { servants, ces })
  assert.equal(check.ok, false)
  assert.ok(check.errors.some((line) => /账号/.test(line)))
}

{
  const index = buildSolverIndex({ servants, ces, version: { dataVersion: 'a' }, formsOf: servantBondForms })
  const check = validateSolverIndex(index, { servants, ces, version: { dataVersion: 'b' } })
  assert.equal(check.ok, false)
}

console.log('solver-index tests passed')
