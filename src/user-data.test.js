import assert from 'node:assert/strict'
import {
  ACCOUNT_TTL_MS,
  accountRemainingMs,
  clearImportedAccount,
  loadImportedAccount,
  saveImportedAccount,
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

console.log('user-data tests passed')
