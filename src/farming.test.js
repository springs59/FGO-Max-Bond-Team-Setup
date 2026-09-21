import assert from 'node:assert/strict'
import { compareFarmScore, farmScore, recommendFarm, scoreBondPlans, uniqueFarmPlans } from './farming.js'
import { solveQuest } from './quest-solver.js'

{
  const low = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0.2, avgTurns: 8 }, 1000, 'balanced')
  const high = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0, avgTurns: 3 }, 800, 'balanced')
  assert.ok(compareFarmScore(high, low) < 0)
}

{
  const bondFirst = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0, avgTurns: 9 }, 5000, 'bond_first')
  const fast = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0, avgTurns: 3 }, 100, 'bond_first')
  assert.ok(compareFarmScore(bondFirst, fast) < 0)
}

{
  const script = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0.2, avgTurns: 8 }, 100, 'stable_script')
  const unscript = farmScore({ theoreticalClear: true, reproducible: false, failRate: 0, avgTurns: 3 }, 5000, 'stable_script')
  assert.ok(compareFarmScore(script, unscript) < 0)
  const fastest = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0.5, avgTurns: 2 }, 10, 'fastest')
  const slow = farmScore({ theoreticalClear: true, reproducible: true, failRate: 0, avgTurns: 9 }, 9000, 'fastest')
  assert.ok(compareFarmScore(fastest, slow) < 0)
}

const lunch = {
  id: 9300001,
  collectionNo: 330,
  name: '午餐',
  rarity: 4,
  cost: 5,
  skills: [
    {
      name: '午餐',
      condLimitCount: 4,
      funcs: [{ target: 'ptFull', rate: 100, add: 0, tvals: [], andTvals: [], followerRate: 100 }],
    },
  ],
}
const saber = {
  id: 100100,
  collectionNo: 2,
  name: '阿尔托莉雅',
  className: 'saber',
  attribute: 'earth',
  traitIds: [102],
  cost: 12,
  rarity: 5,
  forms: [],
}

{
  const farm = recommendFarm({
    base: 815,
    servants: [saber],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    quest: {
      id: 99,
      waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 2000 }] }],
    },
    runs: 4,
    seed: 1,
  })
  assert.equal(farm.ok, true)
  assert.equal(farm.bond.ok, true)
  assert.ok(farm.strategy.waves.length)
  assert.ok(farm.claim)
  assert.equal(farm.claim.includes('必过'), false)
  assert.ok(farm.claim.includes('简化模型') || farm.claim.includes('失败率'))
  assert.ok(Array.isArray(farm.candidates))
  assert.ok(farm.candidates.length >= 1)
}

{
  const quest = solveQuest({
    base: 815,
    servants: [saber],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    quest: {
      id: 77,
      waves: [
        { enemies: [{ id: 1, name: 'w1', className: 'lancer', hp: 1500 }] },
        { enemies: [{ id: 2, name: 'boss', className: 'lancer', hp: 2500 }] },
      ],
    },
    runs: 4,
    seed: 2,
  })
  assert.equal(quest.ok, true)
  assert.equal(quest.questId, 77)
  assert.ok(quest.strategy.waves[0].actions)
  assert.ok(quest.strategy.failureBranches.length)
  assert.ok(quest.note)
  assert.equal(quest.note.includes('必过'), false)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 4000 }] }] }
  const slow = {
    total: 5000,
    slots: [{ filled: true, isSupport: false, svtId: 1, className: 'saber', atk: 3000, np: 0, npMultiplier: 1, npGain: 0.5, skills: [] }],
  }
  const fast = {
    total: 100,
    slots: [{ filled: true, isSupport: false, svtId: 2, className: 'saber', atk: 40000, np: 100, npMultiplier: 5, npGain: 1, skills: [] }],
  }
  const fastest = scoreBondPlans([slow, fast], { quest, runs: 4, seed: 1, cardRandom: false }, 'fastest')
  assert.equal(fastest[0].plan.total, 100)
  const bondFirst = scoreBondPlans([slow, fast], { quest, runs: 4, seed: 1, cardRandom: false }, 'bond_first')
  assert.equal(bondFirst[0].plan.total, 5000)
}

{
  const dup = { total: 1, slots: [{ filled: true, svtId: 1, ceId: 2, isSupport: false }] }
  const uniq = uniqueFarmPlans([dup, { ...dup }, { total: 2, slots: [{ filled: true, svtId: 3, ceId: 4, isSupport: false }] }])
  assert.equal(uniq.length, 2)
}

{
  const farm = recommendFarm({
    base: 815,
    servants: [saber],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    quest: {
      id: 98,
      waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 2000 }] }],
    },
    runs: 3,
    seed: 1,
  })
  assert.equal(farm.ok, true)
  assert.ok(Array.isArray(farm.bond.allPlans))
  assert.ok(farm.candidates.length >= 1)
}

console.log('farming tests passed')
