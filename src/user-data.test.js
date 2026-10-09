import assert from 'node:assert/strict'
import {
  ACCOUNT_KEY,
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
  for (const elapsed of [10 * 60 * 1000 + 1, 24 * 60 * 60 * 1000, 365 * 24 * 60 * 60 * 1000]) {
    assert.deepEqual(loadImportedAccount(1000 + elapsed, store).account, account)
    assert.deepEqual(loadImportedAccount(1000 + elapsed, store, 'CN').account, account)
  }
}

{
  const store = memStore()
  saveImportedAccount({ ok: true, servants: [], ces: [] }, 0, store)
  assert.equal(loadImportedAccount(10 * 60 * 1000 + 1, store).account.ok, true)
}

{
  const store = memStore()
  saveImportedAccount({ ok: true, servants: [], ces: [] }, 1, store)
  clearImportedAccount(store)
  assert.equal(loadImportedAccount(1, store), null)
  assert.equal(loadImportedAccount(1, store, 'CN'), null)
  assert.equal(loadImportedAccount(1, store, 'JP'), null)
}

{
  const store = memStore()
  // A previously saved v1 account needs no migration, even after its old TTL.
  const old = { savedAt: 1, account: { ok: true, region: 'CN', servants: [{ id: 1 }], ces: [] } }
  store.setItem(ACCOUNT_KEY, JSON.stringify(old))
  assert.deepEqual(loadImportedAccount(86400000, store, 'CN'), old)
  assert.equal(loadImportedAccount(86400000, store, 'JP'), null)
  saveImportedAccount({ ok: true, region: 'JP', servants: [{ id: 2 }], ces: [] }, 2, store)
  saveImportedAccount({ ok: true, region: 'CN', servants: [{ id: 3 }], ces: [] }, 3, store)
  assert.equal(loadImportedAccount(86400000, store, 'CN').account.servants[0].id, 3)
  assert.equal(loadImportedAccount(86400000, store, 'JP').account.servants[0].id, 2)
  clearImportedAccount(store)
  for (const key of [ACCOUNT_KEY, ACCOUNT_KEY + ':CN', ACCOUNT_KEY + ':JP']) assert.equal(store.getItem(key), null)
}

{
  const store = memStore()
  for (const value of ['broken json', '{}', JSON.stringify({ savedAt: 1, account: { ok: false } })]) {
    store.setItem(ACCOUNT_KEY, value)
    assert.equal(loadImportedAccount(86400000, store), null)
    assert.equal(store.getItem(ACCOUNT_KEY), null)
  }
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
    base: '815', costLimit: '112', costLocked: true,
    questId: '12345', questPhase: '2', questName: '测试关卡', questAp: 40,
    questKind: 'event', questWar: '测试活动', questType: 'grand', questClass: 'saber',
    lockIds: [100100, 200100],
    preferIds: [300100],
    spriteMode: 'strict_order',
    priorities: [{ id: 'star5', type: 'rarity', operator: '>=', value: 5, weight: 10, enabled: true, label: '5星优先' }],
    frontIds: [100100, 0, 0],
    slotPins: [{ position: 5, svtId: 200100, ceId: 0, formKey: '', ceBondId: 0, ceRewardId: 0 }],
    pinCes: [{ svtId: 100100, ceId: 9401970 }],
    pinSprites: [{ svtId: 100100, formKey: 'a3' }],
    optimizeBy: 'prefer',
    allowSupport: false,
    bond15Aura: false,
    grandPosition: 2,
    region: 'JP',
  }
  assert.equal(savePlanner(plannerFromState(state), store), true)
  const loaded = { lockIds: [], preferIds: [], spriteMode: 'bond_first', priorities: [], frontIds: [0, 0, 0], slotPins: [], pinCes: [], pinSprites: [], optimizeBy: 'total', allowSupport: true, bond15Aura: true }
  applyPlanner(loaded, loadPlanner(store))
  assert.deepEqual(loaded.lockIds, [100100, 200100])
  assert.deepEqual(loaded.preferIds, [300100])
  assert.equal(loaded.spriteMode, 'strict_order')
  assert.equal(loaded.priorities[0].type, 'rarity')
  assert.equal(loaded.frontIds[0], 100100)
  assert.equal(loaded.slotPins[0].position, 5)
  assert.equal(loaded.slotPins[0].svtId, 200100)
  assert.equal(loaded.pinCes[0].ceId, 9401970)
  assert.equal(loaded.pinSprites[0].formKey, 'a3')
  assert.equal(loaded.optimizeBy, 'prefer')
  assert.equal(loaded.allowSupport, false)
  assert.equal(loaded.bond15Aura, false)
  assert.equal(loaded.grandPosition, 2)
  assert.equal(loaded.region, 'JP')
  for (const key of ['base', 'costLimit', 'costLocked', 'questId', 'questPhase', 'questName', 'questAp', 'questKind', 'questWar', 'questType', 'questClass']) {
    assert.equal(loaded[key], state[key], `restore ${key}`)
  }
  assert.equal(applyPlanner({ base: '123' }, {}).base, '123', 'old saved preferences keep the current conditions')
  assert.equal(applyPlanner({}, { questConditions: { base: '-5', costLimit: 'NaN' } }).base, '')
}

{
  const loaded = { lockIds: [], preferIds: [], frontIds: [0, 0, 0], slotPins: [], pinCes: [], pinSprites: [], priorities: [] }
  applyPlanner(loaded, { frontIds: [100100, 0, 0] })
  assert.equal(loaded.slotPins[0].position, 1)
  assert.equal(loaded.slotPins[0].svtId, 100100)
}

console.log('user-data tests passed')
