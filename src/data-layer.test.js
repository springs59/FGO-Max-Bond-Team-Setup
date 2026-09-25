import assert from 'node:assert/strict'
import { SCHEMA_VERSION, createAccountData, createGameData, dataVersionLine, formatChinaDateTime, solverInputs } from './data-layer.js'
import { validateGameBundle } from './game-data.js'

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
assert.equal(dataVersionLine(game.version), '2026-09-19 08:00:00 · atlas-cn · schema 1')
assert.equal(formatChinaDateTime('2026-09-23T19:42:34.564Z'), '2026-09-24 03:42:34')

{
  const missing = validateGameBundle({
    servants: [{ id: 1, collectionNo: 2, name: 'A', traitIds: [] }],
    ces: [{ id: 9, name: 'ce' }],
    version: {},
  })
  assert.equal(missing.ok, false)
  assert.ok(missing.errors.some((text) => text.includes('从者数异常') || text.includes('livingHuman') || text.includes('schemaVersion')))
}

{
  const badType = validateGameBundle({
    servants: [],
    ces: [],
    enemies: {},
  })
  assert.equal(badType.ok, false)
  assert.ok(badType.errors.some((text) => text.includes('enemies')))
}

console.log('data-layer tests passed')
