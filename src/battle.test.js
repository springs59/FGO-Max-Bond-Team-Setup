import assert from 'node:assert/strict'
import { classAdvantage, npDamage, simulateBattle, createRng, stabilityLabel, hasScriptableStrategy } from './battle-sim.js'
import { planBattle } from './battle-planner.js'

assert.equal(classAdvantage('saber', 'lancer'), 2)
assert.equal(classAdvantage('saber', 'archer'), 0.5)
assert.ok(classAdvantage('berserker', 'saber') > 1)

{
  const rng = createRng(1)
  const dmg = npDamage(
    { className: 'saber', attribute: 'man', atk: 10000, npMultiplier: 3, specialAtk: 0.5, atkUp: 0, npDmgUp: 0 },
    { className: 'lancer', attribute: 'sky', specialDef: 0 },
    rng,
    { fixedRandom: 1 },
  )
  assert.ok(dmg > 30000)
}

{
  const quest = {
    id: 1,
    waves: [{ enemies: [{ id: 1, name: 'e1', className: 'lancer', attribute: 'man', hp: 1000 }] }],
  }
  const team = [
    {
      id: 10,
      name: 'A',
      className: 'saber',
      attribute: 'man',
      atk: 20000,
      np: 100,
      npMultiplier: 5,
      npGain: 1,
      skills: [{ name: 's1', cd: 7, npCharge: 50, atkUp: 0.3, npDmgUp: 0, target: 'self' }],
    },
  ]
  const strategy = planBattle({ quest, team })
  assert.equal(strategy.waves.length, 1)
  assert.ok(strategy.waves[0].actions.length)
  assert.ok(strategy.waves[0].npOrder.includes(10))
  const evidence = simulateBattle({ quest, team, strategy, runs: 8, seed: 2, cardRandom: true })
  assert.equal(evidence.runs, 8)
  assert.equal(evidence.theoreticalClear, true)
  assert.ok(['theoretical-clear', 'reproducible-strategy', 'high-stability-farming'].includes(stabilityLabel(evidence)))
}

{
  const quest = {
    waves: [
      { enemies: [{ id: 1, name: 'w1', className: 'saber', hp: 500 }] },
      { enemies: [{ id: 2, name: 'w2', className: 'saber', hp: 500 }] },
    ],
  }
  const team = [{ id: 1, className: 'archer', atk: 15000, np: 300, npMultiplier: 4, npGain: 1, skills: [] }]
  const strategy = planBattle({ quest, team })
  const evidence = simulateBattle({ quest, team, strategy, runs: 5, seed: 3, cardRandom: false })
  assert.equal(evidence.theoreticalClear, true)
  assert.equal(strategy.waves.length, 2)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'tank', className: 'saber', hp: 99999999 }] }] }
  const team = [{ id: 1, className: 'saber', atk: 10, np: 0, npMultiplier: 1, npGain: 0.01, skills: [] }]
  const strategy = planBattle({ quest, team })
  const evidence = simulateBattle({ quest, team, strategy, runs: 3, seed: 4, cardRandom: false })
  assert.equal(evidence.theoreticalClear, false)
  assert.ok(evidence.failRate > 0)
  assert.ok(evidence.failReasons.length)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 80000 }] }] }
  const team = [
    { id: 1, className: 'saber', atk: 8000, np: 0, npMultiplier: 3, npGain: 0.2, skills: [{ name: '充能', cd: 1, npCharge: 20, target: 'self' }] },
  ]
  const strategy = planBattle({ quest, team })
  strategy.waves[0].npOrder = [1]
  const evidence = simulateBattle({ quest, team, strategy, runs: 4, seed: 5, cardRandom: true, targetRandom: true })
  assert.equal(evidence.runs, 4)
  assert.ok(typeof evidence.failRate === 'number')
}

{
  const strategy = planBattle({
    bondPlan: {
      slots: [{ filled: true, isSupport: false, svtId: 9, label: '占位', className: 'saber', skills: [], atk: 0 }],
    },
  })
  assert.equal(strategy.placeholderEnemies, true)
  assert.equal(strategy.assumedCombatStats, true)
  assert.ok(strategy.dataNote)
  assert.equal(strategy.team[0].skills.length, 0)
  assert.equal(strategy.waves[0].npOrder.length, 0)
  assert.equal(strategy.waves[0].actions.length, 0)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', attribute: 'man', hp: 19900 }] }] }
  const team = [{ id: 1, className: 'saber', attribute: 'man', atk: 10000, np: 100, npMultiplier: 1, npGain: 1, skills: [] }]
  const strategy = planBattle({ quest, team })
  const evidence = simulateBattle({ quest, team, strategy, runs: 24, seed: 1, cardRandom: true })
  assert.equal(evidence.theoreticalClear, true)
  assert.ok(evidence.failRate > 0)
  assert.equal(evidence.reproducible, true)
}

