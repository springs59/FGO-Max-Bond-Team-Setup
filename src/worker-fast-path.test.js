import assert from 'node:assert/strict'
import {postRecommendRequest,createCatalogReceiver,CATALOG_FIELDS} from './worker-catalog.js'
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
assert.ok(!CATALOG_FIELDS.includes('account'))
console.log('Static catalog delivery: reuse, catalog replacement and live account conditions passed')
