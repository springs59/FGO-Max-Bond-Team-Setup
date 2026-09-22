import assert from 'node:assert/strict'
import { recommendTeam } from './recommend.js'
import { servantBondForms } from './recommend.js'
import { buildSolverIndex, hydrateSolverIndex } from './solver/solver-index.js'
import { objectivesEqual, planObjective, referenceRecommendTeam } from './reference-solver.js'

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

function ce({ id, rate, cost = 5, traitId, followerRate }) {
  const fn = {
    target: 'ptFull',
    rate,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
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

function snapshot(plan) {
  return {
    ok: plan.ok,
    total: plan.total,
    preferBond: plan.preferBond,
    bond15Count: plan.bond15Count,
    costUsed: plan.costUsed,
    priorityScore: plan.priorityScore,
    servantIds: (plan.slots || []).filter((slot) => slot.filled && !slot.isSupport).map((slot) => slot.svtId),
    ceIds: (plan.slots || []).filter((slot) => slot.filled).map((slot) => [slot.ceId, slot.ceBondId || 0, slot.ceRewardId || 0]),
    frontIds: (plan.slots || []).filter((slot) => slot.filled && slot.position <= 3 && !slot.isSupport).map((slot) => slot.svtId),
    forms: (plan.slots || []).filter((slot) => slot.filled && !slot.isSupport).map((slot) => slot.svtArtKey || ''),
    support: (plan.slots || []).some((slot) => slot.isSupport),
    grand: (plan.slots || []).some((slot) => slot.isGrand),
  }
}

const servants = [
  svt({ id: 11, name: 'A', traitIds: [9001], cost: 3 }),
  svt({ id: 12, name: 'B', traitIds: [9001], cost: 4 }),
  svt({ id: 13, name: 'C', traitIds: [9009], cost: 3 }),
]
const ces = [
  ce({ id: 21, rate: 100, cost: 1 }),
  ce({ id: 22, rate: 200, cost: 5, traitId: 9001 }),
  ce({ id: 23, rate: 150, cost: 5, traitId: 9009, followerRate: 250 }),
]

const baseOpts = {
  base: 815,
  servants,
  ces,
  mode: 'free',
  allowSupport: true,
}

{
  const index = hydrateSolverIndex(buildSolverIndex({ servants, ces, formsOf: servantBondForms }))
  const withIndex = recommendTeam({ ...baseOpts, solverIndex: index })
  const live = recommendTeam({ ...baseOpts, solverAudit: { index: false } })
  assert.equal(withIndex.ok, true)
  assert.equal(live.ok, true)
  assert.deepEqual(snapshot(withIndex), snapshot(live))
}

{
  const withIndex = recommendTeam({ ...baseOpts, allowSupport: false })
  const live = recommendTeam({ ...baseOpts, allowSupport: false, solverAudit: { index: false } })
  assert.deepEqual(snapshot(withIndex), snapshot(live))
}

{
  const optimized = recommendTeam(baseOpts)
  const reference = referenceRecommendTeam(baseOpts)
  assert.equal(optimized.ok, true)
  assert.equal(reference.ok, true)
  assert.ok(
    objectivesEqual(optimized, reference),
    JSON.stringify({ o: planObjective(optimized), r: planObjective(reference) }),
  )
}

{
  const first = recommendTeam(baseOpts)
  const cachedTotal = first.total
  first.total = -1
  const second = recommendTeam(baseOpts)
  assert.equal(second.ok, true)
  assert.equal(second.total, cachedTotal)
  assert.notEqual(second.total, -1)
}

{
  const costume = {
    ...servants[0],
    forms: [{ key: 'c1', name: 'costume', traitIds: [9009] }],
  }
  const withCostume = recommendTeam({ ...baseOpts, servants: [costume, servants[1], servants[2]] })
  const baseline = recommendTeam(baseOpts)
  assert.equal(withCostume.ok, true)
  assert.equal(baseline.ok, true)
  const costumeSlot = (withCostume.slots || []).find((slot) => slot.svtId === costume.id && !slot.isSupport)
  if (costumeSlot) assert.equal(costumeSlot.formLabel, 'costume')
}

console.log('differential-solver tests passed')
