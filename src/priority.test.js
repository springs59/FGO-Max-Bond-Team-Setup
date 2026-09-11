import assert from 'node:assert/strict'
import { addPriorityPreset, mainBondOf, PRIORITY_PRESETS, priorityScore, ruleMatches } from './priority.js'

{
  const svt = { id: 100, rarity: 5, className: 'caster', traitIds: [2654], cost: 16 }
  assert.equal(ruleMatches(svt, { type: 'rarity', operator: '>=', value: 5 }), true)
  assert.equal(ruleMatches(svt, { type: 'className', value: 'caster' }), true)
  assert.equal(ruleMatches(svt, { type: 'trait', value: 2654 }), true)
  assert.equal(ruleMatches(svt, { type: 'cost', operator: '<=', value: 12 }), false)
}

{
  const team = [
    { id: 1, rarity: 5 },
    { id: 2, rarity: 4 },
  ]
  const rules = [{ type: 'rarity', operator: '>=', value: 5, weight: 10, enabled: true }]
  assert.equal(priorityScore(team, rules), 10)
}

{
  const plan = { total: 7000, preferBond: 100, lockBond: 200 }
  assert.equal(mainBondOf(plan, 'total'), 7000)
  assert.equal(mainBondOf(plan, 'prefer'), 300)
}

{
  assert.equal(ruleMatches({ traitIds: [2] }, { type: 'gender', value: 'female' }), true)
  const next = addPriorityPreset([], PRIORITY_PRESETS[0])
  assert.equal(next.length, 1)
  assert.equal(addPriorityPreset(next, PRIORITY_PRESETS[0]).length, 1)
}

console.log('priority tests passed')