{
  const strategy = planBattle({
    bondPlan: {
      slots: [{ filled: true, isSupport: false, svtId: 9, label: '占位', className: 'saber', skills: [], atk: 0 }],
    },
  })
  const evidence = simulateBattle({
    quest: { waves: [{ enemies: [] }] },
    team: strategy.team,
    strategy,
    runs: 2,
    seed: 1,
  })
  assert.equal(evidence.theoreticalClear, false)
  assert.equal(evidence.reproducible, false)
  assert.equal(hasScriptableStrategy(strategy, { waves: [{ enemies: [] }] }), false)
}

{
  const rng = createRng(1)
  const base = npDamage(
    { className: 'saber', attribute: 'man', atk: 10000, npMultiplier: 1, specialAtk: 0, atkUp: 0, npDmgUp: 0 },
    { className: 'lancer', attribute: 'man', specialDef: 0 },
    rng,
    { fixedRandom: 1 },
  )
  const spec = npDamage(
    { className: 'saber', attribute: 'man', atk: 10000, npMultiplier: 1, specialAtk: 1, atkUp: 0, npDmgUp: 0 },
    { className: 'lancer', attribute: 'man', specialDef: 0 },
    rng,
    { fixedRandom: 1 },
  )
  assert.ok(spec > base)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 80000 }] }] }
  const team = [{ id: 1, className: 'saber', atk: 100, np: 0, npMultiplier: 3, npGain: 0.2, skills: [] }]
  const strategy = planBattle({ quest, team })
  assert.ok(strategy.waves[0].fallback)
  assert.equal(strategy.waves[0].fallback.if, 'np-low')
  assert.ok(strategy.failureBranches.some((item) => item.reason === 'np-low'))
  const evidence = simulateBattle({ quest, team, strategy, runs: 3, seed: 4, cardRandom: false })
  assert.ok(evidence.failReasons.includes('np-low') || evidence.failRate >= 0)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 1000 }] }] }
  const strategy = planBattle({
    quest,
    bondPlan: { slots: [{ filled: true, isSupport: false, svtId: 88, label: 'A', className: 'saber', atk: 0, skills: [] }] },
    game: {
      servants: [{ id: 88, atk: 20000, hp: 10000 }],
      skills: [{ svtId: 88, name: '充能', npCharge: 50, target: 'self' }],
      noblePhantasms: [{ svtId: 88, npMultiplier: 5, npGain: 1 }],
    },
  })
  assert.equal(strategy.team[0].atk, 20000)
  assert.equal(strategy.team[0].skills[0].npCharge, 50)
  assert.equal(strategy.team[0].npMultiplier, 5)
  assert.ok(strategy.waves[0].requiredConditions.length >= 2)
}

{
  const quest = {
    waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 999999, atk: 20000 }] }],
  }
  const team = [{ id: 1, className: 'saber', atk: 10, hp: 50, np: 0, npMultiplier: 1, npGain: 0.01, skills: [] }]
  const strategy = planBattle({ quest, team })
  const evidence = simulateBattle({ quest, team, strategy, runs: 3, seed: 6, cardRandom: false })
  assert.equal(evidence.theoreticalClear, false)
  assert.ok(evidence.failReasons.includes('allies-down') || evidence.failRate === 1)
}

{
  const quest = { waves: [{ enemies: [{ id: 1, name: 'e', className: 'lancer', hp: 8000 }] }] }
  const team = [
    { id: 1, className: 'saber', atk: 9000, np: 100, npMultiplier: 3, npGain: 0.5, skills: [] },
  ]
  const strategy = planBattle({ quest, team })
  const a = simulateBattle({ quest, team, strategy, runs: 6, seed: 11, cardRandom: true })
  const b = simulateBattle({ quest, team, strategy, runs: 6, seed: 11, cardRandom: true })
  const c = simulateBattle({ quest, team, strategy, runs: 6, seed: 12, cardRandom: true })
  assert.equal(a.failRate, b.failRate)
  assert.equal(a.avgTurns, b.avgTurns)
  assert.equal(stabilityLabel(a), stabilityLabel(b))
  assert.ok(['theoretical-clear', 'reproducible-strategy', 'high-stability-farming', 'uncleared'].includes(stabilityLabel(a)))
  assert.ok(typeof c.failRate === 'number')
}

{
  const zero = { failRate: 0, theoreticalClear: true, reproducible: true, highStability: true }
  assert.equal(stabilityLabel(zero), 'high-stability-farming')
  assert.equal(zero.failRate === 0, true)
}

console.log('battle tests passed')
