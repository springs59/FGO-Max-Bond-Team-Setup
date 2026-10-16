import assert from 'node:assert/strict'
import { AI_ENABLED_KEY, createAiSettings } from './ai-settings.js'
import { SEARCH_MODEL } from './solver/ai-model.js'
import { searchPolicyKey } from './solver/ai-search.js'
import { solverCacheKey } from './solver/cache.js'
import { recommendTeam } from './recommend.js'
import { postRecommendRequest, createCatalogReceiver } from './worker-catalog.js'

const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }
const settings = createAiSettings({ storage })
assert.equal(settings.enabled, false)
assert.deepEqual(settings.requestOptions(SEARCH_MODEL), { aiMode: 'off' })
settings.setEnabled(true)
assert.equal(createAiSettings({ storage }).enabled, true)
assert.equal(settings.requestOptions(SEARCH_MODEL).aiModel, SEARCH_MODEL)
settings.setEnabled(false)
assert.equal(createAiSettings({ storage }).enabled, false)
for (const value of ['1','on','TRUE','{broken']) {
  values.set(AI_ENABLED_KEY, value)
  assert.equal(createAiSettings({ storage }).enabled, false)
}
const unavailable = createAiSettings({ storage: { getItem() { throw Error('blocked') }, setItem() { throw Error('full') } } })
assert.equal(unavailable.enabled, false)
assert.deepEqual(unavailable.setEnabled(true), { persisted: false })
assert.equal(unavailable.requestOptions(SEARCH_MODEL).aiMode, 'on')
const modified = structuredClone(SEARCH_MODEL)
modified.heads.equipment.b2 += 1
assert.notEqual(searchPolicyKey('on', modified), searchPolicyKey('on', SEARCH_MODEL), 'same version with new weights must invalidate caches')
assert.equal(searchPolicyKey('off', modified), searchPolicyKey('off', SEARCH_MODEL), 'disabled inference is independent of weights')
assert.notEqual(solverCacheKey({ aiPolicy: searchPolicyKey('on') }), solverCacheKey({ aiPolicy: 'off' }))

// Exercise the same catalog transport as the UI, including clearing a previously
// delivered model, and real result cache behavior across policy changes.
const receiver = createCatalogReceiver(), sent = []
const worker = { postMessage(m) { sent.push(m); receiver(m) } }
for (const enabled of [true, false, true]) {
  settings.setEnabled(enabled)
  await postRecommendRequest(worker, { opts: settings.requestOptions(SEARCH_MODEL) })
  const opts = receiver(sent.at(-1)).opts
  assert.equal(opts.aiMode, enabled ? 'on' : 'off')
  assert.equal(opts.aiModel, enabled ? SEARCH_MODEL : undefined)
}
const servants = Array.from({length:6}, (_, i) => ({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i?16:3,traitIds:[100]}))
const opts = { servants, ces:[], base:1000, costLimit:20, lockSvtIds:[100], teapot:true, useInventoryCurveSolver:true, accountProfileId:'ai-choice-cache-test' }
const off = recommendTeam({...opts, aiMode:'off'})
const on = recommendTeam({...opts, aiMode:'on', aiModel:SEARCH_MODEL})
const again = recommendTeam({...opts, aiMode:'on', aiModel:SEARCH_MODEL})
const changed = recommendTeam({...opts, aiMode:'on', aiModel:modified})
assert.ok(off.ok && on.ok && changed.ok)
assert.equal(off.resultStatus.ai.enabled, false)
assert.equal(on.resultStatus.ai.enabled, true)
assert.equal(off.total, on.total)
assert.ok(!on.queryStats.cacheHit)
assert.equal(again.queryStats.cacheHit, true)
assert.ok(!changed.queryStats.cacheHit)
assert.equal(recommendTeam({...opts, aiMode:'off'}).queryStats.cacheHit, true)
console.log('AI choice: opt-in persistence, unavailable storage, Worker clearing, exact result equality, policy/model cache isolation passed')
