import assert from 'node:assert/strict'
import { SCHEMA_VERSION, createAccountData, createGameData, dataVersionLine, solverInputs } from './data-layer.js'

const game = createGameData({
  servants: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
  craftEssences: [{ id: 9, name: 'ce' }],
  quests: [{ id: 3 }],
  traits: [{ id: 2001, name: 'livingHuman' }],
  version: { schemaVersion: SCHEMA_VERSION, updatedAt: '2026-09-19T00:00:00Z', sourceVersion: 'atlas-cn' },
})
assert.equal(game.servants.length, 2)
assert.equal(game.enemies.length, 0)
assert.equal(game.traits.length, 1)

{
  const free = createAccountData(game, { mode: 'free' })
  assert.equal(free.virtual, true)
  assert.equal(free.servantsOwned.length, 2)
  const inputs = solverInputs(game, free)
  assert.equal(inputs.mode, 'free')
  assert.equal(inputs.account, null)
}

{
  const acc = createAccountData(game, {
    mode: 'account',
    account: { servants: [{ id: 1, lv: 90, bondLv: 10 }], ces: [{ id: 9, mlb: true }], maxCost: 113 },
  })
  assert.equal(acc.virtual, false)
  assert.equal(acc.servantsOwned.length, 1)
  assert.equal(acc.mlb[9], true)
  assert.equal(acc.masterCost, 113)
  const inputs = solverInputs(game, acc)
  assert.equal(inputs.mode, 'account')
}

assert.ok(dataVersionLine(game.version).includes('2026-09-19'))
assert.ok(dataVersionLine(game.version).includes('schema 1'))

console.log('data-layer tests passed')
