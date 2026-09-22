import assert from 'node:assert/strict'
import { comparePlans } from './recommend.js'

function plan(partial) {
  return {
    total: 0,
    preferBond: 0,
    bond15Count: 0,
    costLimit: 0,
    costUsed: 0,
    priorityScore: 0,
    optimizeBy: 'total',
    ...partial,
  }
}

function ranksFirst(left, right) {
  return comparePlans(left, right) < 0
}

// Frozen comparePlans order. Performance work must not change these rules:
// 1. optimizeBy selects the primary bond objective
// 2. first bond target (total or preferBond)
// 3. second bond dimension (the other of total / preferBond)
// 4. fewer Bond15 count
// 5. COST closer to the limit
// 6. higher priorityScore

{
  assert.equal(ranksFirst(plan({ total: 100 }), plan({ total: 90 })), true)
  assert.equal(ranksFirst(plan({ total: 90 }), plan({ total: 100 })), false)
}

{
  const left = plan({ total: 100, preferBond: 40 })
  const right = plan({ total: 100, preferBond: 10 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ optimizeBy: 'prefer', preferBond: 50, total: 80 })
  const right = plan({ optimizeBy: 'prefer', preferBond: 40, total: 120 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ optimizeBy: 'prefer', preferBond: 50, total: 90 })
  const right = plan({ optimizeBy: 'prefer', preferBond: 50, total: 80 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ total: 100, bond15Count: 0 })
  const right = plan({ total: 100, bond15Count: 2 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ total: 100, costLimit: 50, costUsed: 48 })
  const right = plan({ total: 100, costLimit: 50, costUsed: 40 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ total: 100, costLimit: 50, costUsed: 50, priorityScore: 9 })
  const right = plan({ total: 100, costLimit: 50, costUsed: 50, priorityScore: 1 })
  assert.equal(ranksFirst(left, right), true)
}

{
  const left = plan({ total: 90, preferBond: 90, bond15Count: 0, priorityScore: 99 })
  const right = plan({ total: 100, preferBond: 10, bond15Count: 5, priorityScore: 0 })
  assert.equal(ranksFirst(left, right), false)
}

{
  const left = plan({ total: 100, preferBond: 40, bond15Count: 1, costLimit: 50, costUsed: 48, priorityScore: 3 })
  const right = plan({ total: 100, preferBond: 40, bond15Count: 1, costLimit: 50, costUsed: 48, priorityScore: 3 })
  assert.equal(comparePlans(left, right), 0)
}

{
  const left = plan({ optimizeBy: 'prefer', preferBond: 50, total: 80, bond15Count: 2 })
  const right = plan({ optimizeBy: 'prefer', preferBond: 50, total: 80, bond15Count: 0 })
  assert.equal(ranksFirst(left, right), false)
}

{
  const left = plan({ total: 100, preferBond: 10, bond15Count: 0, costLimit: 60, costUsed: 40, priorityScore: 99 })
  const right = plan({ total: 100, preferBond: 20, bond15Count: 4, costLimit: 60, costUsed: 60, priorityScore: 0 })
  assert.equal(ranksFirst(left, right), false)
}

{
  const left = plan({ total: 100, bond15Count: 0, costLimit: 50, costUsed: 10, priorityScore: 0 })
  const right = plan({ total: 100, bond15Count: 0, costLimit: 50, costUsed: 49, priorityScore: 0 })
  assert.equal(ranksFirst(left, right), false)
}

{
  const left = plan({ optimizeBy: 'total', total: 100, preferBond: 11 })
  const right = plan({ optimizeBy: 'total', total: 100, preferBond: 10 })
  assert.equal(ranksFirst(left, right), true)
}

console.log('comparePlans tests passed')
