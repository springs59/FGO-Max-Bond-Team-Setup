import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {smallWorkerMessage,postWorkerMessage,receiveWorkerPort} from './worker-transport.js'
import {postRecommendRequest,createCatalogReceiver,CATALOG_FIELDS} from './worker-catalog.js'
import {describeQuery,createCatalogQueryDescriber,saveQuery,readQuery} from './solver/query-library.js'
const channels=[]
const target={postMessage(message){channels.push(message)}}
await postWorkerMessage(target,{small:[1,2,3]})
assert.deepEqual(channels.pop(),{small:[1,2,3]})
assert.equal(smallWorkerMessage({huge:'a'.repeat(1024*1024)}),false)
assert.equal(smallWorkerMessage(Array(1000000)),false)
const cycle={};cycle.self=cycle;assert.equal(smallWorkerMessage(cycle),true)
let read
const largeTarget={postMessage(message){assert.ok(message.port);read=receiveWorkerPort(message.port)}}
await postWorkerMessage(largeTarget,{text:'a'.repeat(1024*1024)})
assert.equal((await read).text.length,1024*1024)
const receiver=createCatalogReceiver(),seen=[]
const worker={postMessage(message){seen.push(message);receiver(message)}}
const catalog={servants:[{id:100,cost:3}],ces:[],game:{version:{region:'CN',updatedAt:100},servants:[]}}
const account={servants:[{id:100,bondLv:1}]}
await postRecommendRequest(worker,{id:1,opts:{...catalog,account,base:800,mode:'account'}})
await postRecommendRequest(worker,{id:2,opts:{...catalog,account:{servants:[{id:100,bondLv:9}]},base:801,mode:'account'}})
assert.ok(seen[0].catalogUpdate);assert.equal(seen[1].catalogUpdate,undefined)
assert.equal(seen[1].opts.account.servants[0].bondLv,9)
assert.equal(receiver(seen[1]).opts.servants,catalog.servants)
await postRecommendRequest(worker,{id:3,opts:{...catalog,servants:[...catalog.servants],base:801}})
assert.ok(seen[2].catalogUpdate,'new catalogs must replace the session')
assert.throws(()=>receiver({catalogRef:999,opts:{}}),/未同步/)
const prepared=createCatalogQueryDescriber(catalog)
for(const mode of ['free','account'])for(const extra of [{},{base:999},{costLimit:12},{teapot:true},{filter:{rarity:[5]}},{quest:{id:5,closedAt:1}},{account:{servants:[{id:100,bondLv:12}]}}]) {
  const inputs={...catalog,account,mode,base:800,...extra}
  assert.deepEqual(await prepared('bond',inputs,'same'),await describeQuery('bond',inputs,'same'))
}
const description=await describeQuery('bond',{...catalog,base:800,mode:'free'})
await saveQuery(description,{ok:true,total:1})
assert.equal((await readQuery(description)).total,1)
const copy=await readQuery(description);copy.total=999
assert.equal((await readQuery(description)).total,1,'consumer mutation cannot change a memo')
await saveQuery(description,{ok:true,total:2})
assert.equal((await readQuery(description)).total,2,'updated metadata invalidates the memo')
const db=await new Promise(resolve=>{const r=indexedDB.open('fgo-local-query-results-v1');r.onsuccess=()=>resolve(r.result)})
await new Promise(resolve=>{const tx=db.transaction(['meta','results'],'readwrite');for(const name of ['meta','results'])tx.objectStore(name).delete(description.queryId);tx.oncomplete=resolve})
assert.equal(await readQuery(description),null,'deletion cannot revive a memo')
db.close()
assert.ok(!CATALOG_FIELDS.includes('account'))
console.log('Fast Worker paths: bounded fallback, catalog replacement, live account/condition key parity, memo copy/update/delete guards passed')
