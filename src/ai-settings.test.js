import assert from 'node:assert/strict'
import { AI_ENABLED_KEY, AI_QUERY_MODEL_KEY, AI_SELECTION_KEY, createAiSettings } from './ai-settings.js'
import { AI_CHOICES, QUERY_MODELS, selectQueryModel } from './solver/query-models.js'
import { validSearchModel } from './solver/ai-search.js'
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

settings.setEnabled(true)
const policyKeys = new Set()
for (const {id} of QUERY_MODELS) {
  settings.setQueryModel(id)
  assert.equal(createAiSettings({storage}).queryModel, id)
  const model = settings.requestOptions(SEARCH_MODEL).aiModel
  assert.equal(model, selectQueryModel(SEARCH_MODEL,id), 'stable model identity across requests')
  assert.ok(validSearchModel(model), id)
  policyKeys.add(searchPolicyKey('on',model))
  await postRecommendRequest(worker,{opts:{...opts,...settings.requestOptions(SEARCH_MODEL)}})
  const received = receiver(sent.at(-1)).opts
  assert.equal(received.aiModel,model)
  const chosen = recommendTeam({...opts,...received,skipResultCache:true})
  assert.ok(chosen.ok,id)
  assert.deepEqual([chosen.total,chosen.costUsed],[off.total,off.costUsed],id)
  assert.equal(chosen.queryStats.aiInferenceCalls,1,id)
}
assert.equal(policyKeys.size,QUERY_MODELS.length)
settings.setEnabled(false)
settings.setQueryModel('neural-large')
assert.deepEqual(settings.requestOptions(SEARCH_MODEL),{aiMode:'off'},'changing model does not enable AI')
assert.throws(()=>settings.setQueryModel('unknown'))
values.set(AI_SELECTION_KEY,'{broken')
assert.equal(createAiSettings({storage}).selection,'off')
assert.deepEqual(unavailable.setQueryModel('neural-large'),{persisted:false})
assert.equal(unavailable.queryModel,'neural-large')
console.log('Three query models: persistent selection, Worker transport, one inference, exact reward/COST and cache isolation passed')

assert.deepEqual(AI_CHOICES.map(m => m.label), ['不使用 AI', '经典高起点 AI', '扩展策略 AI', '大数据神经 AI'])
assert.equal(QUERY_MODELS.length, 3)
assert.ok(AI_CHOICES.every(m => m.description.length > 10))
for (const id of ['off', 'baseline', 'teacher', 'neural-large', 'off']) {
  settings.setSelection(id)
  const restored = createAiSettings({ storage })
  assert.equal(restored.selection, id)
  assert.equal(restored.enabled, id !== 'off')
  assert.equal(restored.requestOptions(SEARCH_MODEL).aiMode, id === 'off' ? 'off' : 'on')
}
const legacy = new Map([[AI_ENABLED_KEY, 'true'], [AI_QUERY_MODEL_KEY, 'teacher']])
assert.equal(createAiSettings({ storage: { getItem: key => legacy.get(key) } }).selection, 'teacher')
legacy.set(AI_QUERY_MODEL_KEY, 'neural-small')
assert.equal(createAiSettings({ storage: { getItem: key => legacy.get(key) } }).selection, 'off', 'unsupported old model never silently enables another AI')
legacy.delete(AI_QUERY_MODEL_KEY)
assert.equal(createAiSettings({ storage: { getItem: key => legacy.get(key) } }).selection, 'baseline', 'existing explicit opt-in survives migration')
for (const saved of ['null', '[]', '{"enabled":"true","queryModel":"baseline"}', '{"enabled":true,"queryModel":"unknown"}']) {
  assert.equal(createAiSettings({ storage: { getItem: key => key === AI_SELECTION_KEY ? saved : 'true' } }).selection, 'off')
}
const prior = JSON.stringify({ enabled: false, queryModel: 'baseline' })
const quotaStorage = { getItem: key => key === AI_SELECTION_KEY ? prior : null, setItem() { throw Error('quota') } }
const quotaSettings = createAiSettings({ storage: quotaStorage })
assert.deepEqual(quotaSettings.setSelection('teacher'), { persisted: false })
assert.equal(quotaSettings.selection, 'teacher', 'blocked storage still permits this session')
assert.equal(createAiSettings({ storage: quotaStorage }).selection, 'off', 'failed atomic save preserves the prior disabled state')
assert.throws(() => settings.setSelection('neural-small'))
console.log('Four user choices: names/descriptions, atomic save, disabled default, legacy migration and quota behavior passed')
