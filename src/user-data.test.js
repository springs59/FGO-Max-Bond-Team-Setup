import assert from 'node:assert/strict'
import {
  ACCOUNT_TTL_MS,
  accountRemainingMs,
  applyPlanner,
  clearImportedAccount,
  loadImportedAccount,
  loadPlanner,
  plannerFromState,
  saveImportedAccount,
  savePlanner,
  loadRecSwitchMode,
  saveRecSwitchMode,
} from './user-data.js'

function memStore() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

{
  const store = memStore()
  const account = { ok: true, servants: [{ id: 1 }], ces: [] }
  assert.equal(saveImportedAccount(account, 1000, store), true)
  const loaded = loadImportedAccount(1000, store)
  assert.equal(loaded.account.servants.length, 1)
  assert.equal(accountRemainingMs(loaded.savedAt, 1000 + 9 * 60 * 1000) > 0, true)
}

{
  const store = memStore()
  saveImportedAccount({ ok: true, servants: [], ces: [] }, 0, store)
  assert.equal(loadImportedAccount(ACCOUNT_TTL_MS + 1, store), null)
}

{
  const store = memStore()
  saveImportedAccount({ ok: true, servants: [], ces: [] }, 1, store)
  clearImportedAccount(store)
  assert.equal(loadImportedAccount(1, store), null)
}

{
  const store = memStore()
  assert.equal(loadRecSwitchMode(store), 'pager')
  assert.equal(saveRecSwitchMode('cards', store), true)
  assert.equal(loadRecSwitchMode(store), 'cards')
  assert.equal(saveRecSwitchMode('nope', store), true)
  assert.equal(loadRecSwitchMode(store), 'pager')
}

{
  const store = memStore()
  const state = {
    lockIds: [100100, 200100],
    preferIds: [300100],
    spriteMode: 'strict_order',
    priorities: [{ id: 'star5', type: 'rarity', operator: '>=', value: 5, weight: 10, enabled: true, label: '5星优先' }],
    frontIds: [100100, 0, 0],
    pinCes: [{ svtId: 100100, ceId: 9401970 }],
    optimizeBy: 'prefer',
    allowSupport: false,
    bond15Aura: false,
  }
  assert.equal(savePlanner(plannerFromState(state), store), true)
  const loaded = { lockIds: [], preferIds: [], spriteMode: 'bond_first', priorities: [], frontIds: [0, 0, 0], pinCes: [], optimizeBy: 'total', allowSupport: true, bond15Aura: true }
  applyPlanner(loaded, loadPlanner(store))
  assert.deepEqual(loaded.lockIds, [100100, 200100])
  assert.deepEqual(loaded.preferIds, [300100])
  assert.equal(loaded.spriteMode, 'strict_order')
  assert.equal(loaded.priorities[0].type, 'rarity')
  assert.equal(loaded.frontIds[0], 100100)
  assert.equal(loaded.pinCes[0].ceId, 9401970)
  assert.equal(loaded.optimizeBy, 'prefer')
  assert.equal(loaded.allowSupport, false)
  assert.equal(loaded.bond15Aura, false)
}

console.log('user-data tests passed')
