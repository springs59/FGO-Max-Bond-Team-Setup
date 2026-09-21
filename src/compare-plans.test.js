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

console.log('comparePlans tests passed')
